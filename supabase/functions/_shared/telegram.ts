// Telegram Bot API helpers shared by the webhook (telegram-bot) and the
// scheduled notifier (telegram-notify).

import type { InlineKeyboardButton } from './telegramRender.ts';
import { findChunkEnd } from './telegramChunk.ts';

const BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? '';

export const ALLOWED_CHAT_IDS: string[] = (
  Deno.env.get('TELEGRAM_ALLOWED_CHAT_IDS') ?? ''
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const ALLOWED_CHAT_ID_SET = new Set(ALLOWED_CHAT_IDS);

const TELEGRAM_MAX_CHARS = 4096;
// Truncate HTML replies well under the real limit — the agent's answers
// are meant to be short, so one running past ~3900 chars is already a
// symptom. Keeping replies this short makes the tag-aware chunking below a
// safety net rather than the normal path.
const HTML_TRUNCATE_CHARS = 3900;

export async function tg(
  method: string,
  payload: Record<string, unknown>
): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    console.error(`Telegram ${method} failed`, res.status, await res.text());
  }
}

// Fallback only — khaos.ts's renderForTelegram (telegramRender.ts) is the
// real path now that resolves tokens into <a href> links. This still runs
// first in sendMessage() so a token that somehow reaches here unresolved
// (KHAOS_APP_URL unset, or a caller that bypasses renderForTelegram) never
// gets shown as raw [[task:uuid]] text.
function stripTokens(text: string): string {
  return text
    .replace(/\[\[(?:task|project|section|event):[^\]]+\]\]/g, '')
    .replace(/\[\[confirm:[^\]]*\]\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export async function sendMessage(
  chatId: number,
  text: string,
  opts: { html?: boolean; inlineKeyboard?: InlineKeyboardButton[][] } = {}
): Promise<void> {
  let clean = stripTokens(text) || '(no response)';
  if (opts.html && clean.length > HTML_TRUNCATE_CHARS) {
    const end = findChunkEnd(clean, HTML_TRUNCATE_CHARS);
    clean = `${clean.slice(0, end)}…`;
  }
  // Telegram caps a single message at 4096 chars; chunk longer answers,
  // preferring a break that doesn't fall inside an HTML tag or entity. The
  // keyboard (if any) only makes sense attached to the last chunk — it's
  // the reply to this specific message.
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length) {
    const end = findChunkEnd(rest, TELEGRAM_MAX_CHARS);
    chunks.push(rest.slice(0, end));
    rest = rest.slice(end).replace(/^[\n ]+/, '');
  }
  for (let i = 0; i < chunks.length; i++) {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text: chunks[i],
      disable_web_page_preview: true,
    };
    if (opts.html) payload.parse_mode = 'HTML';
    if (opts.inlineKeyboard?.length && i === chunks.length - 1) {
      payload.reply_markup = { inline_keyboard: opts.inlineKeyboard };
    }
    await tg('sendMessage', payload);
  }
}

export async function typing(chatId: number): Promise<void> {
  await tg('sendChatAction', { chat_id: chatId, action: 'typing' });
}

export async function answerCallbackQuery(callbackQueryId: string): Promise<void> {
  await tg('answerCallbackQuery', { callback_query_id: callbackQueryId });
}

// Removes the inline keyboard from a message once its button was clicked,
// so the same confirmation can't be submitted twice.
export async function removeInlineKeyboard(
  chatId: number,
  messageId: number
): Promise<void> {
  await tg('editMessageReplyMarkup', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: { inline_keyboard: [] },
  });
}

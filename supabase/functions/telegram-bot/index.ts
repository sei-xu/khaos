// Telegram bot for Khaos — the webhook surface.
//
// A Telegram webhook lands here. The agent brain lives in ../_shared/khaos.ts
// (shared with the scheduled notifier, ../telegram-notify); this file is just
// the HTTP entry point: authenticate the webhook, route commands, hand real
// messages to the agent.
//
// See ../telegram-bot/README.md for deploy + webhook setup.
//
// verify_jwt is OFF (see supabase/config.toml): Telegram can't present a
// Supabase JWT. Access is gated by the secret_token header set with setWebhook
// plus the chat-id allowlist.

import { ALLOWED_CHAT_ID_SET, sendMessage, typing } from '../_shared/telegram.ts';
import {
  BOOTSTRAP_INSTRUCTION,
  clearHistory,
  runAgent,
  temporalContext,
} from '../_shared/khaos.ts';

const WEBHOOK_SECRET = Deno.env.get('TELEGRAM_WEBHOOK_SECRET') ?? '';

interface TgUpdate {
  message?: TgMessage;
  edited_message?: TgMessage;
}
interface TgMessage {
  text?: string;
  chat: { id: number };
}

async function handleUpdate(update: TgUpdate): Promise<void> {
  const message = update.message ?? update.edited_message;
  const text = message?.text?.trim();
  const chatId = message?.chat?.id;
  if (!chatId || !text) return;

  // Access control. An empty allowlist means the bot hasn't been claimed yet —
  // reply with the chat id so the owner can add it to TELEGRAM_ALLOWED_CHAT_IDS.
  if (ALLOWED_CHAT_ID_SET.size === 0) {
    await sendMessage(
      chatId,
      `This bot has no allowed chats configured. Add this chat id to TELEGRAM_ALLOWED_CHAT_IDS to enable it:\n${chatId}`
    );
    return;
  }
  if (!ALLOWED_CHAT_ID_SET.has(String(chatId))) {
    await sendMessage(chatId, `Not authorized. Your chat id is ${chatId}.`);
    return;
  }

  const command = text.startsWith('/')
    ? text.split(/\s+/)[0].toLowerCase()
    : null;

  if (command === '/start' || command === '/clear' || command === '/reset') {
    await clearHistory();
    await typing(chatId);
    const opener = await runAgent(
      chatId,
      `${temporalContext()}${BOOTSTRAP_INSTRUCTION}`
    );
    await sendMessage(chatId, opener || 'Khaos online.');
    return;
  }

  if (command === '/whoami') {
    await sendMessage(chatId, `Chat id: ${chatId}`);
    return;
  }

  await typing(chatId);
  try {
    const reply = await runAgent(chatId, `${temporalContext()}${text}`);
    await sendMessage(chatId, reply || 'Done.');
  } catch (err) {
    console.error('handleUpdate failed', err);
    await sendMessage(
      chatId,
      'Something went wrong on my side. Try again in a moment.'
    );
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Telegram echoes back the secret set with setWebhook. Reject anything else
  // before touching the body — this is the function's trust boundary.
  const presented = req.headers.get('x-telegram-bot-api-secret-token') ?? '';
  if (!WEBHOOK_SECRET || presented !== WEBHOOK_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return new Response('Bad request', { status: 400 });
  }

  // Return 200 immediately so Telegram marks the update delivered and never
  // retries (which would double-process the message); the agent loop runs to
  // completion in the background.
  const work = handleUpdate(update).catch((err) =>
    console.error('background handleUpdate error', err)
  );
  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }
  ).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    await work;
  }

  return new Response('ok', { status: 200 });
});

// Server-side Khaos agent: the shared brain behind both the Telegram webhook
// and the scheduled notifier. It's the counterpart of src/lib/chat/agent.ts,
// reusing that module's pure pieces (persona prompts, schema search, tool
// schemas + executor) so the two can't drift, and swapping the browser-only
// glue for a direct Anthropic call and a service-role Supabase client.

import Anthropic from '@anthropic-ai/sdk';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import {
  SYSTEM_INSTRUCTION,
  TONE_INSTRUCTION,
} from '../../../src/lib/chat/prompts.ts';
import { searchSchema as searchSchemaCore } from '../../../src/lib/chat/schemaSearchCore.ts';
import {
  executeTool,
  normalizeToolName,
  TOOL_DEFINITIONS,
} from '../../../src/lib/chat/toolsCore.ts';
import {
  sanitizeStoredHistory,
  toWireMessages,
} from '../../../src/lib/chat/historyCore.ts';
import type { ChatEntityType } from '../../../src/lib/chat/entityRefs.ts';
import {
  renderTelegramMessage,
  buildInlineKeyboard,
  escapeHtml,
  type ResolvedEntity,
  type InlineKeyboardButton,
} from './telegramRender.ts';
import { sendMessage } from './telegram.ts';
import { SCHEMA_SQL } from './schema.sql.ts';

export const MODEL_NAME = Deno.env.get('LLM_MODEL') ?? 'claude-sonnet-5';
export const TIMEZONE = Deno.env.get('TELEGRAM_TIMEZONE') ?? 'America/Sao_Paulo';
// Base URL of the deployed app, used to turn [[task:uuid]] etc. tokens into
// real Telegram links (see renderForTelegram below). Unset means the bot
// can't know a valid app URL — renderTelegramMessage degrades to stripping
// tokens rather than emit a broken link.
const KHAOS_APP_URL = (Deno.env.get('KHAOS_APP_URL') ?? '').replace(/\/$/, '') || null;

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 14; // window sent to the model per turn
const MAX_STORED_MESSAGES = 60; // window persisted between turns
const MAX_TOKENS = 4096;

// Mirrors src/hooks/useChatAgent.ts — opens a new chat with OPENING TURN
// behaviour instead of a canned greeting.
export const BOOTSTRAP_INSTRUCTION =
  '[Session Bootstrap: This is the first turn of a new session — nobody has typed anything yet. Follow your OPENING TURN rules: a brief greeting is fine, but do not offer to help or ask an open-ended question — check current state for something worth surfacing before saying anything else, including anything recall_oversight_notes turns up.]';

// Telegram has no card renderer, but [[task:uuid]] etc. tokens and
// [[confirm: ...]] tokens are still resolved server-side (renderForTelegram
// below, via telegramRender.ts) into an <a href> link / inline_keyboard —
// so the model should keep emitting them here exactly as it does in the
// app, not describe entities in prose.
const CHANNEL_INSTRUCTION = `
TELEGRAM CHANNEL

You are responding over Telegram. There is no card renderer, but [[task:uuid]], [[project:uuid]], [[section:uuid]], [[event:uuid]] and [[confirm: ...]] tokens are still resolved into a tappable link or buttons — keep emitting them exactly as described in the main instructions, rather than describing the entity in prose.

Keep formatting simple. Avoid Markdown tables and headings. Short paragraphs and plain hyphen bullets only.
`.trim();

// Byte-for-byte identical on every call so prompt caching hits.
const SYSTEM_PROMPT_TEXT = `
<system_instructions>
${SYSTEM_INSTRUCTION}
</system_instructions>

<tone_and_behavior>
${TONE_INSTRUCTION}
</tone_and_behavior>

<channel>
${CHANNEL_INSTRUCTION}
</channel>
`.trim();

const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  { type: 'text', text: SYSTEM_PROMPT_TEXT, cache_control: { type: 'ephemeral' } },
];

export type ChatMessage = Anthropic.MessageParam;

const anthropic = new Anthropic({
  apiKey: Deno.env.get('ANTHROPIC_API_KEY') ?? '',
});

export const db: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// Separate client, same credentials, tagged with `x-khaos-author: assistant`
// on every request — insert_moment() (see the matching migration) reads
// that header to stamp authored_by on the INSERT itself, so the DB-change
// watcher's authored_by filter doesn't race a later UPDATE. Only the tool
// executor's writes are the assistant acting on its own tool calls; `db`
// above (chat_history, etc.) stays untagged.
const toolDb: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { global: { headers: { 'x-khaos-author': 'assistant' } } }
);

const toolDeps = {
  db: toolDb,
  searchSchema: (query: string) => searchSchemaCore(SCHEMA_SQL, query),
};

export function temporalContext(): string {
  return `[Temporal Context: current_time is ${new Date().toISOString()}, timezone is ${TIMEZONE}]\n`;
}

// --- agent loop (server-side port of runTurn) ------------------------------

function extractText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n');
}

function isFreshUserTurn(message: ChatMessage): boolean {
  if (message.role !== 'user') return false;
  if (typeof message.content === 'string') return true;
  return !message.content.some((block) => block.type === 'tool_result');
}

function trimHistory(messages: ChatMessage[], max: number): ChatMessage[] {
  if (messages.length <= max) return messages;
  let sliceFrom = Math.max(0, messages.length - max);
  while (sliceFrom > 0 && !isFreshUserTurn(messages[sliceFrom])) sliceFrom--;
  return messages.slice(sliceFrom);
}

async function runTurn(history: ChatMessage[]): Promise<ChatMessage[]> {
  const messages = trimHistory(history, MAX_HISTORY_MESSAGES);
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    let response: Anthropic.Message;
    try {
      response = await anthropic.messages.create({
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_BLOCKS,
        tools: TOOL_DEFINITIONS as Anthropic.Tool[],
        messages: toWireMessages(messages),
        output_config: { effort: 'medium' },
      });
    } catch (err) {
      messages.push({
        role: 'assistant',
        content:
          err instanceof Anthropic.RateLimitError
            ? "I'm being rate-limited right now. Give it a moment and try again."
            : "I couldn't complete that — something went wrong reaching the model.",
      });
      break;
    }

    messages.push({ role: 'assistant', content: response.content });

    if (response.stop_reason === 'pause_turn') continue;

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    );
    if (!toolUses.length) break;

    rounds++;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      let result: unknown;
      try {
        // No confirmation gate — write tools execute directly (single-owner
        // bot behind an allowlist; the persona soft-deletes and records its
        // rationale). Scheduled jobs pass a read-only instruction instead.
        const toolName = normalizeToolName(toolUse.name);
        const args = toolUse.input as Record<string, unknown>;
        result = await executeTool(toolDeps, toolName, args);
      } catch (err) {
        result = { error: (err as Error).message };
      }
      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    messages.push({ role: 'user', content: toolResults });
  }

  return messages;
}

// --- shared history (chat_history) ------------------------------------------
//
// One conversation, shared with the web app (src/hooks/useChatAgent.ts) via
// the same "chat_history" table — chat_id is no longer a storage key, only
// the Telegram side's own auth/routing concern (see telegram-bot/index.ts).

const CHAT_ROW_ID = 'khaos';

export async function loadHistory(): Promise<ChatMessage[]> {
  const { data, error } = await db
    .from('chat_history')
    .select('history')
    .eq('id', CHAT_ROW_ID)
    .maybeSingle();
  if (error) {
    console.error('loadHistory failed', error.message);
    return [];
  }
  return sanitizeStoredHistory(data?.history);
}

async function saveHistory(history: ChatMessage[]): Promise<void> {
  const trimmed = history.slice(-MAX_STORED_MESSAGES);
  const { error } = await db.from('chat_history').upsert(
    { id: CHAT_ROW_ID, history: trimmed, updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) console.error('saveHistory failed', error.message);
}

export async function clearHistory(): Promise<void> {
  const { error } = await db.from('chat_history').upsert(
    { id: CHAT_ROW_ID, history: [], updated_at: new Date().toISOString() },
    { onConflict: 'id' }
  );
  if (error) console.error('clearHistory failed', error.message);
}

// Load history, append the user turn, run the loop, persist, return the reply.
// Used for real messages and for the automated morning digest (which threads
// its suggestions into the same history so a follow-up "yes, do it" has
// context). chatId is kept as a param only so callers don't have to change;
// it no longer selects which history is loaded.
export async function runAgent(
  _chatId: number,
  userContent: string
): Promise<string> {
  const history = await loadHistory();
  const withUser: ChatMessage[] = [
    ...history,
    { role: 'user', content: userContent },
  ];
  const updated = await runTurn(withUser);
  await saveHistory(updated);
  const last = updated[updated.length - 1];
  return last?.role === 'assistant' ? extractText(last.content) : '';
}

// --- Telegram rendering ------------------------------------------------
//
// Resolves a [[type:uuid]] token against the real table with a service-
// role SELECT. One query per token — these messages mention at most a
// handful of entities, so this isn't worth batching.
async function resolveEntityForTelegram(
  entityType: ChatEntityType,
  id: string
): Promise<ResolvedEntity | null> {
  const table =
    entityType === 'task'
      ? 'tasks'
      : entityType === 'project'
        ? 'projects'
        : entityType === 'section'
          ? 'sections'
          : 'events';
  // select('*') rather than a dynamic column list: supabase-js can only
  // infer a typed result from a literal select string, and which columns
  // exist varies by table (tasks have no project_id of their own, for
  // instance) — sections are the only type that needs project_id, to link
  // to their parent project since they have no standalone route.
  const { data, error } = await db
    .from(table)
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { name: string; project_id?: string };
  return { name: row.name, projectId: row.project_id };
}

// Resolves every [[type:uuid]] token into an <a href> link (or strips it if
// KHAOS_APP_URL isn't configured / the id doesn't resolve) and pulls a
// trailing [[confirm: ...]] token out into an inline_keyboard — see
// telegramRender.ts. Exported so telegram-bot and telegram-notify don't each
// re-wire resolveEntityForTelegram + KHAOS_APP_URL themselves.
export async function renderForTelegram(text: string): Promise<{
  text: string;
  inlineKeyboard?: InlineKeyboardButton[][];
}> {
  const { text: rendered, options } = await renderTelegramMessage(text, {
    appUrl: KHAOS_APP_URL,
    resolveEntity: resolveEntityForTelegram,
  });
  if (!options.length) return { text: rendered };

  const { inline_keyboard, textFallbackOptions } = buildInlineKeyboard(options);
  // Escaped like every other part of `rendered`: these labels come from the
  // model and go out with parse_mode HTML, so a "<" or "&" in one would make
  // Telegram reject the whole sendMessage ("can't parse entities") and the
  // reply would never arrive.
  const fallbackNote = textFallbackOptions.length
    ? `\n\n(reply by typing: ${textFallbackOptions.map(escapeHtml).join(' / ')})`
    : '';
  return { text: `${rendered}${fallbackNote}`, inlineKeyboard: inline_keyboard };
}

// The one way to send agent output to Telegram: resolve its tokens, then
// send with parse_mode HTML and whatever keyboard came out of a confirm
// token. Callers used to repeat this trio inline, which left `html: true`
// (and the keyboard) as something each new call site had to remember.
export async function sendRenderedMessage(
  chatId: number,
  text: string
): Promise<void> {
  const rendered = await renderForTelegram(text);
  await sendMessage(chatId, rendered.text, {
    html: true,
    inlineKeyboard: rendered.inlineKeyboard,
  });
}

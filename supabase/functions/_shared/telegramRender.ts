// Turns the [[task:uuid]] / [[project:uuid]] / [[section:uuid]] /
// [[event:uuid]] / [[confirm: ...]] tokens the model emits (see
// src/lib/chat/prompts.ts, src/lib/chat/entityRefs.ts) into something
// Telegram can render: an HTML <a href> per entity token, and an
// inline_keyboard built from a confirm token's options.
//
// Entity resolution is injected (resolveEntity) so this stays pure and
// unit-testable without a real Supabase client — telegram-bot/index.ts and
// telegram-notify/index.ts wire resolveEntity to a service-role lookup.
//
// Pure: no Deno.env access here. The caller reads KHAOS_APP_URL and passes
// it in as `appUrl`; when it's not configured this degrades to stripping
// tokens (same as the pre-existing stripTokens fallback in telegram.ts) —
// never emits a link that can't possibly resolve.

import {
  parseMessageSegments,
  type ChatEntityType,
} from '../../../src/lib/chat/entityRefs.ts';

export interface ResolvedEntity {
  name: string;
  // Only sections need this — they have no standalone route, so the link
  // has to point at their parent project.
  projectId?: string;
}

export type EntityResolver = (
  entityType: ChatEntityType,
  id: string
) => Promise<ResolvedEntity | null>;

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function entityPath(
  entityType: ChatEntityType,
  id: string,
  resolved: ResolvedEntity
): string {
  switch (entityType) {
    case 'task':
      return `/tasks?taskId=${id}`;
    case 'project':
      return `/projects/${id}`;
    case 'section':
      return `/projects/${resolved.projectId ?? ''}`;
    case 'event':
      return `/calendar?eventId=${id}`;
  }
}

export async function renderTelegramMessage(
  text: string,
  opts: { appUrl: string | null; resolveEntity: EntityResolver }
): Promise<{ text: string; options: string[] }> {
  const segments = parseMessageSegments(text);
  let out = '';
  let options: string[] = [];

  for (const segment of segments) {
    if (segment.type === 'text') {
      out += escapeHtml(segment.value);
      continue;
    }
    if (segment.type === 'confirm') {
      // Pulled out of the running text entirely — it becomes the
      // inline_keyboard, not inline HTML.
      options = segment.options;
      continue;
    }
    // entity
    const resolved = opts.appUrl
      ? await opts.resolveEntity(segment.entityType, segment.id)
      : null;
    if (!resolved) continue; // strip: unresolved id, or no app URL configured
    const href = `${opts.appUrl}${entityPath(segment.entityType, segment.id, resolved)}`;
    out += `<a href="${escapeHtml(href)}">${escapeHtml(resolved.name)}</a>`;
  }

  return { text: out.trim(), options };
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

const CALLBACK_DATA_MAX_BYTES = 64;

export function buildInlineKeyboard(options: string[]): {
  inline_keyboard: InlineKeyboardButton[][];
  // Options that didn't fit in a callback_data and got no button — the
  // caller appends a plain-text "or reply: <option>" line for these.
  textFallbackOptions: string[];
} {
  const inline_keyboard: InlineKeyboardButton[][] = [];
  const textFallbackOptions: string[] = [];

  for (const option of options) {
    const callback_data = `c:${option}`;
    const bytes = new TextEncoder().encode(callback_data).length;
    if (bytes > CALLBACK_DATA_MAX_BYTES) {
      textFallbackOptions.push(option);
      continue;
    }
    inline_keyboard.push([{ text: option, callback_data }]);
  }

  return { inline_keyboard, textFallbackOptions };
}

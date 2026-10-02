// Framework-agnostic sanitization for the shared chat history (table
// "chat_history"). No runtime imports, no browser or Deno globals — lets the
// Telegram Edge Function (supabase/functions/_shared/khaos.ts) import this
// unchanged, the same way it already does with toolsCore.ts and
// schemaSearchCore.ts.
//
// Both sides overlay UI-only fields on top of Anthropic's own MessageParam
// (the browser's `isError`, see src/lib/chat/agent.ts) that must never reach
// the Messages API or the shared "chat_history" row — the API rejects
// unknown message fields with a 400. toWireMessages strips everything but
// {role, content} before a message crosses either of those two boundaries;
// sanitizeStoredHistory applies the same strip plus shape-checking when
// reading a row back, which also heals a row some older build already wrote
// with an extra field.
import type Anthropic from '@anthropic-ai/sdk';

export function toWireMessages(
  messages: readonly Anthropic.MessageParam[]
): Anthropic.MessageParam[] {
  return messages.map(({ role, content }) => ({ role, content }));
}

export function sanitizeStoredHistory(value: unknown): Anthropic.MessageParam[] {
  if (!Array.isArray(value)) return [];
  const messages = value.filter(
    (entry): entry is Anthropic.MessageParam =>
      typeof entry === 'object' &&
      entry !== null &&
      'role' in entry &&
      'content' in entry
  );
  return toWireMessages(messages);
}

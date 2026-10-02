import Anthropic from '@anthropic-ai/sdk';
import {
  client,
  MODEL_NAME,
  SYSTEM_INSTRUCTION,
  TONE_INSTRUCTION,
} from './client';
import { executeTool, normalizeToolName, TOOL_DEFINITIONS } from './tools';
import { toWireMessages } from './historyCore';

const MAX_TOOL_ROUNDS = 6;
const MAX_HISTORY_MESSAGES = 14;
const MAX_TOKENS = 4096;

// Static, byte-for-byte identical on every call — required for prompt
// caching to actually hit. Don't interpolate anything dynamic in here (a
// date, a user name); put per-turn context in the user message instead,
// same as useChatAgent.ts already does with its [Temporal Context: ...] /
// [UI Context: ...] prefixes.
const SYSTEM_PROMPT_TEXT = `
<system_instructions>
${SYSTEM_INSTRUCTION}
</system_instructions>

<tone_and_behavior>
${TONE_INSTRUCTION}
</tone_and_behavior>
`.trim();

const SYSTEM_BLOCKS: Anthropic.TextBlockParam[] = [
  {
    type: 'text',
    text: SYSTEM_PROMPT_TEXT,
    cache_control: { type: 'ephemeral' },
  },
];

// History is stored directly in Anthropic's own wire format — no bespoke
// interface to keep in sync with the API. `isError` is the one UI-only
// field layered on top, for ChatPanel's error bubble; it's stripped by
// toWireMessages (./historyCore) before any message reaches the Messages
// API or the shared "chat_history" row — the API 400s on unknown fields.
export type ChatMessage = Anthropic.MessageParam & { isError?: boolean };

export function extractText(content: ChatMessage['content']): string {
  if (typeof content === 'string') return content;
  // Defensive: a persisted message (localStorage) can predate a schema
  // change, or come from a turn where the API response was malformed —
  // `content` then lands as `undefined` after JSON round-tripping (a
  // property set to `undefined` is dropped by JSON.stringify).
  if (!Array.isArray(content)) return '';
  return content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n');
}

// A user message is safe to start a trimmed window on only if it's a real
// user turn, not a continuation carrying tool_result blocks for a prior
// assistant tool_use — cutting there would strand tool_result blocks with
// no matching tool_use in the visible history, which the API rejects.
function isFreshUserTurn(message: ChatMessage): boolean {
  if (message.role !== 'user') return false;
  if (typeof message.content === 'string') return true;
  if (!Array.isArray(message.content)) return true;
  return !message.content.some((block) => block.type === 'tool_result');
}

function trimHistory(
  messages: ChatMessage[],
  maxMessages: number
): ChatMessage[] {
  if (messages.length <= maxMessages) return messages;
  let sliceFrom = Math.max(0, messages.length - maxMessages);
  while (sliceFrom > 0 && !isFreshUserTurn(messages[sliceFrom])) sliceFrom--;
  return messages.slice(sliceFrom);
}

export async function runTurn(
  history: ChatMessage[]
): Promise<{ updatedHistory: ChatMessage[]; text: string }> {
  const currentMessages = trimHistory(history, MAX_HISTORY_MESSAGES);
  let rounds = 0;

  while (rounds < MAX_TOOL_ROUNDS) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: MODEL_NAME,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_BLOCKS,
        tools: TOOL_DEFINITIONS,
        messages: toWireMessages(currentMessages),
        output_config: { effort: 'medium' },
      });
    } catch (err) {
      currentMessages.push({
        role: 'assistant',
        content:
          err instanceof Anthropic.RateLimitError
            ? "I'm being rate-limited right now. Give it a moment and try again."
            : "I couldn't complete that — something went wrong reaching the model.",
        isError: true,
      });
      break;
    }

    currentMessages.push({ role: 'assistant', content: response.content });

    // The server-side tool loop (web search etc. — not in play today, but
    // harmless to handle) hit its internal iteration cap. Re-sending the
    // conversation as-is resumes it; no extra "continue" message needed.
    if (response.stop_reason === 'pause_turn') continue;

    const toolUses = response.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUses.length) break;

    rounds++;

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      let result: unknown;
      try {
        // Normalize aliased/mis-cased tool names (e.g. the model calling
        // "update_row" instead of the declared "update_rows").
        const toolName = normalizeToolName(toolUse.name);
        const args = toolUse.input as Record<string, unknown>;
        result = await executeTool(toolName, args);
      } catch (err) {
        result = { error: (err as Error).message };
      }

      toolResults.push({
        type: 'tool_result',
        tool_use_id: toolUse.id,
        content: JSON.stringify(result),
      });
    }

    // Anthropic requires every tool_result for a turn's tool_use blocks to
    // arrive together in a single user message, not split across several.
    currentMessages.push({ role: 'user', content: toolResults });
  }

  const lastMessage = currentMessages[currentMessages.length - 1];
  return {
    updatedHistory: currentMessages,
    text: lastMessage.role === 'assistant' ? extractText(lastMessage.content) : '',
  };
}

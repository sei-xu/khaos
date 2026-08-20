import { useCallback, useEffect, useRef, useState } from 'react';
import {
  runTurn,
  extractText,
  type ChatMessage as AgentMessage,
} from '../lib/chat/agent';
import {
  loadHistory,
  saveHistory,
  clearHistory as clearHistoryRemote,
} from '../lib/chat/history';
import { useProcessingContext } from '../lib/processingContext';
import { useActiveEntity } from '../lib/activeEntityContext';
import { useChatActivity } from '../lib/chat/chatActivityContext';
import { getTimezone } from '../lib/timezone';

const BOOTSTRAP_INSTRUCTION =
  '[Session Bootstrap: This is the first turn of a new session — nobody has typed anything yet. Follow your OPENING TURN rules: a brief greeting is fine, but do not offer to help or ask an open-ended question — check current state for something worth surfacing before saying anything else, including anything recall_oversight_notes turns up.]';

// The conversation is now persisted server-side (table "chat_history", see
// ../lib/chat/history.ts) and shared across every browser instance and the
// Telegram bot — it's the same shared thread everywhere, not a per-page-load
// session. This flag still exists to solve one narrow race: the always-
// mounted desktop panel and a freshly-opened mobile sheet both mount this
// hook, and only one of them should claim the opening bootstrap turn once
// the fetched history turns out to be empty.
let bootstrapClaimedThisLoad = false;

// UI-facing shape — this is what ChatPanel and the rest of the app render.
// Kept separate from AgentMessage, whose content is Anthropic's own
// text/tool_use/tool_result content-block union, not plain display text.
export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export function useChatAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const { setAssistantProcessing } = useProcessingContext();
  const { activeEntity } = useActiveEntity();
  const { markOpenerUnseen } = useChatActivity();
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  // Shared by sendMessage and the session-opening bootstrap turn below —
  // both are "push a user-role message, run the agent loop, record the
  // result," differing only in what that message contains and whether a
  // real person is waiting on it.
  const runWithUserContent = useCallback(
    async (content: string, { silent }: { silent?: boolean } = {}) => {
      setIsSending(true);
      if (!silent) setAssistantProcessing(true);

      const newUserAgentMessage: AgentMessage = { role: 'user', content };
      setMessages((prev) => [...prev, newUserAgentMessage]);

      try {
        const { updatedHistory } = await runTurn([
          ...messagesRef.current,
          newUserAgentMessage,
        ]);
        setMessages(updatedHistory);
        saveHistory(updatedHistory);
        return updatedHistory;
      } catch (err) {
        console.error(err);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `Something went wrong: ${(err as Error).message}`,
            isError: true,
          },
        ]);
        return null;
      } finally {
        setIsSending(false);
        if (!silent) setAssistantProcessing(false);
      }
    },
    [setAssistantProcessing]
  );

  const sendMessage = useCallback(
    async (inputText: string) => {
      if (!inputText.trim() || isSending) return;

      const activeCtx = activeEntity
        ? `[UI Context: user is currently looking at ${activeEntity.type} ${activeEntity.id}]\n`
        : '';
      const timeCtx = `[Temporal Context: current_time is ${new Date().toISOString()}, timezone is ${getTimezone()}]\n`;
      await runWithUserContent(`${timeCtx}${activeCtx}${inputText}`);
    },
    [activeEntity, isSending, runWithUserContent]
  );

  // Fetches the shared history once per mount (every panel/sheet instance
  // needs its own copy in state), then — only the first instance to finish,
  // and only if the fetched history is genuinely empty — runs the opening
  // bootstrap turn. bootstrapClaimedThisLoad guards that second part, not
  // the fetch itself.
  useEffect(() => {
    let cancelled = false;

    loadHistory().then((history) => {
      if (cancelled) return;
      setMessages(history);
      setIsLoaded(true);

      if (history.length > 0) return;
      if (bootstrapClaimedThisLoad) return;
      bootstrapClaimedThisLoad = true;

      const timeCtx = `[Temporal Context: current_time is ${new Date().toISOString()}, timezone is ${getTimezone()}]\n`;
      runWithUserContent(`${timeCtx}${BOOTSTRAP_INSTRUCTION}`, {
        silent: true,
      }).then((updatedHistory) => {
        const last = updatedHistory?.[updatedHistory.length - 1];
        if (last?.role === 'assistant' && extractText(last.content)) {
          markOpenerUnseen();
        }
      });
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wipes the shared conversation everywhere — web instances and Telegram
  // alike — not just this tab's view of it.
  const clearHistory = useCallback(() => {
    setMessages([]);
    clearHistoryRemote();
  }, []);

  const uiMessages: ChatMessage[] = messages
    .map((m, index) => ({ m, index }))
    .filter(({ m }) => m.role === 'user' || m.role === 'assistant')
    .map(({ m, index }) => {
      const role = m.role === 'assistant' ? ('model' as const) : ('user' as const);
      // extractText reads only text blocks — a user turn that's actually a
      // tool_result continuation, or an assistant turn that's purely a
      // tool_use with no accompanying text, both collapse to ''. Stripping
      // has to happen before the emptiness check below, not after — a
      // hidden turn like the bootstrap instruction is nothing *but* a
      // context prefix, so checking emptiness first would let it through
      // as a blank bubble instead of dropping it.
      let text = extractText(m.content);
      if (role === 'user') {
        text = text.replace(/^\[Temporal Context:[\s\S]*?\]\s*/g, '');
        text = text.replace(/^\[UI Context:[\s\S]*?\]\s*/g, '');
        text = text.replace(/^\[Session Bootstrap:[\s\S]*?\]\s*/g, '');
        text = text.replace(/^\[Context:[\s\S]*?\]\s*/g, '');
      }
      return { id: `${m.role}-${index}`, role, text, isError: m.isError };
    })
    .filter(({ text }) => Boolean(text));

  return {
    messages: uiMessages,
    sendMessage,
    isSending,
    isLoaded,
    clearHistory,
  };
}

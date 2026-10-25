import { createContext, useContext, useState, type ReactNode } from 'react';

// Tracks only whether the session's proactive opener, or a reactive DB-change
// nudge (see useDbChangeFeed.ts), produced something worth flagging on the
// mobile collapsed-chat badge (see AppShell) — the message content itself
// still lives in useChatAgent's own history/state.
interface ChatActivityContextValue {
  hasUnseenAssistantMessage: boolean;
  markAssistantUnseen: () => void;
  markAssistantSeen: () => void;
}

const Ctx = createContext<ChatActivityContextValue>({
  hasUnseenAssistantMessage: false,
  markAssistantUnseen: () => {},
  markAssistantSeen: () => {},
});

export function ChatActivityProvider({ children }: { children: ReactNode }) {
  const [hasUnseenAssistantMessage, setHasUnseenAssistantMessage] =
    useState(false);

  return (
    <Ctx.Provider
      value={{
        hasUnseenAssistantMessage,
        markAssistantUnseen: () => setHasUnseenAssistantMessage(true),
        markAssistantSeen: () => setHasUnseenAssistantMessage(false),
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useChatActivity() {
  return useContext(Ctx);
}

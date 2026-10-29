import { createContext, useContext, type ReactNode } from 'react';
import { useChatAgent, type ChatAgent } from '../../hooks/useChatAgent';

// The one shared assistant for the whole shell. Before this provider, every
// ChatPanel called useChatAgent() itself — and the desktop rail's panel stays
// mounted even on mobile (it's `hidden`/`lg:flex`, CSS only), so opening the
// mobile bottom-sheet, or hitting /assistant on desktop, meant *two* live
// agents: two histories loaded into two `messages` states, two
// `useDbChangeFeed` watchers each with its own buffer and cooldown, and two
// concurrent `saveHistory` writes to the same `chat_history` row
// (last-write-wins, so one turn could vanish from the shared thread). The
// conversation is a single shared thread by definition — one row in
// `chat_history`, shared with the Telegram bot — so it gets a single owner
// here and the panels become pure views of it.
//
// Mounted inside AppShell rather than main.tsx on purpose: the /dev/vortex/*
// routes render outside the shell and have no chat UI at all, and an agent
// living there would load history and possibly fire its opening turn with
// nobody watching. This keeps the agent's lifetime exactly what the rail
// panel's already was.
const Ctx = createContext<ChatAgent | null>(null);

export function ChatAgentProvider({ children }: { children: ReactNode }) {
  const agent = useChatAgent();
  return <Ctx.Provider value={agent}>{children}</Ctx.Provider>;
}

export function useChatAgentContext(): ChatAgent {
  const agent = useContext(Ctx);
  if (!agent) {
    throw new Error(
      'useChatAgentContext must be used inside ChatAgentProvider'
    );
  }
  return agent;
}

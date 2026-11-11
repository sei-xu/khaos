// Classifies the hidden-instruction prefixes useChatAgent.ts/khaos.ts
// prepend to a user-role turn — [Temporal Context: ...], [UI Context: ...],
// [Session Bootstrap: ...] and [DB Change: ...] — instead of stripping them
// with a regex anchored on the first "]".
//
// That was the bug: a non-greedy `\[DB Change:[\s\S]*?\]` stops at whichever
// "]" comes first in the string, and a DB Change batch's own moment lines
// end in "[user]" — so with two or more moments the regex closes on the
// FIRST moment's "[user]", leaving everything after it (a second moment,
// then the real closing "]") behind as if it were something the user typed.
// This module instead counts bracket depth to find the prefix's own
// matching "]", so nested "[...]" inside it (like "[user]") can't confuse
// where the prefix ends.

export type TurnPrefixType =
  | 'temporal-context'
  | 'ui-context'
  | 'session-bootstrap'
  | 'db-change'
  | 'plain';

export interface ClassifiedTurn {
  type: TurnPrefixType;
  // Whatever followed the prefix — the real thing a person typed, if
  // anything. Empty when the turn is nothing but the prefix.
  rest: string;
  // Only set when type === 'db-change': the raw "a: b; c: d" body between
  // "[DB Change: " and the prefix's closing "]", ready for parseDbChangeItems.
  dbChangeBody?: string;
}

// Deliberately missing "Context" (the old `[Context: ...]` prefix) — nothing
// emits it any more, so it's not worth a case here. A turn stored by a build
// that predates this one can still carry it in chat_history (shared across
// builds, see docs/backlog.md), and will render raw if so; accepted rather
// than handled, since current history has already rotated past it.
const PREFIX_NAMES: Array<{ name: string; type: TurnPrefixType }> = [
  { name: 'Temporal Context', type: 'temporal-context' },
  { name: 'UI Context', type: 'ui-context' },
  { name: 'Session Bootstrap', type: 'session-bootstrap' },
  { name: 'DB Change', type: 'db-change' },
];

// Given text starting at an opening "[", returns the index just past the
// matching closing "]" (tracking nested brackets), or null if the text
// never balances back to depth 0.
function findMatchingBracketEnd(text: string, openIndex: number): number | null {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '[') depth++;
    else if (text[i] === ']') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return null;
}

// A turn can stack more than one prefix (Temporal Context + UI Context, in
// that order — see useChatAgent.ts's sendMessage). Only the FIRST prefix
// found determines `type` (db-change/session-bootstrap turns are never
// stacked with anything else in practice), but every leading prefix must be
// peeled off so `rest` is the real text, not the next prefix down the stack.
export function classifyTurnPrefix(text: string): ClassifiedTurn {
  let remaining = text;
  let firstType: TurnPrefixType | null = null;
  let dbChangeBody: string | undefined;

  for (;;) {
    const found = PREFIX_NAMES.find(({ name }) =>
      remaining.startsWith(`[${name}:`)
    );
    if (!found) break;
    const end = findMatchingBracketEnd(remaining, 0);
    if (end === null) break;
    if (firstType === null) {
      firstType = found.type;
      if (found.type === 'db-change') {
        dbChangeBody = remaining
          .slice(`[${found.name}:`.length, end - 1)
          .trim();
      }
    }
    remaining = remaining.slice(end).replace(/^\s+/, '');
  }

  if (firstType === null) return { type: 'plain', rest: text };
  return { type: firstType, rest: remaining, dbChangeBody };
}

export interface DbChangeItem {
  entityType: string;
  entityId: string;
  momentType: string;
  transition: string | null;
  authoredBy: string;
}

// Mirrors formatDbChangePrefix's line shape (changeWatcher.ts):
// "<entityType> <entityId>: <momentType>(<transition>)? [<authoredBy>]"
const ITEM_RE = /^(\w+) (\S+): (\w+)(?: \(([^)]*)\))? \[(\w+)\]$/;

export function parseDbChangeItems(body: string): DbChangeItem[] {
  return body
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part): DbChangeItem | null => {
      const match = ITEM_RE.exec(part);
      if (!match) return null;
      const [, entityType, entityId, momentType, transition, authoredBy] =
        match;
      return {
        entityType,
        entityId,
        momentType,
        transition: transition ?? null,
        authoredBy,
      };
    })
    .filter((item): item is DbChangeItem => item !== null);
}

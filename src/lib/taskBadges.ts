// Pure logic deciding which badges a task-name renderer shows, and in what
// order they give up space to the name when the container is too narrow for
// all of them. Kept free of JSX so it's testable without jsdom (see
// CLAUDE.md — this repo only has vitest-in-node, no @testing-library) and so
// every renderer (TaskRow, BacklogRow, cards, the chat chip, …) decides
// badges the same way instead of each hand-rolling its own truncation rule.
import type { Priority, Status } from './types';

export type Density = 'row' | 'card' | 'pill' | 'inline';

export type BadgeKind =
  | 'priority'
  | 'estimate'
  | 'seqBefore'
  | 'seqAfter'
  | 'target'
  | 'scheduled'
  | 'due';

export interface BadgeDescriptor {
  kind: BadgeKind;
  // Only set for seqBefore/seqAfter, the sequence-link counters.
  count?: number;
}

export interface TaskBadgeData {
  priority: Priority | null;
  estimateMinutes: number | null;
  seqBefore: number;
  seqAfter: number;
  target: string | null;
  scheduledAt: string | Date | null;
  due: string | null;
}

// The name's guaranteed minimum width, in characters — badges give up
// space to protect this floor before the name itself shrinks any further.
// Matches TaskRow's `min-w-[20ch]` on the name block.
export const NAME_FLOOR_CH = 20;

const CANONICAL_ORDER: BadgeKind[] = [
  'priority',
  'estimate',
  'seqBefore',
  'seqAfter',
  'target',
  'scheduled',
  'due',
];

// Discard order under width pressure: estimate and the sequence counters go
// first (least load-bearing — they're conveniences, not identity), then
// scheduled, then target; status (handled separately by the caller, next to
// the name)/priority/due stay until the very end.
export const DISCARD_ORDER: BadgeKind[] = [
  'estimate',
  'seqBefore',
  'seqAfter',
  'scheduled',
  'target',
  'priority',
  'due',
];

// Rough rendered width per badge kind, in ch-equivalent units — just enough
// to order the discard decision correctly, not a pixel-perfect layout model.
const BADGE_WIDTH_CH: Record<BadgeKind, number> = {
  priority: 4,
  estimate: 6,
  seqBefore: 4,
  seqAfter: 4,
  target: 16,
  scheduled: 10,
  due: 10,
};

// Narrower densities (the chat chip, dashboard pills, cards) never show the
// full row cluster — they only ever carry priority + due.
const DENSITY_KINDS: Record<Density, ReadonlySet<BadgeKind>> = {
  row: new Set(CANONICAL_ORDER),
  card: new Set(['priority', 'due']),
  pill: new Set(['priority', 'due']),
  inline: new Set(['priority', 'due']),
};

function buildDescriptor(
  data: TaskBadgeData,
  kind: BadgeKind
): BadgeDescriptor | null {
  switch (kind) {
    case 'priority':
      return data.priority ? { kind } : null;
    case 'estimate':
      return data.estimateMinutes ? { kind } : null;
    case 'seqBefore':
      return data.seqBefore ? { kind, count: data.seqBefore } : null;
    case 'seqAfter':
      return data.seqAfter ? { kind, count: data.seqAfter } : null;
    case 'target':
      return data.target ? { kind } : null;
    case 'scheduled':
      return data.scheduledAt ? { kind } : null;
    case 'due':
      return data.due ? { kind } : null;
  }
}

// Every badge a task actually has data for, in canonical display order,
// restricted to the ones a given density ever shows at all.
export function presentBadges(
  data: TaskBadgeData,
  density: Density
): BadgeDescriptor[] {
  const allowed = DENSITY_KINDS[density];
  const result: BadgeDescriptor[] = [];
  for (const kind of CANONICAL_ORDER) {
    if (!allowed.has(kind)) continue;
    const descriptor = buildDescriptor(data, kind);
    if (descriptor) result.push(descriptor);
  }
  return result;
}

function totalWidth(badges: BadgeDescriptor[]): number {
  return badges.reduce((sum, b) => sum + BADGE_WIDTH_CH[b.kind], 0);
}

// Picks which present badges survive at a given available width (badges +
// name combined, in ch-equivalent units), dropping them one at a time in
// DISCARD_ORDER only once keeping them would push the name below
// NAME_FLOOR_CH — never before, and never a badge that wasn't present to
// begin with.
export function pickBadgesForWidth(
  data: TaskBadgeData,
  availableCh: number,
  density: Density
): BadgeDescriptor[] {
  let kept = presentBadges(data, density);
  const keptKinds = new Set(kept.map((b) => b.kind));

  for (const kind of DISCARD_ORDER) {
    if (!keptKinds.has(kind)) continue;
    const nameRemaining = availableCh - totalWidth(kept);
    if (nameRemaining >= NAME_FLOOR_CH) break;
    kept = kept.filter((b) => b.kind !== kind);
    keptKinds.delete(kind);
  }

  return kept;
}

// Whether a task's name should render struck through — the one status-driven
// decision every TaskName consumer needs, pulled out so it's covered by the
// same pure-logic tests as the badge discard order above.
export function isCancelledName(status: Status | null | undefined): boolean {
  return status === 'cancelled';
}

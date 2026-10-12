// Pure arithmetic for tasks.backlog_rank — a sparse numeric rank, not a
// linked list (tasks_sequence is dependency, not display order; see the
// comment on src/lib/api/sequence.ts). Reordering writes exactly one row:
// the moved task's rank becomes the midpoint of its new neighbors. Ranks
// start RANK_STEP apart so many inserts fit between any two neighbors
// before a gap collapses and a rebalance is needed.
import type { Id } from './types';

export const RANK_STEP = 1024;

// Below this gap, inserting between two neighbors would floor to the same
// value as one of them (floating point losing precision), so the caller
// should rebalance instead of trusting the midpoint.
const MIN_GAP = 1e-6;

export function orderByRank<T extends { backlog_rank: number | null }>(
  tasks: T[]
): T[] {
  return [...tasks]
    .filter((t) => t.backlog_rank !== null)
    .sort((a, b) => (a.backlog_rank as number) - (b.backlog_rank as number));
}

// Rank to use for a brand-new neighbor placed between `prev` and `next`
// (either end may be absent, meaning "start"/"end" of the queue).
export function rankBetween(
  prev: number | null | undefined,
  next: number | null | undefined
): number {
  if (prev == null && next == null) return RANK_STEP;
  if (prev == null) return (next as number) - RANK_STEP;
  if (next == null) return prev + RANK_STEP;
  return (prev + next) / 2;
}

// Rank for inserting at `index` within an already-ordered list (0 = front,
// ordered.length = back). Does not mutate `ordered`.
export function rankForIndex(
  ordered: { backlog_rank: number | null }[],
  index: number
): number {
  const clamped = Math.max(0, Math.min(index, ordered.length));
  const prev =
    clamped > 0 ? (ordered[clamped - 1].backlog_rank as number) : null;
  const next =
    clamped < ordered.length ? (ordered[clamped].backlog_rank as number) : null;
  return rankBetween(prev, next);
}

export function needsRebalance(
  prev: number | null | undefined,
  next: number | null | undefined
): boolean {
  if (prev == null || next == null) return false;
  return next - prev < MIN_GAP;
}

// Reassigns every rank in `ordered` to a fresh, evenly-spaced sequence
// (RANK_STEP apart), preserving relative order. Returns only the tasks
// whose rank actually changed, so the caller can skip no-op writes.
export function rebalanceRanks<
  T extends { id: Id; backlog_rank: number | null },
>(ordered: T[]): { id: T['id']; backlog_rank: number }[] {
  const updates: { id: T['id']; backlog_rank: number }[] = [];
  ordered.forEach((task, index) => {
    const rank = (index + 1) * RANK_STEP;
    if (task.backlog_rank !== rank) {
      updates.push({ id: task.id, backlog_rank: rank });
    }
  });
  return updates;
}

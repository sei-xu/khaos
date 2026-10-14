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

// Ranks to write after one of today's Marked pills is dropped somewhere in
// the Marked list, so that the list's *displayed* order sticks.
//
// `order` is today's current Marked pills in the new display order (queued
// ones first by rank, then the unqueued ones) and `queue` the global open
// queue, ascending. Position only exists relative to other queued tasks, so
// the moved pill and every unqueued pill above it are placed in the queue,
// in the displayed order; queued pills keep their ranks and pills below the
// drop point are left alone (still unqueued if they were). New ranks are
// slotted immediately after the queued pill above (or just before the first
// queued pill below, or at the end of the queue), never across other tasks,
// so tasks that aren't marked today don't get reordered.
//
// Falls back to a full rebalance of the resulting queue when the gap is too
// small for midpoints.
export function planMarkedReorder(
  queue: { id: Id; backlog_rank: number | null }[],
  order: { id: Id; backlog_rank: number | null }[],
  movedId: Id
): { id: Id; backlog_rank: number }[] {
  const movedIndex = order.findIndex((t) => t.id === movedId);
  if (movedIndex === -1) return [];

  const assignIds = new Set(
    order
      .filter(
        (t, i) =>
          i <= movedIndex && (t.id === movedId || t.backlog_rank === null)
      )
      .map((t) => t.id)
  );
  // The queue minus the pills being (re)placed, still ascending.
  const rest = queue.filter((t) => !assignIds.has(t.id));

  const writes: { id: Id; backlog_rank: number }[] = [];
  const placements: {
    anchorId: Id | null;
    beforeId: Id | null;
    run: { id: Id; backlog_rank: number | null }[];
  }[] = [];
  let tooTight = false;

  let i = 0;
  while (i <= movedIndex) {
    if (!assignIds.has(order[i].id)) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 <= movedIndex && assignIds.has(order[j + 1].id)) j++;
    const run = order.slice(i, j + 1);
    const m = run.length;
    const anchor = i > 0 ? order[i - 1] : null;
    const below = order
      .slice(j + 1)
      .find((t) => t.backlog_rank !== null && !assignIds.has(t.id));

    let lo: number;
    let hi: number;
    if (anchor) {
      lo = anchor.backlog_rank as number;
      const next = rest.find((t) => (t.backlog_rank as number) > lo);
      hi = next ? (next.backlog_rank as number) : lo + RANK_STEP * (m + 1);
    } else if (below) {
      hi = below.backlog_rank as number;
      const prev = [...rest]
        .reverse()
        .find((t) => (t.backlog_rank as number) < hi);
      lo = prev ? (prev.backlog_rank as number) : hi - RANK_STEP * (m + 1);
    } else {
      lo = rest.length ? (rest[rest.length - 1].backlog_rank as number) : 0;
      hi = lo + RANK_STEP * (m + 1);
    }

    const gap = (hi - lo) / (m + 1);
    if (gap < MIN_GAP) tooTight = true;
    run.forEach((t, k) =>
      writes.push({ id: t.id, backlog_rank: lo + gap * (k + 1) })
    );
    placements.push({
      anchorId: anchor ? anchor.id : null,
      beforeId: !anchor && below ? below.id : null,
      run,
    });
    i = j + 1;
  }

  if (!tooTight) return writes;

  const final = [...rest];
  for (const { anchorId, beforeId, run } of placements) {
    const at = anchorId
      ? final.findIndex((t) => t.id === anchorId) + 1
      : beforeId
        ? final.findIndex((t) => t.id === beforeId)
        : final.length;
    final.splice(at, 0, ...run);
  }
  return rebalanceRanks(final);
}

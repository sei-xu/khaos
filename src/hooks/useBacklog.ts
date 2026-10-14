// The backlog queue (tasks.backlog_rank) is derived straight from the
// ['tasks'] cache that useTasks() already owns — no separate query, so a
// reorder here and an edit from the Tasks/Dashboard pages never disagree.
import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backlogApi } from '../lib/api/backlog';
import {
  needsRebalance,
  orderByRank,
  rankForIndex,
  rebalanceRanks,
} from '../lib/backlogRank';
import { OPEN_STATUSES } from '../lib/constants';
import { useTasks } from './useHierarchy';
import type { Id, Task } from '../lib/types';

// The queue is the *open* ranked tasks — this is the single definition of
// "in the backlog" that Today's position badge, the Backlog view and
// `reorder` all share, so they always number and rebalance the same list.
// A task that's done/cancelled can keep a stale backlog_rank in the DB; it's
// simply not part of the queue (and reappears at its old rank if reopened).
// Memoized on the react-query cache so consumers get a stable identity.
export function useBacklogTasks(): Task[] {
  const { data: tasks } = useTasks();
  return useMemo(
    () =>
      orderByRank(
        (tasks ?? []).filter(
          (t) => t.deleted_at === null && OPEN_STATUSES.includes(t.status)
        )
      ),
    [tasks]
  );
}

// 1-based position of a task in the open backlog queue, or null when it
// isn't in it. Same numbering as the Backlog view and Today's rank badge.
export function useBacklogPosition(taskId: Id): number | null {
  const queue = useBacklogTasks();
  const index = queue.findIndex((t) => t.id === taskId);
  return index === -1 ? null : index + 1;
}

export function useBacklogMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['tasks'] });

  const add = useMutation({
    mutationFn: (taskId: Id) => backlogApi.add(taskId),
    onSuccess: invalidate,
  });

  const removeFromBacklog = useMutation({
    mutationFn: (taskId: Id) => backlogApi.removeFromBacklog(taskId),
    onSuccess: invalidate,
  });

  // Moves `taskId` to `targetIndex` within the already-ordered backlog
  // list. `ordered` must be the whole queue (useBacklogTasks, already
  // moved) — never a filtered/partial subset — so the new rank is always
  // unique across the queue and a rebalance never skews ranks outside the
  // subset. Writes one row (the moved task's new rank); if that collapses
  // the gap to a neighbor, rebalances the whole queue to evenly-spaced
  // ranks in a follow-up batch write.
  const reorder = useMutation({
    mutationFn: async ({
      taskId,
      targetIndex,
      ordered,
    }: {
      taskId: Id;
      targetIndex: number;
      ordered: Task[];
    }) => {
      const withoutMoved = ordered.filter((t) => t.id !== taskId);
      const rank = rankForIndex(withoutMoved, targetIndex);
      await backlogApi.move(taskId, rank);

      const prev = withoutMoved[targetIndex - 1]?.backlog_rank;
      const next = withoutMoved[targetIndex]?.backlog_rank;
      if (needsRebalance(prev, rank) || needsRebalance(rank, next)) {
        const resorted = [...withoutMoved];
        resorted.splice(targetIndex, 0, {
          ...ordered.find((t) => t.id === taskId)!,
          backlog_rank: rank,
        });
        const updates = rebalanceRanks(resorted);
        if (updates.length) await backlogApi.rebalance(updates);
      }
    },
    onSuccess: invalidate,
  });

  return { add, removeFromBacklog, reorder };
}

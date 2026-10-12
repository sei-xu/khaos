// The backlog queue (tasks.backlog_rank) is derived straight from the
// ['tasks'] cache that useTasks() already owns — no separate query, so a
// reorder here and an edit from the Tasks/Dashboard pages never disagree.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { backlogApi } from '../lib/api/backlog';
import {
  needsRebalance,
  orderByRank,
  rankForIndex,
  rebalanceRanks,
} from '../lib/backlogRank';
import { useTasks } from './useHierarchy';
import type { Id, Task } from '../lib/types';

export function useBacklogTasks(): Task[] {
  const { data: tasks = [] } = useTasks();
  return orderByRank(tasks.filter((t) => t.deleted_at === null));
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

  // Writes an already-computed rank directly, with no rebalance pass.
  // Used by callers that only know a local neighborhood (e.g. the Today
  // page's Marked group, whose visible neighbors are a subset of the full
  // backlog queue) — rebalancing from a subset's positions would stomp on
  // the ranks of backlog tasks outside that subset, so only `reorder`
  // below (which sees the whole queue) is allowed to rebalance.
  const move = useMutation({
    mutationFn: ({ taskId, rank }: { taskId: Id; rank: number }) =>
      backlogApi.move(taskId, rank),
    onSuccess: invalidate,
  });

  // Moves `taskId` to `targetIndex` within the already-ordered backlog
  // list. Writes one row (the moved task's new rank); if that collapses
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

  return { add, removeFromBacklog, move, reorder };
}

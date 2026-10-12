// tasks.backlog_rank: the global, persisted "order in which pending tasks
// will be done" — a plain numeric rank, not a linked list (see the comment
// on src/lib/api/sequence.ts for why tasks_sequence can't be reused for
// this). NULL means the task isn't in the backlog queue. These are plain
// updates on the tasks table — no dedicated backlog table, no RLS changes.
import { supabase } from '../supabaseClient';
import { RANK_STEP, orderByRank } from '../backlogRank';
import type { Id, Task } from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export const backlogApi = {
  // Appends a task to the end of the queue, using the current max rank.
  add: async (taskId: Id): Promise<Task> => {
    const maxResponse = await supabase
      .from('tasks')
      .select('backlog_rank')
      .not('backlog_rank', 'is', null)
      .order('backlog_rank', { ascending: false })
      .limit(1);
    const rows = unwrap(maxResponse) as { backlog_rank: number | null }[];
    const maxRank = rows[0]?.backlog_rank ?? 0;

    const response = await supabase
      .from('tasks')
      .update({ backlog_rank: maxRank + RANK_STEP })
      .eq('id', taskId)
      .select()
      .single();
    return unwrap(response);
  },

  // Writes a new rank for an already-queued task (the caller computes it
  // via rankBetween/rankForIndex from backlogRank.ts).
  move: async (taskId: Id, rank: number): Promise<Task> => {
    const response = await supabase
      .from('tasks')
      .update({ backlog_rank: rank })
      .eq('id', taskId)
      .select()
      .single();
    return unwrap(response);
  },

  removeFromBacklog: async (taskId: Id): Promise<Task> => {
    const response = await supabase
      .from('tasks')
      .update({ backlog_rank: null })
      .eq('id', taskId)
      .select()
      .single();
    return unwrap(response);
  },

  // Rewrites backlog_rank for every row in `updates` (already computed by
  // rebalanceRanks) in one batch of per-row updates.
  rebalance: async (
    updates: { id: Id; backlog_rank: number }[]
  ): Promise<void> => {
    const responses = await Promise.all(
      updates.map(({ id, backlog_rank }) =>
        supabase.from('tasks').update({ backlog_rank }).eq('id', id)
      )
    );
    responses.forEach((response) => unwrap(response));
  },

  listOrdered: async (): Promise<Task[]> => {
    const response = await supabase
      .from('tasks')
      .select('*')
      .is('deleted_at', null)
      .not('backlog_rank', 'is', null);
    return orderByRank(unwrap(response));
  },
};

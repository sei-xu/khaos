import { supabase } from '../supabaseClient';
import { todayDateStringInTz } from '../timezone';
import type { Id, Moment } from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export type EntityRef = Record<string, Id>;

export const momentsApi = {
  listForEntity: async (entityRef: EntityRef): Promise<Moment[]> => {
    let query = supabase.from('moments').select('*');
    for (const [column, value] of Object.entries(entityRef)) {
      query = query.eq(column, value);
    }
    const response = await query.order('created_at', { ascending: false });
    return unwrap(response);
  },

  addNote: async (entityRef: EntityRef, note: string): Promise<Moment> => {
    const response = await supabase
      .from('moments')
      .insert({
        ...entityRef,
        moment_type: 'note',
        moment_note: note,
      })
      .select()
      .single();
    return unwrap(response);
  },

  // Latest 'status' moment timestamp per task, used to fade/hide settled
  // tasks in infinite sections based on how long ago they were done/cancelled.
  latestTaskStatusChanges: async (): Promise<Map<Id, string>> => {
    const response = await supabase
      .from('moments')
      .select('task_id, created_at')
      .eq('moment_type', 'status')
      .not('task_id', 'is', null)
      .order('created_at', { ascending: false });
    const rows = unwrap(response) as { task_id: Id; created_at: string }[];
    const latest = new Map<Id, string>();
    for (const row of rows) {
      if (!latest.has(row.task_id)) latest.set(row.task_id, row.created_at);
    }
    return latest;
  },

  // Marks a task "for today" (or any future date for planning ahead) by
  // appending a 'today' moment — never updates/deletes, so remarking after
  // an unmark just adds another entry (and grows the mark count).
  markForDay: async (taskId: Id, date: string = todayDateStringInTz()): Promise<Moment> => {
    const response = await supabase
      .from('moments')
      .insert({ task_id: taskId, moment_type: 'today', value: date })
      .select()
      .single();
    return unwrap(response);
  },

  unmarkForDay: async (taskId: Id, date: string = todayDateStringInTz()): Promise<Moment> => {
    const response = await supabase
      .from('moments')
      .insert({ task_id: taskId, moment_type: 'notToday', value: date })
      .select()
      .single();
    return unwrap(response);
  },

  // Task ids currently marked for `date` (default: today) — the latest
  // 'today'/'notToday' moment per task for that date decides the state.
  taskIdsMarkedForDay: async (date: string = todayDateStringInTz()): Promise<Set<Id>> => {
    const response = await supabase
      .from('moments')
      .select('task_id, moment_type, created_at')
      .in('moment_type', ['today', 'notToday'])
      .eq('value', date)
      .not('task_id', 'is', null)
      .order('created_at', { ascending: false });
    const rows = unwrap(response) as {
      task_id: Id;
      moment_type: 'today' | 'notToday';
      created_at: string;
    }[];
    const marked = new Set<Id>();
    const seen = new Set<Id>();
    for (const row of rows) {
      if (seen.has(row.task_id)) continue;
      seen.add(row.task_id);
      if (row.moment_type === 'today') marked.add(row.task_id);
    }
    return marked;
  },

  // Task ids whose *most recent* today/notToday moment (any date) still
  // resolves to marked, but for a date strictly before `beforeDate` — i.e.
  // tasks left marked on a past day and never explicitly unmarked or
  // re-marked for today. Used to fade-show stale "Marked" pills.
  taskIdsMarkedPast: async (beforeDate: string = todayDateStringInTz()): Promise<Set<Id>> => {
    const response = await supabase
      .from('moments')
      .select('task_id, moment_type, value, created_at')
      .in('moment_type', ['today', 'notToday'])
      .not('task_id', 'is', null)
      .order('created_at', { ascending: false });
    const rows = unwrap(response) as {
      task_id: Id;
      moment_type: 'today' | 'notToday';
      value: string;
      created_at: string;
    }[];
    const past = new Set<Id>();
    const seen = new Set<Id>();
    for (const row of rows) {
      if (seen.has(row.task_id)) continue;
      seen.add(row.task_id);
      if (row.moment_type === 'today' && row.value < beforeDate) {
        past.add(row.task_id);
      }
    }
    return past;
  },

  remove: async (id: Id): Promise<Moment> => {
    const response = await supabase
      .from('moments')
      .delete()
      .eq('id', id)
      .select()
      .single();
    return unwrap(response);
  },
};

import { materializeRoutines } from '../routines/materialize.ts';
import {
  DEFAULT_ROUTINE_TIMEZONE,
  localDayStart,
} from '../routines/occurrences.ts';
import { supabase } from '../supabaseClient';
import type {
  Event,
  Id,
  NewRoutine,
  Routine,
  RoutinePatch,
  RoutineWithField,
} from '../types';

function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
  if (error) throw error;
  return data as T;
}

export interface ListWithEventsResult {
  routines: Routine[];
  events: Event[];
}

export const routinesApi = {
  list: async (): Promise<RoutineWithField[]> => {
    const response = await supabase
      .from('routines')
      .select('*, fields(name)')
      .order('name');
    return unwrap(response);
  },

  create: async (payload: NewRoutine): Promise<Routine> => {
    const response = await supabase
      .from('routines')
      .insert(payload)
      .select()
      .single();
    return unwrap(response);
  },

  update: async (id: Id, patch: RoutinePatch): Promise<Routine> => {
    const response = await supabase
      .from('routines')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    const routine = unwrap(response);
    // trg_routine_deactivated soft-deletes the edited routine's upcoming
    // occurrences immediately but doesn't regenerate them — that's left to
    // the next materialization. Without this, the agenda (and Google, via
    // trg_google_sync_dirty) goes empty for this routine until the next
    // cron tick, up to ~a day later. Rematerialize right away instead of
    // scheduling anything new: the same read-plan-insert logic the cron and
    // materialize_routines already share (src/lib/routines/materialize.ts)
    // runs isomorphically in the browser.
    await materializeRoutines(supabase, {
      from: localDayStart(new Date(), DEFAULT_ROUTINE_TIMEZONE),
      to: localDayStart(
        new Date(Date.now() + 7 * 86400000),
        DEFAULT_ROUTINE_TIMEZONE
      ),
      timeZone: DEFAULT_ROUTINE_TIMEZONE,
    });
    return routine;
  },

  remove: async (id: Id): Promise<Routine> => {
    const response = await supabase
      .from('routines')
      .delete()
      .eq('id', id)
      .select()
      .single();
    return unwrap(response);
  },

  listWithEvents: async (
    weekStart: Date,
    weekEnd: Date
  ): Promise<ListWithEventsResult> => {
    const [routinesResult, eventsResult] = await Promise.all([
      supabase.from('routines').select('*').eq('active', true),
      supabase
        .from('events')
        .select('*')
        .eq('event_type', 'routine')
        .gte('duration', `[${weekStart.toISOString()},`)
        .lte('duration', `[,${weekEnd.toISOString()})`),
    ]);
    return {
      routines: unwrap<Routine[]>(routinesResult),
      events: unwrap<Event[]>(eventsResult),
    };
  },
};

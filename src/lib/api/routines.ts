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

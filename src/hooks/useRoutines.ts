import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { routinesApi } from '../lib/api/routines';
import {
  defaultWindow,
  materializeRoutines,
} from '../lib/routines/materialize.ts';
import { DEFAULT_ROUTINE_TIMEZONE } from '../lib/routines/occurrences.ts';
import { supabase } from '../lib/supabaseClient';
import type { Id, RoutinePatch, NewRoutine } from '../lib/types';

// Patch keys trg_routine_deactivated (20261025000000_routine_occurrences.sql,
// 20261105010000_routine_soft_delete_tombstone.sql) actually reacts to by
// dropping and freeing the routine's not-yet-started occurrences. Keep this
// in sync with that trigger: any other patch (a rename, a field/task swap,
// an active false->true) leaves the materialized week untouched, so
// rematerializing for it is pure waste.
const REMATERIALIZE_KEYS = [
  'frequency',
  'preferred_time',
  'estimate',
  'active',
];

// trg_routine_deactivated's soft-delete (on deactivation or on an edit of
// frequency/preferred_time/estimate) drops the routine's not-yet-started
// occurrences immediately but doesn't regenerate them — that's left to the
// next materialization. Without this, the agenda (and Google, via
// trg_google_sync_dirty) goes empty for the routine until the next cron
// tick, up to ~a day later. Rematerialize right away instead, as an effect
// independent of the save itself: the same read-plan-insert logic the cron
// and materialize_routines already share (src/lib/routines/materialize.ts)
// runs isomorphically in the browser. Errors here (network, RLS, a CHECK
// violation) are swallowed rather than surfaced — a save that already
// committed must not look like it failed just because the catch-up
// materialization didn't.
function rematerialize() {
  materializeRoutines(supabase, {
    ...defaultWindow(DEFAULT_ROUTINE_TIMEZONE),
    timeZone: DEFAULT_ROUTINE_TIMEZONE,
  }).catch((error: unknown) => {
    console.error('rematerialize after routine save failed', error);
  });
}

export function useRoutines() {
  return useQuery({ queryKey: ['routines'], queryFn: routinesApi.list });
}

export function useRoutineMutations() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['routines'] });
  return {
    create: useMutation({
      mutationFn: (payload: NewRoutine) => routinesApi.create(payload),
      onSuccess: () => {
        invalidate();
        rematerialize();
      },
    }),
    update: useMutation({
      mutationFn: ({ id, patch }: { id: Id; patch: RoutinePatch }) =>
        routinesApi.update(id, patch),
      onSuccess: (_data, { patch }) => {
        invalidate();
        if (REMATERIALIZE_KEYS.some((key) => key in patch)) rematerialize();
      },
    }),
  };
}

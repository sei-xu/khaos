// The DB half of routine materialization: read the active routine
// templates, read what's already on the calendar, ask the pure scheduler
// (./occurrences) what should exist, and insert what's missing.
//
// Lives here, next to the pure logic, because two callers run exactly this
// sequence and must not drift: the daily cron
// (supabase/functions/routine-events) and the materialize_routines
// assistant tool (src/lib/chat/toolsCore.ts). Sharing plannedOccurrences
// alone wasn't enough — the lookback window, the de-dup handling and the
// insert payload are just as much part of "what materializing means".
//
// Import-light on purpose (a type-only Supabase import and a pure sibling),
// so it bundles the same way for the browser and for Deno. The sibling is
// imported WITH its '.ts' extension, like every other import Deno reaches
// in this repo (see supabase/functions/_shared/khaos.ts): plain Deno
// resolution does no extension guessing, so './occurrences' only resolves
// here by accident of the repo root's package.json putting these files in
// a Node resolution scope. tsconfig's allowImportingTsExtensions keeps the
// browser/Vite side happy with the explicit form.
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  localDateString,
  localNoon,
  plannedOccurrences,
  type ExistingOccurrence,
  type PlannedOccurrence,
  type RoutineInput,
  type RoutineStatus,
} from './occurrences.ts';

// How far back to look for a 'skipped' occurrence that still owes a makeup
// — generous enough to cover a routine whose makeup week (see
// occurrences.ts) started just before the window opens.
export const LOOKBACK_DAYS = 14;

const ROUTINE_COLUMNS =
  'id,name,frequency,preferred_time,estimate,active,task_id,field_id';

export interface MaterializeOptions {
  from: Date;
  to: Date;
  timeZone: string;
  // Called instead of throwing when an insert fails for anything other than
  // the de-dup unique violation. The cron uses it to log and keep going;
  // the assistant tool leaves it unset so the failure surfaces to the model.
  onInsertError?: (occurrence: PlannedOccurrence, message: string) => void;
}

export interface MaterializeResult {
  created: number;
  skipped: number;
  errors: number;
  total_planned: number;
}

// tstzrange text -> lower bound Date. A miniature of
// supabase/functions/_shared/range.ts's parseRangeLower, duplicated rather
// than imported: that module lives under supabase/functions, outside src,
// so the browser bundle can't reach it.
function parseDurationLowerBound(raw: string | null): Date | null {
  if (!raw) return null;
  const match = raw.match(/^[[(]\s*"?([^",]+?)"?\s*,/);
  if (!match) return null;
  const s = match[1]
    .trim()
    .replace(' ', 'T')
    .replace(/([+-]\d{2})$/, '$1:00');
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function rangeLiteral(start: Date, end: Date): string {
  return `["${start.toISOString()}","${end.toISOString()}")`;
}

export async function materializeRoutines(
  db: SupabaseClient,
  { from, to, timeZone, onInsertError }: MaterializeOptions
): Promise<MaterializeResult> {
  const empty = { created: 0, skipped: 0, errors: 0, total_planned: 0 };

  const { data: routineRows, error: routinesError } = await db
    .from('routines')
    .select(ROUTINE_COLUMNS)
    .eq('active', true);
  if (routinesError)
    throw new Error(`routines query failed: ${routinesError.message}`);

  const routines = (routineRows ?? []) as RoutineInput[];
  if (!routines.length) return empty;

  const lookback = new Date(from.getTime() - LOOKBACK_DAYS * 86400000);
  // No event_type filter: a Google pull promotes a routine occurrence to
  // event_type='fixed' while keeping routine_id (google-calendar-sync's
  // pull handler) to preserve the user's edit, and that row must still
  // count as "this routine's occurrence for its day" here — otherwise this
  // query and idx_events_routine_dedup disagree on what's materialized and
  // the generator recreates an occurrence the user already moved.
  //
  // Two windows, merged by id. The occurrence's own `duration` is what the
  // user sees, but Google can rewrite it to another day, so the row is ALSO
  // looked up by `routine_day` (the day the generator planned it for, never
  // touched by the sync): a Tuesday occurrence dragged to next week still
  // stands in for Tuesday here.
  //
  // Both are upper-bounded by `to`: without it, every call reads every
  // future routine occurrence ever materialized, no matter how far out. The
  // cron only asks for +7d so this doesn't bite today, but
  // materialize_routines (src/lib/chat/toolsCore.ts) accepts an arbitrary
  // `to`, and none of the rows at or past it feed either use of `existing`
  // below. tstzrange orders by lower bound, so the duration cut is on
  // occurrence start, not end.
  const routineIds = routines.map((r) => r.id);
  const eventColumns = 'id,routine_id,duration,routine_status,routine_day';
  const [byDuration, byDay] = await Promise.all([
    db
      .from('events')
      .select(eventColumns)
      .is('deleted_at', null)
      .in('routine_id', routineIds)
      .gte('duration', `[${lookback.toISOString()},)`)
      .lt('duration', `[${to.toISOString()},)`),
    db
      .from('events')
      .select(eventColumns)
      .is('deleted_at', null)
      .in('routine_id', routineIds)
      .gte('routine_day', localDateString(lookback, timeZone))
      .lte('routine_day', localDateString(to, timeZone)),
  ]);
  if (byDuration.error)
    throw new Error(
      `existing events query failed: ${byDuration.error.message}`
    );
  if (byDay.error)
    throw new Error(`existing events query failed: ${byDay.error.message}`);

  type EventRow = {
    id: string;
    routine_id: string | null;
    duration: string | null;
    routine_status: RoutineStatus | null;
    routine_day: string | null;
  };
  const rows = new Map<string, EventRow>();
  for (const row of [
    ...((byDuration.data ?? []) as EventRow[]),
    ...((byDay.data ?? []) as EventRow[]),
  ])
    rows.set(row.id, row);

  // `existing` feeds the pure scheduler, which only reads the LOCAL DAY of
  // `start`; for a row with a routine_day that day is the planned one, not
  // wherever Google moved the event, so anchor `start` there. Rows without
  // one (not produced by the generator) fall back to their own duration.
  // `existingKeys` is the de-dup set, keyed on that same planned day.
  const existing: ExistingOccurrence[] = [];
  const existingKeys = new Set<string>();
  for (const row of rows.values()) {
    if (!row.routine_id) continue;
    const start =
      (row.routine_day && localNoon(row.routine_day, timeZone)) ||
      parseDurationLowerBound(row.duration);
    if (!start) continue;
    existing.push({
      routine_id: row.routine_id,
      start,
      status: row.routine_status,
    });
    existingKeys.add(
      `${row.routine_id}|${row.routine_day ?? localDateString(start, timeZone)}`
    );
  }

  const planned = plannedOccurrences(routines, from, to, timeZone, existing);

  // Everything idx_events_routine_dedup could conflict with is already in
  // `existingKeys` (it covers the same rows, from a wider window than the
  // one planned here), so an occurrence we already read back needs no insert
  // attempt at all. On a rolling re-run most of the window is in exactly
  // that state, and the 23505 round-trip per occurrence was pure waste.
  // The unique index still backstops a concurrent run, below.
  //
  // Keyed by planned day (routine_day), not by `duration`: Google can move
  // an occurrence within its day or to another day, and that moved row must
  // still count as "this routine's occurrence for the day it was planned
  // for" rather than freeing the slot for the generator to recreate.
  const dayKey = (occ: PlannedOccurrence) =>
    `${occ.routine_id}|${localDateString(occ.start, timeZone)}`;

  let created = 0;
  let skipped = 0;
  let errors = 0;
  const toInsert: PlannedOccurrence[] = [];
  for (const occ of planned) {
    if (existingKeys.has(dayKey(occ))) {
      skipped++;
      continue;
    }
    toInsert.push(occ);
  }

  const eventRow = (occ: PlannedOccurrence) => ({
    name: occ.name,
    event_type: 'routine',
    routine_id: occ.routine_id,
    task_id: occ.task_id,
    field_id: occ.field_id,
    duration: rangeLiteral(occ.start, occ.end),
    // The day this occurrence is planned for: the de-dup key, immune to
    // Google later rewriting `duration`.
    routine_day: localDateString(occ.start, timeZone),
  });

  // Fast path: insert everything the filter above left in one round trip.
  // The only reason a batch insert fails as a whole is a conflict with
  // another concurrent run (23505) — on that path alone, fall back to the
  // original one-by-one loop so idx_events_routine_dedup's per-row conflicts
  // still resolve individually instead of discarding the whole batch.
  if (toInsert.length) {
    const { error } = await db.from('events').insert(toInsert.map(eventRow));
    if (!error) {
      created += toInsert.length;
    } else if ((error as { code?: string }).code === '23505') {
      for (const occ of toInsert) {
        const { error: rowError } = await db
          .from('events')
          .insert(eventRow(occ));
        if (!rowError) {
          created++;
        } else if ((rowError as { code?: string }).code === '23505') {
          skipped++; // idx_events_routine_dedup — already materialized
        } else if (onInsertError) {
          onInsertError(occ, rowError.message);
          errors++;
        } else {
          throw new Error(rowError.message);
        }
      }
    } else if (onInsertError) {
      for (const occ of toInsert) onInsertError(occ, error.message);
      errors += toInsert.length;
    } else {
      throw new Error(error.message);
    }
  }

  return { created, skipped, errors, total_planned: planned.length };
}

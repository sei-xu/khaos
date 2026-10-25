// Materializes routine templates (public.routines) into calendar
// occurrences (public.events, event_type='routine') — see
// src/lib/routines/occurrences.ts for the (pure, DB-free) scheduling logic
// this function is a thin wrapper around, and docs/backlog.md, "Rotinas
// devem ser criadas por cron/assistente e devem entrar no resumo diário
// matinal" for why this exists: `routines` had full CRUD but nothing ever
// generated the events it's supposed to produce.
//
// Cron-invoked (same X-Khaos-Cron-Secret / KHAOS_CRON_SECRET pattern as
// telegram-notify/oversight-agent/google-calendar-sync), never by a
// browser — see supabase/config.toml. Also callable on demand via the
// materialize_routines assistant tool (src/lib/chat/toolsCore.ts), which
// imports plannedOccurrences directly rather than invoking this function —
// the tool runs inside the already-authenticated chat agent, so there's no
// need to round-trip through another cron-secret-gated endpoint.
//
// Always regenerates "today through +7 days": wide enough to give the
// coming week's calendar presence (prompts.ts asks the assistant to plan
// the week ahead) without accumulating months of speculative occurrences.
// Re-running over the same window is safe — idx_events_routine_dedup
// (20261025000000_routine_occurrences.sql) makes (routine_id,
// lower(duration)) unique, and this function treats a 23505 on insert as
// "already there", not an error.
//
// Scheduled 07:45 local (10:45 UTC, America/Sao_Paulo has no DST) — before
// telegram-notify's 08:00 digest, so the digest's "rotinas de hoje" section
// finds today's occurrences already in place.
//
// Deploy:
//   supabase functions deploy routine-events
// One-time manual cron wiring (SQL editor — mirrors
// supabase/functions/telegram-bot/README.md's pattern; skip the two
// `create extension` lines if another function's cron setup already ran
// them):
//
//   select cron.schedule('routine-events-tick', '45 10 * * *', $$
//     select net.http_post(
//       url     := 'https://<project-ref>.supabase.co/functions/v1/routine-events',
//       headers := jsonb_build_object(
//                    'Content-Type', 'application/json',
//                    'X-Khaos-Cron-Secret', '<KHAOS_CRON_SECRET>'),
//       body    := '{}'::jsonb
//     );
//   $$);

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  plannedOccurrences,
  type ExistingOccurrence,
  type RoutineInput,
  type RoutineStatus,
} from '../../../src/lib/routines/occurrences.ts';
import { parseRangeLower, rangeLiteral } from '../_shared/range.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('KHAOS_CRON_SECRET') ?? '';
// Brazil has had no DST since 2019 — same fixed-offset assumption
// telegram-notify and google-calendar-sync already make.
const TIMEZONE = Deno.env.get('KHAOS_TIMEZONE') ?? 'America/Sao_Paulo';
const WINDOW_DAYS = 7;
// How far back to look for a 'skipped' occurrence that still owes a
// makeup — generous enough to cover a routine whose makeup window (its ISO
// week, see occurrences.ts) started just before this window opens.
const LOOKBACK_DAYS = 14;

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

interface RoutineRow {
  id: string;
  name: string;
  frequency: string;
  preferred_time: string | null;
  estimate: number | null;
  active: boolean;
  task_id: string | null;
  field_id: string | null;
}

interface EventRow {
  routine_id: string | null;
  duration: string | null;
  routine_status: RoutineStatus | null;
}

function localMidnight(daysFromNow: number): Date {
  // Approximate "now" in the configured timezone, then snap to that day's
  // local midnight. Good enough for a 7-day generation window — a few
  // hours of error around "now" never changes which calendar day this is.
  const now = new Date(Date.now() + daysFromNow * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  // Reuse the same UTC-instant-then-offset-correct trick occurrences.ts
  // uses internally, rather than duplicating it: build a UTC guess at
  // local midnight and adjust by the zone's offset at that guess.
  const guess = new Date(
    Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day))
  );
  const offsetParts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIMEZONE,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(guess);
  const offsetMap: Record<string, string> = {};
  for (const p of offsetParts)
    if (p.type !== 'literal') offsetMap[p.type] = p.value;
  const hour = offsetMap.hour === '24' ? 0 : Number(offsetMap.hour);
  const asLocal = Date.UTC(
    Number(offsetMap.year),
    Number(offsetMap.month) - 1,
    Number(offsetMap.day),
    hour,
    Number(offsetMap.minute)
  );
  const offsetMinutes = (asLocal - guess.getTime()) / 60000;
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

async function runOnce(): Promise<{
  created: number;
  skipped: number;
  errors: number;
}> {
  const from = localMidnight(0);
  const to = localMidnight(WINDOW_DAYS);
  const lookback = localMidnight(-LOOKBACK_DAYS);

  const { data: routineRows, error: routinesError } = await db
    .from('routines')
    .select('id,name,frequency,preferred_time,estimate,active,task_id,field_id')
    .eq('active', true);
  if (routinesError)
    throw new Error(`routines query failed: ${routinesError.message}`);

  const routines: RoutineInput[] = (routineRows ?? []) as RoutineRow[];
  if (!routines.length) return { created: 0, skipped: 0, errors: 0 };

  const routineIds = routines.map((r) => r.id);
  const { data: eventRows, error: eventsError } = await db
    .from('events')
    .select('routine_id,duration,routine_status')
    .eq('event_type', 'routine')
    .is('deleted_at', null)
    .in('routine_id', routineIds)
    .gte('duration', `[${lookback.toISOString()},)`);
  if (eventsError)
    throw new Error(`existing events query failed: ${eventsError.message}`);

  const existing: ExistingOccurrence[] = [];
  for (const row of (eventRows ?? []) as EventRow[]) {
    if (!row.routine_id) continue;
    const start = parseRangeLower(row.duration);
    if (!start) continue;
    existing.push({
      routine_id: row.routine_id,
      start,
      status: row.routine_status,
    });
  }

  const occurrences = plannedOccurrences(
    routines,
    from,
    to,
    TIMEZONE,
    existing
  );

  let created = 0;
  let skipped = 0;
  let errors = 0;
  for (const occ of occurrences) {
    const { error } = await db.from('events').insert({
      name: occ.name,
      event_type: 'routine',
      routine_id: occ.routine_id,
      task_id: occ.task_id,
      field_id: occ.field_id,
      duration: rangeLiteral(occ.start, occ.end),
    });
    if (!error) {
      created++;
    } else if (error.code === '23505') {
      // idx_events_routine_dedup — already materialized, not a failure.
      skipped++;
    } else {
      console.error(
        'routine-events insert failed',
        occ.routine_id,
        error.message
      );
      errors++;
    }
  }

  return { created, skipped, errors };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const presented = req.headers.get('x-khaos-cron-secret') ?? '';
  if (!CRON_SECRET || presented !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const work = runOnce()
    .then((result) => console.warn('routine-events run', result))
    .catch((err) => console.error('routine-events run failed', err));

  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }
  ).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    await work;
  }

  return new Response('ok', { status: 200 });
});

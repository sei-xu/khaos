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
import { materializeRoutines } from '../../../src/lib/routines/materialize.ts';
import { localDayStart } from '../../../src/lib/routines/occurrences.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('KHAOS_CRON_SECRET') ?? '';
// Brazil has had no DST since 2019 — same fixed-offset assumption
// telegram-notify and google-calendar-sync already make.
const TIMEZONE = Deno.env.get('KHAOS_TIMEZONE') ?? 'America/Sao_Paulo';
const WINDOW_DAYS = 7;

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// Local midnight `daysFromNow` days out. A few hours of error around "now"
// never changes which calendar day this is, so approximating the instant
// before snapping it to the zone's day start is good enough for a 7-day
// generation window.
function localMidnight(daysFromNow: number): Date {
  return localDayStart(new Date(Date.now() + daysFromNow * 86400000), TIMEZONE);
}

// The read-plan-insert sequence itself lives in src/lib/routines/materialize.ts,
// shared with the materialize_routines assistant tool so the two can't drift
// on the lookback window, the de-dup handling or the insert payload.
function runOnce() {
  return materializeRoutines(db, {
    from: localMidnight(0),
    to: localMidnight(WINDOW_DAYS),
    timeZone: TIMEZONE,
    onInsertError: (occ, message) =>
      console.error('routine-events insert failed', occ.routine_id, message),
  });
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

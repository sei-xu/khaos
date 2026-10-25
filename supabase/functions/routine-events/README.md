# routine-events

Materializes `routines` templates into real calendar occurrences
(`events`, `event_type='routine'`). Before this function existed, `routines`
had full CRUD in the app but nothing ever generated the events the rest of
the system (CalendarPage, the Google sync, the morning digest) was already
built to read.

The scheduling logic itself — what "3x_week" or "2x_month" means, which
local time a routine starts at, how a skipped habit gets a makeup — lives in
`src/lib/routines/occurrences.ts`, a pure, DB-free module with its own test
suite (`occurrences.test.ts`). This function, and the assistant's
`materialize_routines` tool, are both thin callers of the same logic so they
can never drift apart.

## Setup

1. **Apply the migration** (adds `events.routine_status`, the
   `idx_events_routine_dedup` unique index, and the deactivate-soft-delete
   trigger):

   ```bash
   npm run db:push
   ```

2. **Deploy:**

   ```bash
   supabase functions deploy routine-events
   ```

   No new secrets — it reuses `KHAOS_CRON_SECRET` (already set if
   `telegram-notify` is deployed). Optionally override the timezone (default
   `America/Sao_Paulo`):

   ```bash
   supabase secrets set KHAOS_TIMEZONE=America/Sao_Paulo
   ```

3. **Wire the cron** (SQL editor — skip the two `create extension` lines if
   another function's cron setup already ran them; mirrors
   `supabase/functions/telegram-bot/README.md`'s pattern). Scheduled at
   07:45 local (10:45 UTC), 15 minutes before `telegram-notify`'s 08:00
   digest, so the digest's "rotinas de hoje" section finds today's
   occurrences already in place:

   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;

   select cron.schedule('routine-events-tick', '45 10 * * *', $$
     select net.http_post(
       url     := 'https://<project-ref>.supabase.co/functions/v1/routine-events',
       headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'X-Khaos-Cron-Secret', '<KHAOS_CRON_SECRET>'),
       body    := '{}'::jsonb
     );
   $$);
   ```

## What it does each run

- Loads every active routine and, for dedup/makeup purposes, every
  non-deleted `event_type='routine'` row for those routines from the last 14
  days.
- Calls `plannedOccurrences(routines, today, today+7days, timezone, existing)`.
- Inserts whatever that returns, treating a unique-violation (23505, from
  `idx_events_routine_dedup`) as "already materialized" rather than an
  error — safe to re-run, safe to overlap with a manual
  `materialize_routines` tool call.

Deactivating a routine (`active: true -> false`) does **not** go through
this function — `trg_routine_deactivated` (the DB trigger added by the same
migration) soft-deletes that routine's not-yet-started occurrences directly,
synchronously with the `UPDATE`.

## Google Calendar

Generated occurrences push to Google (see
`supabase/functions/google-calendar-sync`'s file header) — push-only, never
pulled back as `routine`. An edit made on the Google side of one of these
occurrences "promotes" it to a `fixed` event on the next pull, rather than
silently rewriting the routine template's occurrence.

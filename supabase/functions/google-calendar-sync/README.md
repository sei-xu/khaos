# Google Calendar sync for Khaos

Bidirectional sync between Khaos and Google Calendar, restricted to
`events.event_type = 'fixed'`. `scheduled` (task time blocks) and `routine`
(generated from a routine template) events never leave Khaos and nothing
pulled from Google can become either — see `docs/backlog.md`, "Integração
bidirecional com o Google Calendar (somente eventos fixed)", for the
decision and its rationale.

Two Edge Functions:

| Function | Trigger | Does |
| --- | --- | --- |
| `google-calendar-oauth` | one-time, by hand | Runs the OAuth consent flow and stores the refresh token |
| `google-calendar-sync` | cron (~every 5 min) | Pushes dirty `fixed` events to Google, then pulls Google's changes back |

## Why a trigger decides what's dirty

There's no backend layer in this app — the frontend and the chat agent (both
in-app and the Telegram bot, via `supabase/functions/_shared/khaos.ts` with
the service-role key) write to `events` directly. A sync hook living in
`src/lib/api/events.ts` would silently miss everything the agent creates. So
the outbox is a Postgres trigger, `trg_google_sync_dirty`
(`supabase/migrations/20261013000000_google_calendar_sync.sql`), which sets
`events.sync_dirty` whenever a row is (or just stopped being) `'fixed'` and a
user-visible column changed. It deliberately ignores the columns this
function itself writes (`google_event_id`, `google_calendar_id`,
`google_etag`, `google_synced_at`, `sync_dirty`), so writing back a push
result never re-marks the row dirty.

A pull, though, writes `name`/`duration`/`event_type`/`deleted_at` — columns
the trigger *does* watch — so every pull mutation goes through a two-step
write (data, then a second write touching only `sync_dirty`) instead. See the
comment at the top of `index.ts` for why skipping that step would start a
push/pull ping-pong that re-sends identical data to Google every cycle.

## Conflict rule: Google wins

A `fixed` event is a commitment made with other people; whatever Google
shows is the copy they see. If a push gets `412 Precondition Failed` (the
event changed on Google's side since our last known etag), or a pull notices
a locally-dirty row whose etag no longer matches, the local edit is
discarded, Google's version is written back, and the discarded edit is
logged to `google_calendar_sync_log` with `action = 'conflict'` — never
silently dropped.

## Setup

1. **Create an OAuth client** in Google Cloud Console (APIs & Services →
   Credentials → OAuth client ID, type "Web application"). Add this
   function's URL as an authorized redirect URI:
   `https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth`.

2. **Configure the OAuth consent screen** with the
   `https://www.googleapis.com/auth/calendar.events` scope (read/write
   events only, no calendar management) and, once ready, **publish it to "In
   Production"**, accepting the "unverified app" warning for this
   single-user internal tool. While it's left in "Testing", Google expires
   refresh tokens after **7 days** and the sync silently stops — publish
   first, then do step 4 below (re-consent is needed after publishing if you
   connected while still in Testing).

3. **Apply the migrations** (adds the sync columns, the account/log tables,
   and the status RPC):

   ```bash
   npm run db:push
   ```

4. **Set the function secrets:**

   ```bash
   supabase secrets set GOOGLE_CLIENT_ID=...
   supabase secrets set GOOGLE_CLIENT_SECRET=...
   supabase secrets set GOOGLE_OAUTH_REDIRECT_URI=https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth
   supabase secrets set GOOGLE_OAUTH_SETUP_SECRET=$(openssl rand -hex 32)
   supabase secrets set KHAOS_CRON_SECRET=...   # already set if telegram-notify/oversight-agent are deployed
   ```

5. **Deploy both functions:**

   ```bash
   supabase functions deploy google-calendar-oauth
   supabase functions deploy google-calendar-sync
   ```

6. **Connect the account** — visit, once, in a browser signed into the
   Google account whose calendar should sync:

   ```
   https://<project-ref>.supabase.co/functions/v1/google-calendar-oauth?start=<GOOGLE_OAUTH_SETUP_SECRET>
   ```

   Consent, and you'll land on a plain "Google Calendar connected" page.
   `GOOGLE_CALENDAR_STATUS()` (surfaced on the calendar page header) will then
   report `connected: true`.

   Shortcut to unblock development before this function is deployed: get a
   refresh token once via the
   [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
   (scope `https://www.googleapis.com/auth/calendar.events`, "Exchange
   authorization code for tokens", enable "Use your own OAuth credentials"
   with your client id/secret) and insert the row into
   `google_calendar_account` by hand.

7. **Schedule the sync** — see the next section.

### Wire up cron with pg_cron + pg_net

Same pattern as `telegram-notify` (see
`supabase/functions/telegram-bot/README.md`). Run once in the SQL editor,
replacing `<project-ref>` and `<KHAOS_CRON_SECRET>`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule('khaos-google-calendar-sync', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/google-calendar-sync',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Khaos-Cron-Secret', '<KHAOS_CRON_SECRET>'),
    body    := '{}'::jsonb
  );
$$);
```

To change the schedule later: `select cron.unschedule('khaos-google-calendar-sync');`
then re-schedule.

## Out of scope (tracked in `docs/backlog.md`)

A "Sync now" button in the UI (the browser has no cron secret and there's no
Supabase Auth to gate an interactive trigger route), Google push
notifications (watch channels) instead of polling, syncing more than one
calendar, mapping a Google calendar to a Khaos field, and real recurrence
(RRULE) instead of imported instances.

## Secrets

| Secret | Required | Default | Purpose |
| --- | --- | --- | --- |
| `GOOGLE_CLIENT_ID` | yes | — | OAuth client id |
| `GOOGLE_CLIENT_SECRET` | yes | — | OAuth client secret |
| `GOOGLE_OAUTH_REDIRECT_URI` | yes | — | Must match the client's authorized redirect URI |
| `GOOGLE_OAUTH_SETUP_SECRET` | yes | — | Gates the one-time `?start=` connect link and signs the callback's `state` nonce |
| `KHAOS_CRON_SECRET` | yes | — | Auth for the cron-triggered sync (shared with telegram-notify/oversight-agent) |
| `GOOGLE_CALENDAR_TZ_OFFSET` | no | `-03:00` | Fixed UTC offset used to bound imported all-day events |

## Manual verification

There's no automated test suite in this repo — see `CLAUDE.md`. Checked by
hand against a disposable Google calendar (never `primary` on the first
run):

- create in Google → appears in Khaos as `fixed`; move it in Google → moves
  in Khaos; delete in Google → disappears from Khaos (soft delete).
- create a `fixed` event in Khaos → appears in Google with the
  `khaos_event_id` extended property; edit in Khaos → updates in Google;
  delete in Khaos → disappears from Google.
- a `scheduled` event linked to a task, and a `routine`-generated event,
  never appear in Google across several sync cycles.
- an all-day Google event imports with a bounded `[00:00, 00:00 next day)`
  duration.
- a recurring Google event imports as separate instances (no RRULE).
- corrupting the stored `sync_token` forces a `410`; the next run recovers
  with a full sync without deleting Khaos-only events.
- firing the function twice concurrently doesn't duplicate an event (the
  unique partial index on `(google_calendar_id, google_event_id)`).
- after a bulk import, `moments` gains no `scheduled`-type rows (standalone
  fixed events have no `task_id`/`project_id`, so `trg_moment_scheduled`
  intentionally skips them).

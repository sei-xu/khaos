-- Fixes the routine dedup key from "same instant" to "same local day"
-- (docs/backlog.md, "Rotinas devem ser criadas por cron/assistente...",
-- BLOQUEANTE on PR #97 about idx_events_routine_dedup).
--
-- With 'routine' now Google-syncable, a 412 push conflict (GOOGLE WINS,
-- google-calendar-sync/index.ts) or a pull can move an occurrence's
-- `duration` to a different time the same day. The old index was
-- (routine_id, lower(duration)) — an exact-instant key — so the moved row's
-- lower(duration) no longer matches what the generator (occurrences.ts)
-- plans for that day, and the next cron tick inserts the original slot
-- again: two occurrences, same routine, same day.
--
-- lower(duration) is UTC; the expression below converts it to this app's
-- assumed local day the same way google-calendar-sync's TZ_OFFSET constant
-- does (America/Sao_Paulo, -03:00, no DST since 2019 — see that function's
-- own comment). `(lower(duration) - interval '3 hours')::date` is what the
-- comment above used to say, but timestamptz::date (timestamptz_date) is
-- STABLE, not IMMUTABLE — it depends on the session's TimeZone — so
-- Postgres rejects it in a `create unique index` expression with 42P17.
-- `timezone(interval, timestamptz) -> timestamp` IS immutable, and casting
-- that result (already a plain timestamp) to ::date is immutable too, so
-- this form carries the same "day in -03:00" meaning without depending on
-- the session's TimeZone setting.
--
-- The predicate also drops `event_type = 'routine'`: a Google pull promotes
-- a routine occurrence to event_type='fixed' while keeping routine_id (see
-- google-calendar-sync/index.ts's pull handler) specifically to preserve
-- the user's edit, and that promoted row must keep "occupying" the
-- routine's day — otherwise it falls out of this partial index and out of
-- materialize.ts's `existing` query (which has to drop its own
-- event_type='routine' filter to match), and the next cron tick sees
-- nothing materialized for that day and recreates the occurrence.
drop index "public"."idx_events_routine_dedup";

create unique index "idx_events_routine_dedup"
    on "public"."events" (routine_id, ((lower(duration) at time zone interval '-03:00')::date))
    where routine_id is not null and deleted_at is null;

comment on index "public"."idx_events_routine_dedup" is
    'One occurrence per routine per local day (America/Sao_Paulo, fixed -03:00 offset baked into the expression). Deliberately day-grained, not instant-grained, so a Google-side edit that moves the occurrence''s time within the same day (or promotes it to event_type=''fixed'') does not make the generator insert a duplicate at the original slot.';

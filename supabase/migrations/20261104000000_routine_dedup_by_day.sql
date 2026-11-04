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
-- own comment). Needs a fixed numeric offset, not a named time zone, to
-- stay IMMUTABLE and indexable.
drop index "public"."idx_events_routine_dedup";

create unique index "idx_events_routine_dedup"
    on "public"."events" (routine_id, ((lower(duration) - interval '3 hours')::date))
    where event_type = 'routine' and deleted_at is null and routine_id is not null;

comment on index "public"."idx_events_routine_dedup" is
    'One routine occurrence per routine per local day (America/Sao_Paulo, fixed -03:00 offset baked into the expression). Deliberately day-grained, not instant-grained, so a Google-side edit that moves the occurrence''s time within the same day does not make the generator insert a duplicate at the original slot.';

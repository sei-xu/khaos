-- events.location: a non-empty value marks an event "external" for the
-- weather feature (digest + calendar chip get a per-event temperature/rain
-- call instead of just the day's) — see docs/backlog.md. Deliberately a
-- free-text column, not a keyword-matched name or an event_type check: both
-- alternatives were rejected (fragile mixed pt/en names; 'fixed' already
-- means "external commitment to other people", not "outdoors").
--
-- Synced with Google Calendar's own `location` field, restricted to
-- event_type = 'fixed' like every other Google-synced column (see
-- 20261013000000_google_calendar_sync.sql) — trg_google_sync_dirty is
-- extended below so editing location on a fixed event re-queues a push.
alter table "public"."events" add column "location" text;

comment on column "public"."events"."location" is
    'Free-text location/address. A non-empty value marks the event "external" for weather purposes (per-event temperature/rain in the digest and calendar, instead of just the day''s). Synced bidirectionally with Google Calendar''s own location field, restricted to event_type = ''fixed''.';

create or replace function "public"."trg_google_sync_dirty"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if TG_OP = 'INSERT' then
    if new.event_type = 'fixed' then
      new.sync_dirty := true;
    end if;
    return new;
  end if;

  -- UPDATE. Only columns that affect what Google should show matter here;
  -- the columns this trigger (and the sync function) itself writes
  -- (google_event_id/google_calendar_id/google_etag/google_synced_at/
  -- sync_dirty) are deliberately excluded so that writing back the result of
  -- a sync never re-marks the row dirty and loops.
  if new.event_type = 'fixed' or old.event_type = 'fixed' then
    if old.name is distinct from new.name
      or old.duration is distinct from new.duration
      or old.deleted_at is distinct from new.deleted_at
      or old.event_type is distinct from new.event_type
      or old.location is distinct from new.location
    then
      new.sync_dirty := true;
    end if;
  end if;

  return new;
end;
$$;

comment on function "public"."trg_google_sync_dirty"() is
    'Marks a row sync_dirty when it is (or just stopped being) event_type=''fixed'' and a user-visible column changed (name, duration, deleted_at, event_type, location). A ''fixed''->other transition is flagged so google-calendar-sync deletes the Google-side event; the reverse transition is flagged so it creates one. Never fires for rows that are, and remain, ''scheduled'' or ''routine''.';

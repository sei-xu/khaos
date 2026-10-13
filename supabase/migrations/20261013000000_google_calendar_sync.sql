-- Google Calendar sync: pairing columns on events, restricted to
-- event_type = 'fixed'. 'scheduled' and 'routine' events never sync (see
-- docs/backlog.md, "Integração bidirecional com o Google Calendar (somente
-- eventos fixed)") — a 'fixed' event is a rigid external commitment
-- (meeting/class/flight), exactly what a Google Calendar holds.

alter table "public"."events"
    add column "google_event_id" text,
    add column "google_calendar_id" text,
    add column "google_etag" text,
    add column "google_synced_at" timestamptz,
    add column "sync_dirty" boolean not null default false;

comment on column "public"."events"."google_event_id" is
    'Id of the paired event in Google Calendar. Null for events that have never been pushed/pulled. Only set on event_type = ''fixed'' rows.';

comment on column "public"."events"."google_calendar_id" is
    'Id of the Google Calendar the paired event lives in (see google_calendar_account.calendar_id).';

comment on column "public"."events"."google_etag" is
    'Last etag Google returned for this event. Compared against the etag on the next push/pull to detect a conflicting edit made on the Google side.';

comment on column "public"."events"."google_synced_at" is
    'Timestamp of the last successful push or pull for this event.';

comment on column "public"."events"."sync_dirty" is
    'Set by trg_google_sync_dirty when a fixed event needs to be pushed to Google (created, edited, deleted, or just became/stopped being fixed). Cleared by the google-calendar-sync function once the push succeeds.';

-- One Google event is paired to at most one Khaos event.
create unique index "idx_events_google_pairing"
    on "public"."events" ("google_calendar_id", "google_event_id")
    where "google_event_id" is not null;

-- The outbox: what google-calendar-sync needs to push next. Not restricted
-- to event_type = 'fixed' — a row that just left 'fixed' is sync_dirty too
-- and needs a DELETE on the Google side, so the push query scans all dirty
-- rows and branches on event_type/google_event_id itself.
create index "idx_events_sync_dirty"
    on "public"."events" ("id")
    where "sync_dirty";

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
    then
      new.sync_dirty := true;
    end if;
  end if;

  return new;
end;
$$;

alter function "public"."trg_google_sync_dirty"() owner to "postgres";

comment on function "public"."trg_google_sync_dirty"() is
    'Marks a row sync_dirty when it is (or just stopped being) event_type=''fixed'' and a user-visible column changed (name, duration, deleted_at, event_type). A ''fixed''->other transition is flagged so google-calendar-sync deletes the Google-side event; the reverse transition is flagged so it creates one. Never fires for rows that are, and remain, ''scheduled'' or ''routine''.';

create trigger "trg_google_sync_dirty"
    before insert or update on "public"."events"
    for each row execute function "public"."trg_google_sync_dirty"();

-- Locomoção, fase A: lugares de primeira classe, local em events/tasks, e o
-- location do Google Calendar deixando de ser descartado no sync. Ver
-- docs/backlog.md, "Locomoção: local em eventos e tarefas, deslocamento no
-- calendário e check-in" — esta é a fase A de D (places/travel_settings/
-- colunas de local; o cálculo de deslocamento em si é a fase B).

create type "public"."transport_modes" as enum (
    'walk',
    'bike',
    'transit',
    'drive',
    'rideshare',
    'remote'
);

comment on type "public"."transport_modes" is
    'How a leg between two places is (or would be) travelled. ''remote'' means the event has a place but no travel is computed for it (e.g. a videocall with a physical fallback address).';

create table "public"."places" (
    "id" uuid primary key default gen_random_uuid(),
    "name" text not null,
    "address" text,
    "lat" double precision,
    "lng" double precision,
    "kind" text not null default 'other',
    "radius_m" integer not null default 150,
    "google_place_id" text,
    "field_id" uuid references "public"."fields"("id"),
    "project_id" uuid references "public"."projects"("id"),
    "deleted_at" timestamptz,
    constraint "places_kind_check" check ("kind" in ('home', 'work', 'client', 'other')),
    constraint "places_radius_m_positive" check ("radius_m" > 0)
);

comment on table "public"."places" is
    'A named physical place the user goes to — home, a client''s office, a workspace. First-class so events and tasks can point at one instead of carrying free-text addresses.';

comment on column "public"."places"."kind" is
    'home | work | client | other. ''work'' can point at field_id/project_id to tie a workspace to the hierarchy it serves (covers "locais de trabalho").';

comment on column "public"."places"."radius_m" is
    'Geofence radius in meters used by the opportunistic geolocation check-in (fase D) to decide "arrived".';

comment on column "public"."places"."google_place_id" is
    'Optional Google Places id, for a future richer lookup. Not required — address/lat/lng are enough for travel-estimate.';

comment on column "public"."places"."deleted_at" is
    'Soft delete timestamptz, same convention as events/tasks.';

alter table "public"."places" enable row level security;
create policy "allow all" on "public"."places" using (true) with check (true);
grant all on table "public"."places" to "anon";
grant all on table "public"."places" to "authenticated";
grant all on table "public"."places" to "service_role";

create table "public"."travel_settings" (
    "id" boolean primary key default true,
    "home_place_id" uuid references "public"."places"("id"),
    "default_transport_mode" "public"."transport_modes" not null default 'drive',
    "default_arrive_early_minutes" integer not null default 10,
    "rain_probability_threshold" integer not null default 50,
    "geolocation_checkin_opt_in" boolean not null default false,
    constraint "travel_settings_singleton" check ("id"),
    constraint "travel_settings_rain_probability_threshold_range" check ("rain_probability_threshold" between 0 and 100)
);

comment on table "public"."travel_settings" is
    'Singleton row (id is a boolean fixed to true, same trick as google_calendar_account) holding the user''s travel defaults: home place, default transport mode, how early they want to arrive by default, the rain-probability threshold that biases transport suggestions, and the geolocation check-in opt-in.';

comment on column "public"."travel_settings"."default_arrive_early_minutes" is
    'Default slack before an event''s start the user wants to have already arrived by, used when neither the event nor its place overrides it.';

comment on column "public"."travel_settings"."rain_probability_threshold" is
    'Precipitation probability (0-100) above which suggest_transport_mode (fase C) leans the recommendation away from walk/bike.';

comment on column "public"."travel_settings"."geolocation_checkin_opt_in" is
    'Explicit opt-in for the opportunistic (app-foreground-only) geolocation check-in built in fase D. Off by default — PWA has no reliable background geolocation.';

alter table "public"."travel_settings" enable row level security;
create policy "allow all" on "public"."travel_settings" using (true) with check (true);
grant all on table "public"."travel_settings" to "anon";
grant all on table "public"."travel_settings" to "authenticated";
grant all on table "public"."travel_settings" to "service_role";

alter table "public"."events"
    add column "place_id" uuid references "public"."places"("id"),
    add column "location_text" text,
    add column "transport_mode" "public"."transport_modes",
    add column "arrive_early_minutes" integer;

comment on column "public"."events"."place_id" is
    'Where this event happens, if it is a cataloged place. Independent of event_type, though only ''fixed'' events (external commitments) get travel legs computed in fase B.';

comment on column "public"."events"."location_text" is
    'Free-text address, used when a Google Calendar event carries a location that doesn''t match any cataloged place yet. Pushed/pulled with Google''s own ''location'' field (see google-calendar-sync).';

comment on column "public"."events"."transport_mode" is
    'How the user plans to get to/from this event. Null means unset — the assistant suggests one (suggest_transport_mode, fase C) instead of the app silently picking.';

comment on column "public"."events"."arrive_early_minutes" is
    'Per-event override of travel_settings.default_arrive_early_minutes — how much slack before the start the user wants to have already arrived.';

alter table "public"."tasks"
    add column "place_id" uuid references "public"."places"("id");

comment on column "public"."tasks"."place_id" is
    'Where this task needs to happen, if anywhere — the entry point for "tarefas no caminho" (suggest_tasks_on_the_way, fase C): a task without a place is never a candidate.';

-- trg_google_sync_dirty (20261013000000_google_calendar_sync.sql) watched
-- only name/duration/deleted_at/event_type. A ''fixed'' event's location is
-- just as user-visible on the Google side, so an edit that changes only the
-- place/location must mark sync_dirty too, or it would never reach Google.
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
      or old.place_id is distinct from new.place_id
      or old.location_text is distinct from new.location_text
    then
      new.sync_dirty := true;
    end if;
  end if;

  return new;
end;
$$;

comment on function "public"."trg_google_sync_dirty"() is
    'Marks a row sync_dirty when it is (or just stopped being) event_type=''fixed'' and a user-visible column changed (name, duration, deleted_at, event_type, place_id, location_text). A ''fixed''->other transition is flagged so google-calendar-sync deletes the Google-side event; the reverse transition is flagged so it creates one. Never fires for rows that are, and remain, ''scheduled'' or ''routine''.';

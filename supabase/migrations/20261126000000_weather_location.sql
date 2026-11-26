-- Singleton location used by the weather feature (digest, get_weather_forecast
-- tool, calendar ribbon/icons) — see docs/backlog.md, "Clima: digest, evento
-- externo e calendário". Same singleton-boolean-id pattern as
-- google_calendar_account (20261013010000_google_calendar_account.sql), but
-- "allow all" RLS like the rest of the app's user data: unlike the Google
-- account row there's no token here, and the browser needs to read/write it
-- for the city picker next to TimezonePicker.
create table "public"."weather_location" (
    "id" boolean primary key default true,
    "latitude" double precision not null,
    "longitude" double precision not null,
    "label" text not null,
    "updated_at" timestamptz not null default now(),
    constraint "weather_location_singleton" check ("id")
);

comment on table "public"."weather_location" is
    'Singleton row holding the one location the weather feature forecasts for (Open-Meteo latitude/longitude). Resolved client- and server-side in cascade: this table, then env vars, then geocoding the configured timezone''s city — see src/lib/api/weather.ts and supabase/functions/_shared/khaos.ts.';
comment on column "public"."weather_location"."label" is
    'Human-readable place name shown in the city picker, e.g. "São Paulo, BR".';

alter table "public"."weather_location" enable row level security;
create policy "allow all" on "public"."weather_location" using (true) with check (true);

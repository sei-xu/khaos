-- Support tables for the Google Calendar sync (see
-- 20261013000000_google_calendar_sync.sql for the events-side columns).
--
-- Both tables hold a refresh token / raw sync detail and are written only by
-- the google-calendar-oauth and google-calendar-sync Edge Functions via the
-- service-role key. RLS enabled, no policies — same pattern as
-- telegram_notifications: the anon key the browser uses cannot read these
-- rows at all, let alone the refresh token.

create table "public"."google_calendar_account" (
    "id" boolean primary key default true,
    "calendar_id" text not null default 'primary',
    "refresh_token" text,
    "access_token" text,
    "access_token_expires_at" timestamptz,
    "sync_token" text,
    "last_full_sync_at" timestamptz,
    "last_sync_at" timestamptz,
    "last_error" text,
    "connected_at" timestamptz,
    constraint "google_calendar_account_singleton" check ("id")
);

comment on table "public"."google_calendar_account" is
    'Singleton row holding the OAuth refresh/access token and sync cursor for the one connected Google account. id is a boolean fixed to true so the table can hold at most one row. Written only by google-calendar-oauth (token exchange/refresh) and google-calendar-sync (sync_token, last_*). RLS on, no policies: not reachable with the anon key.';

comment on column "public"."google_calendar_account"."calendar_id" is
    'Google Calendar id synced against (v1 supports exactly one, default ''primary'').';

comment on column "public"."google_calendar_account"."refresh_token" is
    'OAuth refresh token. Never exposed outside the service-role Edge Functions; see google_calendar_status() for the browser-safe projection.';

comment on column "public"."google_calendar_account"."sync_token" is
    'Google Calendar API syncToken for incremental events.list pulls. Cleared (and a full sync re-run) when Google responds 410 fullSyncRequired.';

alter table "public"."google_calendar_account" enable row level security;

create table "public"."google_calendar_sync_log" (
    "id" uuid primary key default gen_random_uuid(),
    "ts" timestamptz not null default now(),
    "direction" text not null,
    "action" text not null,
    "event_id" uuid,
    "google_event_id" text,
    "detail" text,
    constraint "google_calendar_sync_log_direction_check"
        check ("direction" in ('pull', 'push')),
    constraint "google_calendar_sync_log_action_check"
        check ("action" in ('created', 'updated', 'deleted', 'skipped_echo', 'conflict', 'error'))
);

comment on table "public"."google_calendar_sync_log" is
    'Append-only trace of what each google-calendar-sync run did, for debugging a background job with no other visibility. Rows older than 30 days are pruned by the function on each run. RLS on, no policies: not reachable with the anon key.';

create index "idx_google_calendar_sync_log_ts" on "public"."google_calendar_sync_log" ("ts");

alter table "public"."google_calendar_sync_log" enable row level security;

-- Browser-safe status projection: connected state and last-sync health only,
-- never the tokens. SECURITY DEFINER so it can read google_calendar_account
-- despite its RLS having no policies; the function body is the only thing
-- deciding what leaves that table.
create or replace function "public"."google_calendar_status"()
    returns table (
        "connected" boolean,
        "calendar_id" text,
        "last_sync_at" timestamptz,
        "last_error" text
    )
    language "sql"
    security definer
    set search_path = public
    as $$
    select
        (refresh_token is not null) as connected,
        calendar_id,
        last_sync_at,
        last_error
    from public.google_calendar_account
    where id = true
    union all
    select false, null, null, null
    where not exists (select 1 from public.google_calendar_account where id = true)
    limit 1;
$$;

alter function "public"."google_calendar_status"() owner to "postgres";

comment on function "public"."google_calendar_status"() is
    'Browser-safe projection of google_calendar_account: whether an account is connected, which calendar, and the last sync''s outcome. Never returns refresh_token/access_token/sync_token. SECURITY DEFINER to read past the account table''s policy-less RLS.';

grant execute on function "public"."google_calendar_status"() to "anon";
grant execute on function "public"."google_calendar_status"() to "authenticated";

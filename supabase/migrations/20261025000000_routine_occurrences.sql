-- Routine occurrence materialization (docs/backlog.md, "Rotinas devem ser
-- criadas por cron/assistente e devem entrar no resumo diário matinal").
-- routines (templates) already existed with full CRUD; nothing generated
-- the events that make them real. This migration adds what the generator
-- (src/lib/routines/occurrences.ts, called from the new routine-events
-- Edge Function and the materialize_routines assistant tool) needs from
-- the database side:
--
--   1. events.routine_status — lets a person/assistant mark a generated
--      occurrence done/partial/skipped after the fact, the basis for habit
--      tracking (e.g. "4x a week at the gym" needs to know which days
--      landed). Only meaningful on event_type='routine' rows.
--   2. A partial unique index on (routine_id, lower(duration)) so the
--      generator can insert with on-conflict-do-nothing and be safely
--      re-run (same cron tick retried, two ticks overlapping, or the
--      assistant materializing a window cron already covered) without ever
--      duplicating an occurrence. lower(duration) is IMMUTABLE (unlike an
--      AT TIME ZONE expression, which is only STABLE and can't be
--      indexed); the generator's own start time is already deterministic
--      per routine+day, so this is a true de-dup key, not a workaround.
--   3. A trigger that soft-deletes NOT-YET-STARTED routine occurrences when
--      a routine is deactivated (active: true -> false) — past/in-progress
--      occurrences are kept, Khaos never erases history. Reactivating a
--      routine does not resurrect them; the generator simply starts
--      producing new ones again from "now" forward.
--   4. trg_google_sync_dirty extended to also mark 'routine' rows dirty —
--      per product decision, generated routine occurrences DO push to
--      Google Calendar (this reverses the restriction documented in
--      20261013000000_google_calendar_sync.sql and in
--      google-calendar-sync/index.ts's own file header, which this
--      migration's sibling PR updates). Routine rows are never pulled back
--      as 'routine' — a pull always writes event_type='fixed', so an edit
--      made on the Google side of a routine occurrence "promotes" it to a
--      real fixed commitment rather than silently rewriting a routine
--      template occurrence. That keeps the existing GOOGLE WINS conflict
--      rule meaningful without inventing two-way semantics for a
--      cron-generated row.

alter table "public"."events"
    add column "routine_status" text;

alter table "public"."events"
    add constraint "chk_routine_status_values"
    check ("routine_status" is null or "routine_status" in ('done', 'partial', 'skipped'));

alter table "public"."events"
    add constraint "chk_routine_status_only_on_routine"
    check ("routine_status" is null or "event_type" = 'routine');

comment on column "public"."events"."routine_status" is
    'Habit-tracking outcome for a routine occurrence (event_type=''routine''): done, partial, or skipped. Null for ungenerated/not-yet-reviewed occurrences and always null for scheduled/fixed events. Set by the user or assistant after the fact — never by the generator. A ''skipped'' Nx_week occurrence is what src/lib/routines/occurrences.ts reschedules as a makeup on a later free day that same (or the following) week.';

-- De-dup key for the generator: same routine, same computed start instant,
-- never inserted twice. Scoped to event_type='routine' and not soft-deleted
-- so a deactivated routine's soft-deleted occurrences don't block a later
-- reactivation from regenerating the same slot.
create unique index "idx_events_routine_dedup"
    on "public"."events" (routine_id, lower(duration))
    where event_type = 'routine' and deleted_at is null and routine_id is not null;

create or replace function "public"."trg_routine_deactivated"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if old.active and not new.active then
    update "public"."events"
       set deleted_at = now()
     where routine_id = new.id
       and event_type = 'routine'
       and deleted_at is null
       and lower(duration) > now();
  end if;
  return new;
end;
$$;

alter function "public"."trg_routine_deactivated"() owner to "postgres";

comment on function "public"."trg_routine_deactivated"() is
    'On routines.active true->false, soft-deletes this routine''s not-yet-started generated occurrences (lower(duration) > now()). Past/in-progress occurrences are preserved — Khaos keeps history instead of erasing it. Reactivating does not restore them; the generator produces new ones going forward.';

create trigger "trg_routine_deactivated"
    after update on "public"."routines"
    for each row execute function "public"."trg_routine_deactivated"();

-- Extend the Google sync trigger: 'routine' occurrences now push too (see
-- file header). 'scheduled' is still never eligible.
create or replace function "public"."trg_google_sync_dirty"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if TG_OP = 'INSERT' then
    if new.event_type in ('fixed', 'routine') then
      new.sync_dirty := true;
    end if;
    return new;
  end if;

  if new.event_type in ('fixed', 'routine') or old.event_type in ('fixed', 'routine') then
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

comment on function "public"."trg_google_sync_dirty"() is
    'Marks a row sync_dirty when it is (or just stopped being) event_type IN (''fixed'',''routine'') and a user-visible column changed (name, duration, deleted_at, event_type). A transition away from fixed/routine is flagged so google-calendar-sync deletes the Google-side event; the reverse transition is flagged so it creates one. Never fires for rows that are, and remain, ''scheduled''.';

-- Review blocker on PR #97: renaming an active routine never reached its
-- future occurrences. `events.name` is copied from the routine only once,
-- at generation time (buildOccurrence, src/lib/routines/occurrences.ts), and
-- trg_routine_deactivated (20261105010000_routine_soft_delete_tombstone.sql)
-- never fires on a name-only edit, since `name` isn't in the column list it
-- reacts to — so a rename left every not-yet-started occurrence showing the
-- old name on the CalendarPage, in the digest's "routines today", and in
-- Google, where the row didn't even get marked sync_dirty
-- (trg_google_sync_dirty, 20261025000000_routine_occurrences.sql, only
-- watches events.name, which never changed).
--
-- A dedicated trigger, rather than folding `name` into
-- trg_routine_deactivated's set: that trigger's reaction is "drop and let
-- the next materialization regenerate", which is overkill and wrong for a
-- plain rename — it would also blow away routine_day (freeing the dedup
-- slot) and any routine_status/promoted ('fixed') occurrence the owner
-- already has. Updating `name` in place on the live occurrence instead
-- preserves routine_day, routine_status and the occurrence itself, and
-- trg_google_sync_dirty already treats a name change as sync_dirty, so
-- Google gets a cheap PATCH instead of a delete+recreate.

create or replace function "public"."trg_routine_name_propagated"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if old.name is distinct from new.name then
    update "public"."events"
       set name = new.name
     where routine_id = new.id
       and event_type = 'routine'
       and deleted_at is null
       and lower(duration) > now();
  end if;
  return new;
end;
$$;

alter function "public"."trg_routine_name_propagated"() owner to "postgres";

comment on function "public"."trg_routine_name_propagated"() is
    'On routines.name changing, renames this routine''s not-yet-started, live (not soft-deleted) event_type=''routine'' occurrences to match — in place, keeping routine_day, routine_status and the occurrence itself, unlike trg_routine_deactivated''s drop-and-regenerate. trg_google_sync_dirty already marks a renamed event sync_dirty, so the Google side gets a PATCH.';

create trigger "trg_routine_name_propagated"
    after update on "public"."routines"
    for each row execute function "public"."trg_routine_name_propagated"();

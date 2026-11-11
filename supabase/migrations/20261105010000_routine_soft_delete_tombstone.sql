-- Review blocker on PR #97: deleting a routine occurrence had no durable
-- effect. trg_routine_deactivated's soft-delete (deactivation or a
-- definition edit) and the owner cancelling a single day (via the Khaos UI
-- or by deleting the Google event, which google-calendar-sync's pull
-- handler turns into the same soft-delete) wrote the exact same shape of
-- row: deleted_at set, routine_day untouched. materialize.ts's `existing`
-- queries filtered `deleted_at is null`, so BOTH cases looked identical to
-- "never materialized" — the next cron tick regenerated a day the owner
-- had cancelled, pushing a brand new event to Google on top of the one
-- just deleted there.
--
-- The two cases need opposite treatment: trg_routine_deactivated's
-- soft-delete must free the slot (that's the whole point — the next
-- materialization regenerates it from the new definition), while the
-- owner's own delete/cancel must keep occupying it so it never comes back.
-- Split them on the one column that already means "this day is claimed":
-- trg_routine_deactivated now clears `routine_day` to null in the same
-- update that sets `deleted_at`, and materialize.ts's `existing` queries no
-- longer filter on `deleted_at` at all — only `routine_day` says whether a
-- row still claims its slot. idx_events_routine_dedup's predicate was
-- already `routine_day is not null`, so a trigger-cleared row frees the
-- unique index the same way it frees `existing`, with no index change
-- needed.

create or replace function "public"."trg_routine_deactivated"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if old.active and not new.active then
    -- Deactivated: drop every not-yet-started generated occurrence and free
    -- its slot (routine_day := null) — nothing should regenerate it, but a
    -- future reactivation must be free to replan the same day.
    update "public"."events"
       set deleted_at = now(),
           routine_day = null
     where routine_id = new.id
       and event_type = 'routine'
       and deleted_at is null
       and lower(duration) > now();
  elsif new.active
    and (old.frequency is distinct from new.frequency
      or old.preferred_time is distinct from new.preferred_time
      or old.estimate is distinct from new.estimate)
  then
    -- Definition changed: drop the not-yet-started occurrences laid out by
    -- the old definition and free their slots so the next materialization
    -- regenerates them from the new definition. Rows that carry a habit
    -- outcome (routine_status) or that a Google pull already promoted to
    -- 'fixed' are the user's own and are kept.
    update "public"."events"
       set deleted_at = now(),
           routine_day = null
     where routine_id = new.id
       and event_type = 'routine'
       and routine_status is null
       and deleted_at is null
       and lower(duration) > now();
  end if;
  return new;
end;
$$;

comment on function "public"."trg_routine_deactivated"() is
    'On routines.active true->false, soft-deletes this routine''s not-yet-started generated occurrences (lower(duration) > now()) and clears routine_day so the slot is free to be replanned. On an edit of an active routine''s frequency, preferred_time or estimate, does the same to the not-yet-started occurrences that have no routine_status and are still event_type=''routine'' (promoted/marked rows are kept) so the next materialization regenerates them from the new definition. Past/in-progress occurrences are preserved — Khaos keeps history instead of erasing it. Reactivating does not restore them; the generator produces new ones going forward. Contrast with a soft-delete from elsewhere (events API, Google pull of a cancelled event): those leave routine_day set, so the slot stays claimed and materialize.ts never refills it — that is how the owner''s own cancellation of a single day is distinguished from this trigger''s "please regenerate" delete.';

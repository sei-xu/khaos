-- Two review blockers on PR #97, both about the routine occurrences the
-- generator has already written to `events`.
--
-- 1) De-dup key that Google cannot rewrite.
--    idx_events_routine_dedup was keyed on a day derived from
--    lower(duration), a column a Google pull or a 412 (GOOGLE WINS) can
--    rewrite. Dragging an occurrence from Tuesday to Wednesday in Google
--    moved its key to Wednesday, left Tuesday (still a base day of the
--    routine's grid) without a key, and the next cron tick recreated it.
--    `routine_day` records the day the GENERATOR planned the occurrence for,
--    is written only by the generator (src/lib/routines/materialize.ts), and
--    is never touched by the Google sync, so the key survives any edit of
--    `duration`. A promoted row (event_type='fixed', routine_id kept) keeps
--    its routine_day, so it keeps occupying the slot it came from; and since
--    only the generator writes the column, the unique index can cover every
--    event_type without ever blocking a Google-side move (the move changes
--    `duration`, not `routine_day`).
--
-- 2) Editing a routine's definition propagates.
--    trg_routine_deactivated only reacted to active true->false, so changing
--    `frequency`, `preferred_time` or `estimate` of an active routine left
--    the old grid on the calendar (and in Google) and, with day-grained
--    de-dup, silently ignored a new preferred_time for days already
--    materialized. The same soft-delete now runs on a definition change, and
--    the next materialization regenerates the window from the new
--    definition.

alter table "public"."events" add column "routine_day" date;

comment on column "public"."events"."routine_day" is
    'Local day (in the timezone the generator ran with) a routine occurrence was PLANNED for. Written only by the generator (src/lib/routines/materialize.ts), never by Google sync, so it stays put when a Google pull or 412 rewrites `duration` (including to another day). With routine_id it is the de-dup key (idx_events_routine_dedup). Null on events that were not produced by the generator.';

-- Backfill from the old key (local day of lower(duration), America/Sao_Paulo,
-- the zone the previous index baked in). A promoted ('fixed') row can share
-- a day with a live 'routine' row of the same routine; give the day to the
-- 'routine' row (then lowest id) and leave the other null so the unique
-- index below can be built.
with ranked as (
    select id,
           (lower(duration) at time zone 'America/Sao_Paulo')::date as day,
           row_number() over (
               partition by routine_id,
                            (lower(duration) at time zone 'America/Sao_Paulo')::date
               order by (event_type = 'routine') desc, id
           ) as rn
      from "public"."events"
     where routine_id is not null
       and deleted_at is null
)
update "public"."events" e
   set routine_day = r.day
  from ranked r
 where e.id = r.id
   and r.rn = 1;

drop index "public"."idx_events_routine_dedup";

create unique index "idx_events_routine_dedup"
    on "public"."events" (routine_id, routine_day)
    where routine_day is not null and routine_id is not null and deleted_at is null;

comment on index "public"."idx_events_routine_dedup" is
    'One live occurrence per routine per planned day: (routine_id, routine_day). routine_day is written only by the generator, so a Google-side edit of `duration` (same day or another day) neither frees the slot for the generator to refill nor collides with it. Soft-deleted rows are excluded so a deactivated or edited routine can regenerate the slot.';

create or replace function "public"."trg_routine_deactivated"() returns "trigger"
    language "plpgsql"
    as $$
begin
  if old.active and not new.active then
    -- Deactivated: drop every not-yet-started generated occurrence.
    update "public"."events"
       set deleted_at = now()
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
    -- the old definition so the next materialization regenerates them. Rows
    -- that carry a habit outcome (routine_status) or that a Google pull
    -- already promoted to 'fixed' are the user's own and are kept.
    update "public"."events"
       set deleted_at = now()
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
    'On routines.active true->false, soft-deletes this routine''s not-yet-started generated occurrences (lower(duration) > now()). On an edit of an active routine''s frequency, preferred_time or estimate, soft-deletes the not-yet-started occurrences that have no routine_status and are still event_type=''routine'' (promoted/marked rows are kept) so the next materialization regenerates them from the new definition. Past/in-progress occurrences are preserved — Khaos keeps history instead of erasing it. Reactivating does not restore them; the generator produces new ones going forward.';

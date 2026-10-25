-- Closes the moments-feed coverage gaps found while scoping reactive
-- assistant suggestions (docs/backlog.md, "assistente deve detectar todas
-- mudancas feitas no banco"): routines had no moment triggers at all,
-- soft-deletes were invisible (every existing moment trigger guards on
-- new.deleted_at IS NULL), renames and reparenting produced nothing, and
-- task_items (the TaskDetailModal checklist) wasn't wired up even though
-- it's already an allowed chat table. events keep producing no moments —
-- that's the documented, deliberate exception noted on trg_moment_scheduled,
-- not something this migration touches.
--
-- Schema note / deviation from the original investigation: routines has no
-- due, status or priority column (see baseline_schema.sql) — only
-- name/frequency/preferred_time/estimate/constraints/active. So "mudar
-- status de uma routine" is implemented against the one column that actually
-- carries routine lifecycle state: active, logged as a 'status'
-- active/paused moment. due/priority triggers for routines are not created
-- because there is nothing to trigger on.

-- moment_entity_column() previously only resolved projects/sections/tasks;
-- extend it so the generic created/renamed trigger functions below can be
-- reused for routines too.
CREATE OR REPLACE FUNCTION "public"."moment_entity_column"("p_table" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select case p_table
    when 'projects' then 'project_id'
    when 'sections' then 'section_id'
    when 'tasks'    then 'task_id'
    when 'routines' then 'routine_id'
  end;
$$;

-- 1. routines: created (generic trg_moment_created already works unchanged
-- now that moment_entity_column knows about routines), renamed, and the
-- active/paused lifecycle toggle.

CREATE OR REPLACE TRIGGER "moment_created_routines" AFTER INSERT ON "public"."routines" FOR EACH ROW EXECUTE FUNCTION "public"."trg_moment_created"();

CREATE OR REPLACE FUNCTION "public"."trg_moment_active_routines"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.active is distinct from new.active then
    perform insert_moment(
      'routine_id', new.id, 'status',
      case when new.active then 'active' else 'paused' end,
      null,
      case when old.active then 'active' else 'paused' end
    );
  end if;
  return new;
end;
$$;

COMMENT ON FUNCTION "public"."trg_moment_active_routines"() IS 'Logs a status moment (active/paused) when routines.active toggles — routines has no status column of its own, so active is its lifecycle state.';

CREATE OR REPLACE TRIGGER "moment_active_routines" AFTER UPDATE ON "public"."routines" FOR EACH ROW EXECUTE FUNCTION "public"."trg_moment_active_routines"();

-- 2. renamed: generic for every entity that has a name column.

CREATE OR REPLACE FUNCTION "public"."trg_moment_renamed"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.name is distinct from new.name then
    perform insert_moment(moment_entity_column(TG_TABLE_NAME), new.id, 'renamed', new.name, null, old.name);
  end if;
  return new;
end;
$$;

COMMENT ON FUNCTION "public"."trg_moment_renamed"() IS 'Trigger function shared by tasks/sections/projects/routines: logs a renamed moment with the old name as previous_value and the new name as value.';

CREATE OR REPLACE TRIGGER "moment_renamed_tasks" AFTER UPDATE ON "public"."tasks" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_renamed"();
CREATE OR REPLACE TRIGGER "moment_renamed_sections" AFTER UPDATE ON "public"."sections" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_renamed"();
CREATE OR REPLACE TRIGGER "moment_renamed_projects" AFTER UPDATE ON "public"."projects" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_renamed"();
CREATE OR REPLACE TRIGGER "moment_renamed_routines" AFTER UPDATE ON "public"."routines" FOR EACH ROW EXECUTE FUNCTION "public"."trg_moment_renamed"();

-- 3. deleted: the NULL -> non-NULL deleted_at transition, deliberately
-- *outside* the "new.deleted_at IS NULL" guard every other entity trigger
-- uses, since that guard is exactly what makes soft-deletes invisible today.
-- routines has no deleted_at column, so there is no delete trigger for it.

CREATE OR REPLACE FUNCTION "public"."trg_moment_deleted"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if old.deleted_at is null and new.deleted_at is not null then
    perform insert_moment(moment_entity_column(TG_TABLE_NAME), new.id, 'deleted', new.deleted_at::text);
  end if;
  return new;
end;
$$;

COMMENT ON FUNCTION "public"."trg_moment_deleted"() IS 'Logs a deleted moment on the soft-delete transition (deleted_at NULL -> non-NULL) only — re-saving an already-deleted row, or clearing deleted_at, does not re-fire this.';

CREATE OR REPLACE TRIGGER "moment_deleted_tasks" AFTER UPDATE ON "public"."tasks" FOR EACH ROW WHEN ((("old"."deleted_at" IS NULL) AND ("new"."deleted_at" IS NOT NULL))) EXECUTE FUNCTION "public"."trg_moment_deleted"();
CREATE OR REPLACE TRIGGER "moment_deleted_sections" AFTER UPDATE ON "public"."sections" FOR EACH ROW WHEN ((("old"."deleted_at" IS NULL) AND ("new"."deleted_at" IS NOT NULL))) EXECUTE FUNCTION "public"."trg_moment_deleted"();
CREATE OR REPLACE TRIGGER "moment_deleted_projects" AFTER UPDATE ON "public"."projects" FOR EACH ROW WHEN ((("old"."deleted_at" IS NULL) AND ("new"."deleted_at" IS NOT NULL))) EXECUTE FUNCTION "public"."trg_moment_deleted"();

-- 4. moved: reparenting. tasks.section_id and sections.project_id are
-- different columns on different tables, so one function branches on
-- TG_TABLE_NAME rather than duplicating the body.

CREATE OR REPLACE FUNCTION "public"."trg_moment_moved"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if TG_TABLE_NAME = 'tasks' then
    if old.section_id is distinct from new.section_id then
      perform insert_moment('task_id', new.id, 'moved', new.section_id::text, null, old.section_id::text);
    end if;
  elsif TG_TABLE_NAME = 'sections' then
    if old.project_id is distinct from new.project_id then
      perform insert_moment('section_id', new.id, 'moved', new.project_id::text, null, old.project_id::text);
    end if;
  end if;
  return new;
end;
$$;

COMMENT ON FUNCTION "public"."trg_moment_moved"() IS 'Logs a moved moment when a task is reparented to a different section, or a section to a different project (value/previous_value hold the new/old parent id as text).';

CREATE OR REPLACE TRIGGER "moment_moved_tasks" AFTER UPDATE ON "public"."tasks" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_moved"();
CREATE OR REPLACE TRIGGER "moment_moved_sections" AFTER UPDATE ON "public"."sections" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_moved"();

-- 5. task_items (the TaskDetailModal checklist): already an ALLOWED_TABLES
-- entry and already editable from the UI, but with no trigger it never
-- reached the moments feed. Logged against the parent task's task_id, since
-- task_items has no entity column of its own in the moments table.

CREATE OR REPLACE FUNCTION "public"."trg_moment_item"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.task_id is null then
    return new;
  end if;

  if TG_OP = 'INSERT' then
    perform insert_moment('task_id', new.task_id, 'item', new.done::text);
  elsif old.done is distinct from new.done then
    perform insert_moment('task_id', new.task_id, 'item', new.done::text, null, old.done::text);
  end if;

  return new;
end;
$$;

COMMENT ON FUNCTION "public"."trg_moment_item"() IS 'Logs an item moment against the parent task when a checklist item is created or its done flag toggles (not on description/order edits).';

CREATE OR REPLACE TRIGGER "moment_item_tasks" AFTER INSERT OR UPDATE ON "public"."task_items" FOR EACH ROW EXECUTE FUNCTION "public"."trg_moment_item"();

-- 6. Put moments on the realtime publication so the in-app watcher
-- (src/lib/chat/changeWatcher.ts) can subscribe to postgres_changes instead
-- of polling. RLS on moments is already "allow all", so the anon key
-- receives these events same as any select.
ALTER PUBLICATION supabase_realtime ADD TABLE public.moments;

-- 7. Idempotency ledger for the single-trigger-across-tabs rule: whoever
-- inserts a given last_moment_id first is the instance that runs the nudge
-- turn; everyone else gets a duplicate-key error and backs off. Same shape
-- as telegram_notifications' ledger, written by the browser anon client
-- (every tab races this insert), not a service-role Edge Function.
CREATE TABLE IF NOT EXISTS "public"."assistant_nudges" (
    "last_moment_id" "uuid" PRIMARY KEY,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);

ALTER TABLE "public"."assistant_nudges" OWNER TO "postgres";
ALTER TABLE "public"."assistant_nudges" ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE "public"."assistant_nudges" IS 'Idempotency ledger so only one browser tab/instance runs the reactive nudge turn for a given batch of moments. Insert conflict on last_moment_id means another instance already claimed it.';

GRANT ALL ON TABLE "public"."assistant_nudges" TO "anon";
GRANT ALL ON TABLE "public"."assistant_nudges" TO "authenticated";
GRANT ALL ON TABLE "public"."assistant_nudges" TO "service_role";

CREATE POLICY "allow all" ON "public"."assistant_nudges" USING (true) WITH CHECK (true);

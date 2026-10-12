-- Adds an explicit, persisted ordering queue for pending tasks ("the order
-- in which they'll be done"), separate from tasks_sequence (which encodes
-- dependency, not display order — see the comment on
-- src/lib/api/sequence.ts). backlog_rank is a plain numeric rank, not a
-- linked list: moving one task writes exactly one row. NULL means the task
-- isn't in the backlog queue at all.
--
-- The trigger only logs a 'backlog' moment on the NULL <-> non-NULL
-- transition (entered/left the queue), not on every reorder, so dragging a
-- task up and down the list doesn't spam the moments timeline.

ALTER TABLE "public"."tasks"
  ADD COLUMN "backlog_rank" double precision;

COMMENT ON COLUMN "public"."tasks"."backlog_rank" IS 'Position of this task in the global backlog queue (lower sorts first). NULL means the task is not in the backlog. A plain numeric rank (not a linked list), rebalanced when two neighbors'' ranks collide.';

CREATE INDEX "tasks_backlog_rank_idx" ON "public"."tasks" USING "btree" ("backlog_rank") WHERE (("backlog_rank" IS NOT NULL) AND ("deleted_at" IS NULL));

CREATE OR REPLACE FUNCTION "public"."trg_moment_backlog"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if (old.backlog_rank is null) is distinct from (new.backlog_rank is null) then
    perform insert_moment('task_id', new.id, 'backlog', new.backlog_rank::text, null, old.backlog_rank::text);
  end if;
  return new;
end;
$$;

ALTER FUNCTION "public"."trg_moment_backlog"() OWNER TO "postgres";

COMMENT ON FUNCTION "public"."trg_moment_backlog"() IS 'Trigger function that logs entering/leaving the backlog queue. Fires only when backlog_rank crosses the NULL boundary (joined or left the queue), not on every reorder, so dragging a task within the queue stays silent in the moments ledger.';

GRANT ALL ON FUNCTION "public"."trg_moment_backlog"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_moment_backlog"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_moment_backlog"() TO "service_role";

CREATE OR REPLACE TRIGGER "moment_backlog_tasks" AFTER UPDATE ON "public"."tasks" FOR EACH ROW WHEN (("new"."deleted_at" IS NULL)) EXECUTE FUNCTION "public"."trg_moment_backlog"();

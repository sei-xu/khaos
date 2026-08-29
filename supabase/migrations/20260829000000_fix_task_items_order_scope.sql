-- The previous fix (20260812000000) only resynced the task_items_order_seq
-- sequence once, but the underlying design is still broken: "order" carries
-- a single table-wide UNIQUE constraint (task_items_order_key) backed by one
-- shared IDENTITY sequence, even though "order" is only meant to be unique
-- within a single task's checklist. Any insert that supplies an explicit
-- "order" (or any drift between the sequence and max("order")) makes the
-- sequence fall behind again and every subsequent insert collides with
-- "duplicate key value violates unique constraint \"task_items_order_key\""
-- (409), which is exactly the failure mode this migration is meant to
-- prevent from recurring.
--
-- Replace the global unique constraint with a per-task one, and resync the
-- sequence past the current global max so identity-based inserts don't
-- collide with existing rows.

ALTER TABLE "public"."task_items"
  DROP CONSTRAINT IF EXISTS "task_items_order_key";

ALTER TABLE "public"."task_items"
  ADD CONSTRAINT "task_items_order_task_id_key" UNIQUE ("task_id", "order");

SELECT setval(
  'public.task_items_order_seq',
  COALESCE((SELECT max("order") FROM public.task_items), 0) + 1,
  false
);

-- The task_items.order column is backed by an IDENTITY sequence
-- (task_items_order_seq) enforcing a table-wide unique constraint. The
-- sequence had fallen behind the highest "order" value already present in
-- task_items (likely from rows inserted with an explicit "order" outside
-- the sequence), so new inserts that rely on the identity default collided
-- with existing rows and failed with "duplicate key value violates unique
-- constraint \"task_items_order_key\"" (409).
--
-- Resync the sequence to start past the current max so new inserts no
-- longer collide.
SELECT setval(
  'public.task_items_order_seq',
  COALESCE((SELECT max("order") FROM public.task_items), 0) + 1,
  false
);

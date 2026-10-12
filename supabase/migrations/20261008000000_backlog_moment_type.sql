-- Adds 'backlog' to moment_types, mirroring the today/notToday pair
-- (20260819000000): it logs entering/leaving the task backlog queue (see
-- 20261008010000_task_backlog_rank.sql, which adds tasks.backlog_rank and
-- the trigger that writes this moment). ALTER TYPE ... ADD VALUE cannot run
-- in the same transaction as code referencing the new value, so the column
-- and trigger live in a separate migration that runs after this one.
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'backlog';

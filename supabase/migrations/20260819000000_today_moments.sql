-- Adds 'today' / 'notToday' to moment_types, mirroring the started/stopped
-- pair already in the enum. These back the "mark for today" toggle on
-- tasks: inserting a 'today' moment (value = target date, usually today,
-- but any future date works for planning ahead) marks the task, a
-- 'notToday' moment with the same value unmarks it. Moments are never
-- updated or deleted, so the current state for a given date is derived as
-- whichever of the two is most recent for that (task_id, value) pair.
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'today';
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'notToday';

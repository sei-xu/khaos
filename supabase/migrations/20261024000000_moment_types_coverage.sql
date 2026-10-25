-- Widens moment_types so the feed can cover the gaps found while wiring up
-- reactive assistant suggestions (docs/backlog.md): soft-deletes, renames,
-- reparenting, and checklist items currently produce no moment at all. Mirrors
-- the today/notToday/backlog pattern (20260819000000, 20261008000000):
-- ALTER TYPE ... ADD VALUE cannot run in the same transaction as code that
-- references the new value, so the triggers that write these live in the
-- next migration (20261024010000_moments_full_coverage.sql).
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'deleted';
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'renamed';
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'moved';
ALTER TYPE "public"."moment_types" ADD VALUE IF NOT EXISTS 'item';

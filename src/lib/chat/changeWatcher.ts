// Pure buffering/gating logic for the DB-change-detection watcher
// (useDbChangeFeed.ts wires this to a Realtime subscription + poll fallback).
// Kept free of Supabase/React/timers so it's unit-testable with injected
// clock values — the hook owns the actual setTimeout and "now".

export interface MomentRow {
  id: string;
  moment_type: string;
  value: string | null;
  previous_value: string | null;
  authored_by: string;
  created_at: string;
  task_id: string | null;
  section_id: string | null;
  project_id: string | null;
  routine_id: string | null;
}

// Deterministic gate, run before any model call: only these moment shapes
// are worth reacting to. 'status' is worthy only on the transitions a user
// would actually want followed up on (done/cancelled) — every other status
// move (todo <-> in_progress, etc.) stays silent. due/estimate/priority/
// renamed/moved/item/note and the rest are informative in the prefix but
// don't by themselves justify spending a model call.
const STATUS_VALUES_WORTH_A_NUDGE = new Set(['done', 'cancelled']);
const MOMENT_TYPES_ALWAYS_WORTH_A_NUDGE = new Set([
  'created',
  'today',
  'backlog',
  'deleted',
]);

export function isNudgeWorthy(
  moment: Pick<MomentRow, 'moment_type' | 'value'>
): boolean {
  if (moment.moment_type === 'status') {
    return STATUS_VALUES_WORTH_A_NUDGE.has(moment.value ?? '');
  }
  return MOMENT_TYPES_ALWAYS_WORTH_A_NUDGE.has(moment.moment_type);
}

// Accumulates moments between flushes. A "marked done" in the UI cascades
// into several moments (status, maybe item, maybe a sequence unlock later),
// so this waits for ~silenceMs of quiet before a batch is considered
// settled, rather than reacting to the first row.
export class ChangeBuffer {
  private pending: MomentRow[] = [];
  private lastPushAt: number | null = null;

  push(rows: MomentRow[], nowMs: number): void {
    const attributable = rows.filter((r) => r.authored_by !== 'assistant');
    if (!attributable.length) return;
    this.pending.push(...attributable);
    this.lastPushAt = nowMs;
  }

  isEmpty(): boolean {
    return this.pending.length === 0;
  }

  shouldFlush(nowMs: number, silenceMs: number): boolean {
    return (
      this.pending.length > 0 &&
      this.lastPushAt !== null &&
      nowMs - this.lastPushAt >= silenceMs
    );
  }

  // Drains the buffer unconditionally (so an all-noise batch doesn't keep
  // getting re-checked every tick) and returns the batch only if at least
  // one buffered row clears isNudgeWorthy — the returned rows include every
  // buffered row, not just the worthy ones, since the worthy row's context
  // (e.g. a 'due' change next to the 'status' done) is useful to the model.
  takeWorthyBatch(): { rows: MomentRow[]; lastMomentId: string } | null {
    const rows = this.pending;
    this.pending = [];
    this.lastPushAt = null;
    if (!rows.length || !rows.some(isNudgeWorthy)) return null;
    return { rows, lastMomentId: rows[rows.length - 1].id };
  }
}

// Session-level rate limiting: a cooldown between nudges, plus a hard cap
// on nudges per rolling hour (nudgeTimestampsMs is expected to already be
// pruned/accumulated by the caller — this just filters to the last hour so
// a caller that never prunes still gets a correct count).
export function canNudge(params: {
  lastNudgeAtMs: number | null;
  nudgeTimestampsMs: number[];
  nowMs: number;
  cooldownMs: number;
  maxPerHour: number;
}): boolean {
  const { lastNudgeAtMs, nudgeTimestampsMs, nowMs, cooldownMs, maxPerHour } =
    params;
  if (lastNudgeAtMs !== null && nowMs - lastNudgeAtMs < cooldownMs) {
    return false;
  }
  const hourAgo = nowMs - 60 * 60 * 1000;
  const recentCount = nudgeTimestampsMs.filter((t) => t > hourAgo).length;
  return recentCount < maxPerHour;
}

// formatDbChangePrefix interpolates free-form moment text (a task/section
// name, a note body, ...) into "(...)" segments that turnPrefix.ts's
// ITEM_RE/findMatchingBracketEnd rely on being free of ';', '(', ')', '[' and
// ']' — any of those in the value breaks the parse (an unmatched line is
// dropped silently; an unmatched '[' or ']' can derail the whole prefix, see
// turnPrefix.test.ts). Stripping them here, at the source, is simpler than an
// escape/unescape round trip and loses nothing meaningful for a one-line
// activity summary; also cap length so one long rename can't blow up the
// prefix.
const MOMENT_TEXT_MAX_LENGTH = 40;

function sanitizeMomentText(text: string): string {
  const stripped = text.replace(/[;()[\]]/g, '');
  return stripped.length > MOMENT_TEXT_MAX_LENGTH
    ? `${stripped.slice(0, MOMENT_TEXT_MAX_LENGTH)}…`
    : stripped;
}

// Renders the compact batch summary that becomes the [DB Change: ...]
// prefix on the hidden turn (see useChatAgent.ts / prompts.ts). One line per
// moment: entity type + id, moment type, previous->new (or just the value
// when there's no previous_value), and who authored it.
export function formatDbChangePrefix(rows: MomentRow[]): string {
  const lines = rows.map((r) => {
    const entityType = r.task_id
      ? 'task'
      : r.section_id
        ? 'section'
        : r.project_id
          ? 'project'
          : r.routine_id
            ? 'routine'
            : 'unknown';
    const entityId =
      r.task_id ?? r.section_id ?? r.project_id ?? r.routine_id ?? 'unknown';
    const value = r.value != null ? sanitizeMomentText(r.value) : null;
    const previousValue =
      r.previous_value != null ? sanitizeMomentText(r.previous_value) : null;
    const transition =
      previousValue != null ? `${previousValue}->${value}` : value ?? '';
    const suffix = transition ? ` (${transition})` : '';
    return `${entityType} ${entityId}: ${r.moment_type}${suffix} [${r.authored_by}]`;
  });
  return `[DB Change: ${lines.join('; ')}]`;
}

export const DEFAULT_SILENCE_MS = 8000;
export const DEFAULT_COOLDOWN_MINUTES = 10;
export const DEFAULT_MAX_PER_HOUR = 6;

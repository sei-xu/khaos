// Postgres returns tstzrange columns as text like:
//   ["2024-06-21 10:00:00+00","2024-06-21 11:00:00+00")
// or with an open (still running) upper bound:
//   ["2024-06-21 10:00:00+00",)
// This module parses that text into {start, end} Dates and formats Dates
// back into a literal Postgres will accept on insert/update.

export interface ParsedRange {
  start: Date | null;
  end: Date | null;
  lowerInclusive?: boolean;
  upperInclusive?: boolean;
}

export function parseRange(rangeStr: unknown): ParsedRange {
  if (!rangeStr || typeof rangeStr !== 'string') {
    return { start: null, end: null };
  }
  const trimmed = rangeStr.trim();
  if (trimmed.length < 2) return { start: null, end: null };

  const lowerInclusive = trimmed[0] === '[';
  const upperInclusive = trimmed[trimmed.length - 1] === ']';
  const inner = trimmed.slice(1, -1);

  // Split on the first comma that isn't inside quotes.
  let splitAt = -1;
  let inQuotes = false;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (ch === ',' && !inQuotes) {
      splitAt = i;
      break;
    }
  }
  const startRaw = (splitAt === -1 ? inner : inner.slice(0, splitAt))
    .replace(/^"|"$/g, '')
    .trim();
  const endRaw = (splitAt === -1 ? '' : inner.slice(splitAt + 1))
    .replace(/^"|"$/g, '')
    .trim();

  return {
    start: startRaw ? new Date(startRaw) : null,
    end: endRaw ? new Date(endRaw) : null,
    lowerInclusive,
    upperInclusive,
  };
}

export function formatRange(
  start: Date | string | null | undefined,
  end: Date | string | null | undefined
): string {
  const s = start ? new Date(start).toISOString() : '';
  const e = end ? new Date(end).toISOString() : '';
  return `[${s},${e})`;
}

export function isOpenRange(rangeStr: unknown): boolean {
  const { start, end } = parseRange(rangeStr);
  return Boolean(start) && !end;
}

// Following the app-wide convention (see TargetEditor.getLocalValues), a date
// is considered to carry no explicit time when its local wall clock sits at
// exactly midnight (00:00).
function isUntimed(d: Date): boolean {
  return d.getHours() === 0 && d.getMinutes() === 0;
}

// Returns a copy of `d` moved to the last moment of its local day (23:59:59.999).
export function endOfLocalDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(23, 59, 59, 999);
  return out;
}

// Public counterpart of isUntimed — shared by TargetBadge/TargetEditor so
// both agree on what counts as "no explicit time" instead of keeping their
// own copies of the same midnight check.
export function hasExplicitTime(d: Date): boolean {
  return !isUntimed(d);
}

// A range reads as a single all-day window when it starts at local midnight
// and ends at 23:59 of that same local day — the shape TargetEditor already
// produces for a target given only a start date (see effectiveEnd above).
// Display can then collapse it to just the start date instead of spelling
// out a start→end pair that says nothing beyond "that one day".
export function isAllDayRange(start: Date | null, end: Date | null): boolean {
  if (!start || !end) return false;
  const sameLocalDay =
    start.getFullYear() === end.getFullYear() &&
    start.getMonth() === end.getMonth() &&
    start.getDate() === end.getDate();
  return sameLocalDay && isUntimed(start) && end.getHours() === 23 && end.getMinutes() === 59;
}

// A `target` is a planning window, and its "end target" is the moment by which
// the work is meant to be finished. The concept:
//   • a single date (no end bound) means "do it that day" — end target is
//     23:59 of that day;
//   • an end date means the end target is 23:59 of that date;
//   • an explicit time on the relevant date is honoured as-is.
// Every target therefore has an end target — there is no open-ended target.
export function targetEnd(rangeStr: unknown): Date | null {
  const { start, end } = parseRange(rangeStr);
  const boundary = end ?? start;
  if (!boundary || isNaN(boundary.getTime())) return null;
  return isUntimed(boundary) ? endOfLocalDay(boundary) : boundary;
}

export function rangeDurationMinutes(
  rangeStr: unknown,
  now: Date = new Date()
): number {
  const { start, end } = parseRange(rangeStr);
  if (!start) return 0;
  const endTime = end || now;
  return Math.max(0, Math.round((endTime.getTime() - start.getTime()) / 60000));
}

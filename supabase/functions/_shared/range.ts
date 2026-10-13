// Postgres tstzrange text <-> Date helpers, shared by the Edge Functions that
// read or write events.duration (telegram-notify's reminders,
// google-calendar-sync's push/pull).

// "2026-07-20 11:00:00+00" → ISO the Date constructor accepts everywhere.
function parseBound(raw: string): Date | null {
  let s = raw.trim().replace(' ', 'T');
  s = s.replace(/([+-]\d{2})$/, '$1:00'); // "+00" → "+00:00"
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Both bounds of a bounded range (events.duration is constrained to be
// bounded and non-empty by duration_must_be_bounded).
export function parseRange(
  range: string | null
): { start: Date; end: Date } | null {
  if (!range) return null;
  const m = range.match(
    /^[[(]\s*"?([^",]+?)"?\s*,\s*"?([^",)\]]+?)"?\s*[)\]]$/
  );
  if (!m) return null;
  const start = parseBound(m[1]);
  const end = parseBound(m[2]);
  if (!start || !end) return null;
  return { start, end };
}

// Lower bound only — matches on its own so it still works for a range whose
// upper bound isn't parseable (or is infinite).
export function parseRangeLower(range: string | null): Date | null {
  if (!range) return null;
  const m = range.match(/^[[(]\s*"?([^",]+?)"?\s*,/);
  if (!m) return null;
  return parseBound(m[1]);
}

export function rangeLiteral(start: Date, end: Date): string {
  return `["${start.toISOString()}","${end.toISOString()}")`;
}

// ---------------------------------------------------------------------------
// Timezone preference
// Stored in localStorage so it survives refreshes.
// Defaults to the browser's own IANA timezone (usually correct).
// ---------------------------------------------------------------------------

export type DateInput = Date | string | number | null | undefined;

const STORAGE_KEY = 'logbook.timezone';

export function getTimezone(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && Intl.supportedValuesOf('timeZone').includes(stored))
      return stored;
  } catch {
    // localStorage unavailable
  }
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function setTimezone(tz: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, tz);
    // Reload so all cached date computations refresh.
    window.location.reload();
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// moments.time is stored as `timestamp without time zone`.
// Supabase/Postgres runs in UTC, so the value is UTC — but the string has no
// "+00" suffix, so `new Date("2024-06-21 12:00:00")` is wrongly treated as
// local time by most browsers. We fix this by appending "Z".
// ---------------------------------------------------------------------------

export function parseMomentTime(timeStr: unknown): Date | null {
  if (!timeStr) return null;
  const s = String(timeStr).trim();
  // Already has a timezone marker — parse as-is.
  if (s.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(s)) return new Date(s);
  // No marker → assume UTC (Supabase server default).
  return new Date(s + 'Z');
}

// ---------------------------------------------------------------------------
// Timezone-aware Intl formatters
// We use Intl directly (no extra deps) so we can pass an explicit timezone.
// ---------------------------------------------------------------------------

function fmt(
  date: DateInput,
  options: Intl.DateTimeFormatOptions,
  tz?: string
): string {
  const d = new Date(date ?? NaN);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('default', {
    ...options,
    timeZone: tz || getTimezone(),
  }).format(d);
}

interface FormatInTzOptions {
  weekday?: Intl.DateTimeFormatOptions['weekday'];
  year?: Intl.DateTimeFormatOptions['year'];
  month?: Intl.DateTimeFormatOptions['month'];
  day?: Intl.DateTimeFormatOptions['day'];
  hour?: Intl.DateTimeFormatOptions['hour'];
  minute?: Intl.DateTimeFormatOptions['minute'];
}

export function formatInTz(
  dateInput: DateInput,
  { weekday, year, month, day, hour, minute }: FormatInTzOptions = {},
  tz?: string
): string {
  if (!dateInput) return '';
  return fmt(dateInput, { weekday, year, month, day, hour, minute }, tz);
}

// Returns the HH:mm string in the user's timezone
export function formatTime(dateInput: DateInput, tz?: string): string {
  if (!dateInput) return '';
  return fmt(
    dateInput,
    { hour: '2-digit', minute: '2-digit', hour12: false },
    tz
  );
}

// Returns "d MMM yyyy" in the user's timezone
export function formatDate(dateInput: DateInput, tz?: string): string {
  if (!dateInput) return '';
  return fmt(
    dateInput,
    { day: 'numeric', month: 'short', year: 'numeric' },
    tz
  );
}

// Human-friendly relative label: "Today, 14:30", "Tomorrow, 09:00", etc.
export function formatDueInTz(dateInput: DateInput, tz?: string): string | null {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const zone = tz || getTimezone();

  const todayParts = partsInTz(new Date(), zone);
  const dParts = partsInTz(d, zone);

  const time = formatTime(d, zone);
  const diffDays =
    julianDay(dParts.year, dParts.month, dParts.day) -
    julianDay(todayParts.year, todayParts.month, todayParts.day);

  if (diffDays === 0) return `Today, ${time}`;
  if (diffDays === 1) return `Tomorrow, ${time}`;
  if (diffDays === -1) return `Yesterday, ${time}`;
  if (diffDays > 1 && diffDays < 7)
    return `${fmt(d, { weekday: 'long' }, zone)}, ${time}`;
  return `${formatDate(d, zone)}, ${time}`;
}

// Checks whether a date is overdue in the user's timezone
export function isOverdueInTz(
  dateInput: DateInput,
  status?: string | null,
  _tz?: string
): boolean {
  if (!dateInput) return false;
  if (status === 'done' || status === 'cancelled') return false;
  return new Date(dateInput) < new Date();
}

// Today's date as 'YYYY-MM-DD' in the user's timezone — the key used to
// mark/unmark tasks "for today" independent of exact time.
export function todayDateStringInTz(tz?: string): string {
  const { year, month, day } = partsInTz(new Date(), tz || getTimezone());
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Checks whether a date falls on today in the user's timezone
export function isTodayInTz(dateInput: DateInput, tz?: string): boolean {
  if (!dateInput) return false;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return false;
  const zone = tz || getTimezone();
  const a = partsInTz(d, zone);
  const b = partsInTz(new Date(), zone);
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

// Converts a UTC Date to the value an <input type="datetime-local"> expects,
// expressed in the user's timezone (not the system locale).
export function toDatetimeLocalInTz(dateInput: DateInput, tz?: string): string {
  if (!dateInput) return '';
  const zone = tz || getTimezone();
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return '';
  const p = partsInTz(d, zone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

// Parses the value from <input type="datetime-local"> as if it is in the
// user's timezone, returning a UTC Date.
export function fromDatetimeLocalInTz(
  localStr: string | null | undefined,
  tz?: string
): Date | null {
  if (!localStr) return null;
  const zone = tz || getTimezone();
  // e.g. "2024-06-21T14:30"
  const [datePart, timePart = '00:00'] = localStr.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);

  // Use Intl to find the UTC offset at this wall-clock time in this timezone.
  // We construct an approximate UTC timestamp, then measure the offset, then correct.
  const approxUtc = Date.UTC(year, month - 1, day, hour, minute);
  const offset = getUtcOffsetMs(new Date(approxUtc), zone);
  return new Date(approxUtc - offset);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

interface TzParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function partsInTz(date: Date, tz: string): TzParts {
  if (isNaN(date.getTime())) {
    return { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0 };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour') % 24, // Intl returns 24 for midnight in some locales
    minute: get('minute'),
    second: get('second'),
  };
}

function getUtcOffsetMs(date: Date, tz: string): number {
  // Reconstruct the wall-clock time in tz as if it were UTC, then subtract.
  const p = partsInTz(date, tz);
  const wallAsUtc = Date.UTC(
    p.year,
    p.month - 1,
    p.day,
    p.hour,
    p.minute,
    p.second
  );
  return wallAsUtc - date.getTime();
}

// Simple Julian Day Number for day-difference arithmetic without importing date-fns
function julianDay(y: number, m: number, d: number): number {
  return (
    Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d - 1524
  );
}

// All IANA timezone names available in this browser — used by the picker.
export function getAllTimezones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    // Fallback for older browsers
    return [
      'UTC',
      'America/Sao_Paulo',
      'America/New_York',
      'America/Chicago',
      'America/Los_Angeles',
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Asia/Tokyo',
      'Asia/Shanghai',
      'Australia/Sydney',
    ];
  }
}

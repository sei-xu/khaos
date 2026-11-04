// Pure logic for materializing routine templates (public.routines) into
// calendar occurrences (public.events, event_type='routine'). No runtime
// import, no Date.now() call, no randomness — same inputs always produce
// the same outputs. This is the ONLY place routine-frequency semantics
// live; the cron Edge Function (supabase/functions/routine-events), the
// assistant tool (materialize_routines in src/lib/chat/toolsCore.ts) and
// this module's own tests all call plannedOccurrences() instead of each
// re-deriving "what does 3x_week mean" on their own. Mirrors the
// import-free pattern of src/lib/chat/toolsCore.ts, which the Edge
// Function side already imports via a relative path.
//
// FREQUENCY_OPTIONS in src/lib/constants.ts is the contract this module
// implements: daily, every_2_days, 1x_week..5x_week, weekday, weekend,
// 1x_month, 2x_month. routines.frequency is free text in the database
// (the column comment still allows a cron expression), so anything outside
// that list is skipped with a console.warn naming the routine — never
// guessed at. Better an occurrence that's visibly missing than one
// invented on the calendar.
//
// Distribution: a routine like "1x_week" or "1x_month" does not pin every
// routine to the same day (every Monday, every 1st of the month) — that
// piles every habit onto the same slot and defeats the point of spreading
// load across the week/month. Nx_week picks N roughly evenly-spaced
// weekdays, shifted by a stable per-routine hash so two different 1x_week
// routines don't collide. Monthly ones pick day-of-month slots that avoid
// the weekdays most already loaded by other active weekly-type routines —
// an approximation of "when is there more free time", built only from the
// routines list itself (this module takes no DB access, so it cannot look
// at actual calendar density/history; that would be a future improvement
// layered on top by whichever caller has DB access).
//
// Habit status / reschedule-on-skip: events carries an optional
// routine_status ('done' | 'partial' | 'skipped'), set by the user/assistant
// after the fact — it is not part of the planning grid. A 'skipped'
// Nx_week occurrence owes exactly one makeup occurrence, placed on the
// first day after the skip that isn't a base day for that routine, within
// that ISO week (or, failing that, within the following week) — chosen
// deterministically from the skip and the routine's own grid alone, never
// from `existing`, so the same skip always yields the same makeup instant
// and re-materializing it is a no-op (dedup handles the rest). With more
// than one skip landing in the same window, skips are walked in date order
// and each reserves its day so they don't collide with each other.
// 'done'/'partial' never reschedule; the habit was attempted, not skipped.

export type RoutineStatus = 'done' | 'partial' | 'skipped';
export const ROUTINE_STATUSES: RoutineStatus[] = ['done', 'partial', 'skipped'];

// The routine grid is a property of the owner's calendar, not of whichever
// device/host called materialize_routines — events.routine_day (the
// idx_events_routine_dedup key) is the local day in this zone, so every
// caller resolving preferred_time must agree on the zone or they disagree
// on which day is already materialized.
export const DEFAULT_ROUTINE_TIMEZONE = 'America/Sao_Paulo';

export interface RoutineInput {
  id: string;
  name: string;
  frequency: string;
  preferred_time: string | null;
  estimate: number | null;
  active: boolean;
  task_id: string | null;
  field_id: string | null;
}

export interface ExistingOccurrence {
  routine_id: string;
  start: Date;
  status: RoutineStatus | null;
}

export interface PlannedOccurrence {
  routine_id: string;
  name: string;
  field_id: string | null;
  task_id: string | null;
  start: Date;
  end: Date;
}

// --- calendar-day helpers (plain Y/M/D, timezone-aware only at the edges) --

interface CalendarDay {
  y: number;
  m: number; // 1-12
  d: number;
}

// Date.UTC/getUTC* used purely as calendar arithmetic (no real instant is
// implied) — a stable way to add/subtract whole days without DST concerns.
function dayToUtcProxy(day: CalendarDay): Date {
  return new Date(Date.UTC(day.y, day.m - 1, day.d));
}

function utcProxyToDay(date: Date): CalendarDay {
  return {
    y: date.getUTCFullYear(),
    m: date.getUTCMonth() + 1,
    d: date.getUTCDate(),
  };
}

function addDays(day: CalendarDay, n: number): CalendarDay {
  return utcProxyToDay(new Date(dayToUtcProxy(day).getTime() + n * 86400000));
}

function compareDays(a: CalendarDay, b: CalendarDay): number {
  return dayToUtcProxy(a).getTime() - dayToUtcProxy(b).getTime();
}

function dayKey(day: CalendarDay): string {
  return `${day.y}-${String(day.m).padStart(2, '0')}-${String(day.d).padStart(2, '0')}`;
}

// 0 = Monday .. 6 = Sunday (ISO-ish; JS getUTCDay is 0 = Sunday).
function isoDow(day: CalendarDay): number {
  return (dayToUtcProxy(day).getUTCDay() + 6) % 7;
}

function weekStart(day: CalendarDay): CalendarDay {
  return addDays(day, -isoDow(day));
}

// Intl.DateTimeFormat construction dominates the cost of this module (both
// helpers below run once per candidate day, times once per routine), and the
// only varying input is the zone — so the two formatters are built once per
// timeZone and reused. Same output, ~20x less time per plannedOccurrences call.
const dayFormatters = new Map<string, Intl.DateTimeFormat>();
const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function formatterParts(
  cache: Map<string, Intl.DateTimeFormat>,
  timeZone: string,
  build: () => Intl.DateTimeFormat,
  date: Date
): Record<string, string> {
  let formatter = cache.get(timeZone);
  if (!formatter) {
    formatter = build();
    cache.set(timeZone, formatter);
  }
  const map: Record<string, string> = {};
  for (const p of formatter.formatToParts(date))
    if (p.type !== 'literal') map[p.type] = p.value;
  return map;
}

function localDay(date: Date, timeZone: string): CalendarDay {
  const map = formatterParts(
    dayFormatters,
    timeZone,
    () =>
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }),
    date
  );
  return { y: Number(map.year), m: Number(map.month), d: Number(map.day) };
}

// Minutes that local wall-clock time is ahead of UTC at the given instant
// (negative west of UTC, e.g. -180 for America/Sao_Paulo).
function tzOffsetMinutes(instant: Date, timeZone: string): number {
  const map = formatterParts(
    offsetFormatters,
    timeZone,
    () =>
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        hour12: false,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }),
    instant
  );
  const hour = map.hour === '24' ? 0 : Number(map.hour);
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    hour,
    Number(map.minute),
    Number(map.second)
  );
  return (asUtc - instant.getTime()) / 60000;
}

// Resolves a local wall-clock day/time in `timeZone` to the UTC instant it
// represents. Brazil has had no DST since 2019 (see google-calendar-sync's
// own TZ_OFFSET assumption), so a single offset lookup is exact for the
// configured default timezone and correct to within the DST-transition
// second for any other.
function zonedTimeToUtc(
  day: CalendarDay,
  hour: number,
  minute: number,
  timeZone: string
): Date {
  const guess = new Date(Date.UTC(day.y, day.m - 1, day.d, hour, minute, 0));
  const offsetMinutes = tzOffsetMinutes(guess, timeZone);
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

// UTC instant of local midnight on the calendar day that contains
// `instant`. Exported for the callers that have to turn "today" / "today +
// 7 days" into a window before calling plannedOccurrences
// (supabase/functions/routine-events), so the zone arithmetic lives in one
// place instead of being re-derived from Intl parts on the caller's side.
export function localDayStart(instant: Date, timeZone: string): Date {
  return zonedTimeToUtc(localDay(instant, timeZone), 0, 0, timeZone);
}

// 'YYYY-MM-DD' of the local calendar day containing `instant` — the value
// stored in events.routine_day (the day the generator planned an occurrence
// for) and the shape the de-dup key in materialize.ts compares.
export function localDateString(instant: Date, timeZone: string): string {
  const { y, m, d } = localDay(instant, timeZone);
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

// Inverse of localDateString for the planner: an instant that falls on the
// given local day in `timeZone` (local noon, so it is robust to any offset).
// materialize.ts uses it to hand plannedOccurrences an `existing` row whose
// duration Google may have moved to another day but whose routine_day still
// says which day it stands in for. Null for a malformed string.
export function localNoon(dateString: string, timeZone: string): Date | null {
  const match = dateString.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  return zonedTimeToUtc(
    { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) },
    12,
    0,
    timeZone
  );
}

// --- deterministic per-routine hashing --------------------------------

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// Mixes a routine's hash with a small integer (day-of-month) via a
// Murmur-style finalizer rather than string concatenation — concatenating
// `${id}:${day}` biases on the digit-length of `day` (1 vs 28 differ by a
// char), which collapsed every routine onto the same high day number
// regardless of id. This mix has no such length artifact.
function mixHash(a: number, b: number): number {
  let h = (a ^ Math.imul(b, 0x9e3779b1)) | 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = h ^ (h >>> 16);
  return h >>> 0;
}

// Picks `n` weekdays (0=Mon..6=Sun) roughly evenly spaced across the week,
// shifted by a per-routine hash so routines with the same frequency don't
// all land on the same days.
function spreadWeekdays(routineId: string, n: number): Set<number> {
  const base = hashString(routineId) % 7;
  const spacing = 7 / n;
  const days = new Set<number>();
  for (let i = 0; i < n; i++) {
    const offset = Math.round(i * spacing) % 7;
    days.add((offset + base) % 7);
  }
  return days;
}

// --- frequency recognition --------------------------------------------

const NX_WEEK = /^([1-5])x_week$/;

function isKnownFrequency(freq: string): boolean {
  return (
    freq === 'daily' ||
    freq === 'every_2_days' ||
    freq === 'weekday' ||
    freq === 'weekend' ||
    freq === '1x_month' ||
    freq === '2x_month' ||
    NX_WEEK.test(freq)
  );
}

// --- preferred_time -----------------------------------------------------

const TIME_START: Record<string, [number, number]> = {
  morning: [8, 0],
  afternoon: [14, 0],
  evening: [19, 0],
  night: [21, 30],
  anytime: [9, 0],
};

function startTimeFor(preferredTime: string | null): [number, number] {
  if (preferredTime && TIME_START[preferredTime])
    return TIME_START[preferredTime];
  return [9, 0]; // null / free text we don't recognize — never guessed further
}

// --- monthly day-of-month placement -------------------------------------

// Abstract (not calendar-real) weekday for a day-of-month, used only to
// compare "how loaded is this slot" against the weekly-type routines'
// actual weekday load. Capped at 28 so every pick is valid in every month.
function abstractDow(dayOfMonth: number): number {
  return (dayOfMonth - 1) % 7;
}

function weeklyTypeLoad(routines: RoutineInput[]): number[] {
  const load = [0, 0, 0, 0, 0, 0, 0];
  for (const r of routines) {
    if (r.frequency === 'daily') {
      for (let i = 0; i < 7; i++) load[i]++;
    } else if (r.frequency === 'weekday') {
      for (let i = 0; i < 5; i++) load[i]++;
    } else if (r.frequency === 'weekend') {
      load[5]++;
      load[6]++;
    } else {
      const match = NX_WEEK.exec(r.frequency);
      if (match) {
        for (const dow of spreadWeekdays(r.id, Number(match[1]))) load[dow]++;
      }
    }
  }
  return load;
}

function pickMonthlyDays(
  routineId: string,
  count: 1 | 2,
  load: number[]
): number[] {
  const idHash = hashString(routineId);
  const scored = Array.from({ length: 28 }, (_, i) => {
    const day = i + 1;
    return {
      day,
      score: load[abstractDow(day)],
      tiebreak: mixHash(idHash, day),
    };
  });
  const byScore = (a: (typeof scored)[number], b: (typeof scored)[number]) =>
    a.score - b.score || a.tiebreak - b.tiebreak;

  if (count === 1) {
    return [scored.slice().sort(byScore)[0].day];
  }
  const firstHalf = scored.filter((s) => s.day <= 14).sort(byScore)[0];
  const secondHalf = scored.filter((s) => s.day > 14).sort(byScore)[0];
  return [firstHalf.day, secondHalf.day].sort((a, b) => a - b);
}

// --- base (non-makeup) occurrences --------------------------------------

// `load` (and so pickMonthlyDays' output) depends on the whole active
// routines list, so creating/deactivating any OTHER routine can shift which
// day-of-month a 1x_month/2x_month routine picks mid-month. Without this
// check, that repositioning inserts a second occurrence for the same
// month (or, for 2x_month, the same half) instead of moving the first one —
// idx_events_routine_dedup keys by day, not by routine+month, so nothing
// else stops it. Checking `existing` for a same-period occurrence on a
// DIFFERENT day makes re-materialization idempotent even when `load`
// shifts: the routine keeps whichever day it already has until that
// occurrence itself goes away.
function hasExistingThisPeriod(
  routineId: string,
  day: CalendarDay,
  restrictToHalf: boolean,
  existingDays: Map<string, CalendarDay[]>
): boolean {
  for (const ed of existingDays.get(routineId) ?? []) {
    if (ed.y !== day.y || ed.m !== day.m) continue;
    if (restrictToHalf && ed.d <= 14 !== day.d <= 14) continue;
    if (ed.d === day.d) continue;
    return true;
  }
  return false;
}

// localDay() goes through Intl.DateTimeFormat.formatToParts, and
// hasExistingThisPeriod used to re-derive it for every row of `existing` on
// every candidate day — O(days x existing) parses of the same handful of
// instants, the same waste the formatter caches above exist to avoid. Index
// the local days once per plannedOccurrences() call instead, grouped by
// routine so the lookup only walks that routine's own rows.
function indexExistingDays(
  existing: ExistingOccurrence[],
  timeZone: string
): Map<string, CalendarDay[]> {
  const byRoutine = new Map<string, CalendarDay[]>();
  for (const e of existing) {
    const day = localDay(e.start, timeZone);
    const list = byRoutine.get(e.routine_id);
    if (list) list.push(day);
    else byRoutine.set(e.routine_id, [day]);
  }
  return byRoutine;
}

function matchesDay(
  r: RoutineInput,
  day: CalendarDay,
  dow: number,
  load: number[],
  monthlyCache: Map<string, number[]>,
  existingDays: Map<string, CalendarDay[]>
): boolean {
  if (r.frequency === 'daily') return true;
  if (r.frequency === 'weekday') return dow <= 4;
  if (r.frequency === 'weekend') return dow >= 5;
  if (r.frequency === 'every_2_days') {
    // Phased by the routine's own hash, like spreadWeekdays/pickMonthlyDays
    // below — without it every every_2_days routine shares the same global
    // parity (epochDay % 2) and they all land on, and only on, the same
    // half of the calendar days. The phase doesn't depend on the window
    // (from/to), so this stays deterministic across re-materializations.
    const epochDay = Math.floor(dayToUtcProxy(day).getTime() / 86400000);
    return (epochDay + hashString(r.id)) % 2 === 0;
  }
  const nxWeek = NX_WEEK.exec(r.frequency);
  if (nxWeek) return spreadWeekdays(r.id, Number(nxWeek[1])).has(dow);
  if (r.frequency === '1x_month' || r.frequency === '2x_month') {
    let days = monthlyCache.get(r.id);
    if (!days) {
      days = pickMonthlyDays(r.id, r.frequency === '1x_month' ? 1 : 2, load);
      monthlyCache.set(r.id, days);
    }
    if (!days.includes(day.d)) return false;
    const restrictToHalf = r.frequency === '2x_month';
    return !hasExistingThisPeriod(r.id, day, restrictToHalf, existingDays);
  }
  return false;
}

function buildOccurrence(
  r: RoutineInput,
  day: CalendarDay,
  timeZone: string
): PlannedOccurrence {
  const [hh, mm] = startTimeFor(r.preferred_time);
  const start = zonedTimeToUtc(day, hh, mm, timeZone);
  // events.duration has a duration_must_be_bounded CHECK forbidding an
  // empty range, so a non-positive estimate (0, or a bad negative value)
  // falls back to the same 30-minute default as a missing one instead of
  // producing start === end.
  const minutes = r.estimate && r.estimate > 0 ? r.estimate : 30;
  const end = new Date(start.getTime() + minutes * 60000);
  return {
    routine_id: r.id,
    name: r.name,
    field_id: r.field_id,
    task_id: r.task_id,
    start,
    end,
  };
}

// --- reschedule-on-skip makeups ------------------------------------------

// Deterministic by design: the makeup day for a skip depends only on the
// skipped day and the routine's own base grid (spreadWeekdays), never on
// `existing` — which mixes base occurrences, already-materialized makeups
// and anything else in `events` for that routine, with no way to tell those
// apart. Picking from `existing` made the search see a prior round's own
// makeup as "day taken" and slide to a new day every re-run, inserting one
// extra makeup per cron tick instead of one per skip (see docs/backlog.md).
// Same skip, same inputs -> same instant every time, so
// idx_events_routine_dedup / existingKeys in materialize.ts dedupes the
// re-insertion for free.
function makeupOccurrences(
  schedulable: RoutineInput[],
  existing: ExistingOccurrence[],
  from: Date,
  to: Date,
  timeZone: string
): PlannedOccurrence[] {
  const byId = new Map(schedulable.map((r) => [r.id, r]));
  const weeklyIds = new Set(
    schedulable.filter((r) => NX_WEEK.test(r.frequency)).map((r) => r.id)
  );

  // Skips are processed in date order so that two skips in the same week
  // reserve distinct makeup days deterministically, regardless of the
  // order `existing` happens to list them in.
  const skips = existing
    .filter((e) => e.status === 'skipped' && weeklyIds.has(e.routine_id))
    .slice()
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const reserved = new Map<string, Set<string>>();

  const makeups: PlannedOccurrence[] = [];
  for (const e of skips) {
    const r = byId.get(e.routine_id);
    if (!r) continue;
    const baseDows = spreadWeekdays(
      r.id,
      Number(NX_WEEK.exec(r.frequency)![1])
    );

    const skipDay = localDay(e.start, timeZone);
    const horizon = addDays(weekStart(skipDay), 14); // this week + the next
    const used = reserved.get(r.id) ?? new Set<string>();

    let cursor = addDays(skipDay, 1);
    while (compareDays(cursor, horizon) < 0) {
      const key = dayKey(cursor);
      if (!baseDows.has(isoDow(cursor)) && !used.has(key)) {
        used.add(key);
        reserved.set(r.id, used);
        const dayStartUtc = zonedTimeToUtc(cursor, 0, 0, timeZone);
        if (
          dayStartUtc.getTime() >= from.getTime() &&
          dayStartUtc.getTime() < to.getTime()
        ) {
          makeups.push(buildOccurrence(r, cursor, timeZone));
        }
        break;
      }
      cursor = addDays(cursor, 1);
    }
  }
  return makeups;
}

// --- entry point ----------------------------------------------------------

export function plannedOccurrences(
  routines: RoutineInput[],
  from: Date,
  to: Date,
  timeZone: string,
  existing: ExistingOccurrence[] = []
): PlannedOccurrence[] {
  const schedulable = routines.filter((r) => {
    if (!r.active) return false;
    if (!isKnownFrequency(r.frequency)) {
      console.warn(
        `routine "${r.name}" (${r.id}) has unsupported frequency "${r.frequency}" — skipping occurrence generation rather than guessing`
      );
      return false;
    }
    return true;
  });

  const load = weeklyTypeLoad(schedulable);
  const monthlyCache = new Map<string, number[]>();
  // Only the monthly branch of matchesDay() reads this, so a routines list
  // without one never pays for the indexing.
  const existingDays =
    existing.length &&
    schedulable.some(
      (r) => r.frequency === '1x_month' || r.frequency === '2x_month'
    )
      ? indexExistingDays(existing, timeZone)
      : new Map<string, CalendarDay[]>();

  const base: PlannedOccurrence[] = [];
  let day = localDay(from, timeZone);
  while (true) {
    const dayStartUtc = zonedTimeToUtc(day, 0, 0, timeZone);
    if (dayStartUtc.getTime() >= to.getTime()) break;
    const dow = isoDow(day);
    for (const r of schedulable) {
      if (!matchesDay(r, day, dow, load, monthlyCache, existingDays)) continue;
      const occ = buildOccurrence(r, day, timeZone);
      if (
        occ.start.getTime() < from.getTime() ||
        occ.start.getTime() >= to.getTime()
      )
        continue;
      base.push(occ);
    }
    day = addDays(day, 1);
  }

  const makeups = makeupOccurrences(schedulable, existing, from, to, timeZone);

  return [...base, ...makeups].sort(
    (a, b) => a.start.getTime() - b.start.getTime()
  );
}

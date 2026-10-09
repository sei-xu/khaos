import { useRef, useState } from 'react';
import { Plus, Target, X } from 'lucide-react';
import clsx from 'clsx';
import { TextInput, TimeToggle } from './ui';
import {
  parseRange,
  formatRange,
  endOfLocalDay,
  hasExplicitTime,
  hasExplicitEndTime,
  hasExplicitEnd,
  isAllDayRange,
  targetEnd,
} from '../../lib/range';
import { formatDueCompact, formatTimeOnly } from '../../lib/dateUtils';

interface TargetBadgeProps {
  target?: string | null;
  past?: boolean;
}

// Plain helper, not inlined in the component -- calling `new Date()`
// directly inside a component body trips the "impure function during
// render" lint rule (same reason ui.tsx's own isPastMoment/ScheduledBadge
// pair lives outside the component).
function isPastTarget(target: string): boolean {
  const deadline = targetEnd(target);
  return Boolean(deadline && deadline < new Date());
}

// Compact display of the `target` planning window — start (bold day +
// month, same convention as DueBadge) through end, or an arrow with no
// second date when the target is open-ended. Renders in the design
// system's caution step (tartarus-300 — same danger hue as overdue,
// lighter, see index.css) for a target window that already ended with
// work still open, instead of the neutral gray used for a window covering
// today or later -- `past` lets a caller override the default "compare
// targetEnd to now" check (e.g. Dashboard's own day-boundary grouping),
// but every other caller gets the same red state for free instead of
// needing to compute and pass it themselves. A range that's just "start at
// midnight through 23:59 of the same day" (the shape a single-day target
// already stores, per effectiveEnd below) collapses to showing only the
// start date — spelling out a start→end pair there says nothing beyond
// "that one day".
export function TargetBadge({ target, past }: TargetBadgeProps) {
  if (!target) return null;
  const { start, end } = parseRange(target);
  if (!start) return null;
  const startParts = formatDueCompact(start);
  if (!startParts) return null;
  const allDay = isAllDayRange(start, end);
  const endParts = end && !allDay ? formatDueCompact(end) : null;
  const isPast = past ?? isPastTarget(target);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] tracking-tight',
        isPast ? 'border-tartarus-300 text-tartarus-300' : 'border-nyx-600 text-nyx-400'
      )}
    >
      <Target size={11} className="shrink-0" />
      <span>
        <span className="font-bold">{startParts.day}</span>
        {startParts.month}
      </span>
      {!allDay && hasExplicitTime(start) && (
        <span className="opacity-70">{formatTimeOnly(start)}</span>
      )}
      {endParts && (
        <>
          <span className={isPast ? 'text-tartarus-300' : 'text-nyx-600'}>→</span>
          <span>
            <span className="font-bold">{endParts.day}</span>
            {endParts.month}
          </span>
          {end && hasExplicitEndTime(end) && (
            <span className="opacity-70">{formatTimeOnly(end)}</span>
          )}
        </>
      )}
    </span>
  );
}

interface TargetEditorProps {
  value?: string | null;
  due?: string | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
  // Suppresses the pill's own clear (X) button — used when the host
  // renders a clear action next to the field's label instead (Task Detail
  // Modal). Other callers (Section/Project) keep the pill's own button
  // since they don't have a label row to put it in.
  hideClear?: boolean;
}

function validate(start: Date | null, end: Date | null, due?: string | null) {
  if (!start) return 'Target window needs a start date.';
  // Compare against the effective end target (an untimed end lands at 23:59
  // of its day, same convention effectiveEnd below stores) rather than the
  // raw end, so start==end-with-no-time (an inverted/empty range once
  // stored) is caught here instead of reaching Postgres as a bad range.
  const endTarget = effectiveEnd(start, end);
  if (endTarget && start >= endTarget) return 'Start must be before the end.';
  if (due) {
    const dueDate = new Date(due);
    if (start >= dueDate) return 'Start must be before the due date.';
    if (endTarget && endTarget > dueDate)
      return 'End must be on or before the due date.';
  }
  return null;
}

// Extracts local year, month, day, hour, and minute values without timezone shifts
function getLocalValues(d: Date | null) {
  if (!d || isNaN(d.getTime())) return { date: '', time: '', hasTime: false };
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  // Active time is assumed if it's not exactly midnight (00:00)
  const hasTime = !(hours === '00' && minutes === '00');
  return {
    date: `${year}-${month}-${day}`,
    time: `${hours}:${minutes}`,
    hasTime,
  };
}

// Rebuilds the Date object using strictly local context bounds
function buildLocalDate(
  dateStr: string,
  timeStr: string,
  isTimeActive: boolean
): Date | null {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('-').map(Number);
  const localDate = new Date(year, month - 1, day);
  if (isTimeActive && timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    localDate.setHours(hours, minutes, 0, 0);
  } else {
    localDate.setHours(0, 0, 0, 0);
  }
  return localDate;
}

// A target with no explicit end is meant to cover a single day, not run
// open-ended forever — store that explicitly as 23:59 of the start day
// (unless the start itself carries a specific time, which is honoured as-is)
// so range-overlap queries elsewhere don't treat the target as still active
// on every later day. An explicit end with no time picked follows the same
// convention (23:59 of that day) instead of midnight, so storage agrees
// with targetEnd()/validate()'s own "untimed end = 23:59" assumption and a
// same-day start+end no longer collapses to an empty (and DB-rejected)
// range.
function effectiveEnd(start: Date, end: Date | null): Date | null {
  if (end) return hasExplicitTime(end) ? end : endOfLocalDay(end);
  if (!hasExplicitTime(start)) return endOfLocalDay(start);
  return null;
}

// Triggers the native date/time picker on `input` -- showPicker() is the
// standards way to do it programmatically; .click() is the fallback for
// browsers that don't support it yet (e.g. older Safari), and showPicker()
// itself throws when called outside a user gesture, which the try/catch
// falls back on too.
function openNativePicker(input: HTMLInputElement | null) {
  if (!input) return;
  try {
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
  } catch {
    input.click();
  }
}

export default function TargetEditor({
  value,
  due,
  onChange,
  disabled,
  hideClear,
}: TargetEditorProps) {
  const { start, end } = parseRange(value ?? null);
  // An end only counts as "explicit" (shown in its own field) when it isn't
  // just the implicit single-day end effectiveEnd stores -- otherwise a
  // target given only a start date would render a redundant end field.
  const explicitEnd = hasExplicitEnd(start, end) ? end : null;

  const [error, setError] = useState<string | null>(null);
  const [forceShowEnd, setForceShowEnd] = useState(false);
  const startDateRef = useRef<HTMLInputElement>(null);
  const startTimeRef = useRef<HTMLInputElement>(null);
  const endDateRef = useRef<HTMLInputElement>(null);
  const endTimeRef = useRef<HTMLInputElement>(null);

  // No useMemo around these: `start`/`explicitEnd` come out of parseRange on
  // every render, so they're fresh Date instances each time and a memo keyed
  // on them would never hit -- it only added a dependency check on top of the
  // same work.
  const startValues = getLocalValues(start);
  const endValues = getLocalValues(explicitEnd);

  // Whether the explicit end carries a time the user actually picked --
  // 23:59 is the untimed-end sentinel, so it doesn't count (see
  // hasExplicitEndTime). Shared by the initial state and the prop reset
  // below instead of being spelled out twice.
  const endHasTime = Boolean(explicitEnd && hasExplicitEndTime(explicitEnd));

  const [showStartTime, setShowStartTime] = useState(() => startValues.hasTime);
  const [showEndTime, setShowEndTime] = useState(() => endHasTime);

  // Tracks the last value this editor itself emitted via onChange, so the
  // reset below (which only applies when `value` changes from *outside*,
  // e.g. switching between tasks) doesn't also fire -- and clobber
  // forceShowEnd/the time toggles -- when it's reacting to its own
  // just-committed change coming back down as a prop. State, not a ref,
  // since the comparison below happens during render and refs can't be
  // read there.
  const [lastEmitted, setLastEmitted] = useState(value);
  function emit(next: string | null) {
    setLastEmitted(next);
    onChange(next);
  }

  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value !== lastEmitted) {
      setForceShowEnd(false);
      setError(null);
      setShowStartTime(startValues.hasTime);
      setShowEndTime(endHasTime);
    }
  }

  const showEndInput = Boolean(explicitEnd) || forceShowEnd;

  function commitRange(
    startDateStr: string,
    startTimeStr: string,
    isStartTimeActive: boolean,
    endDateStr: string,
    endTimeStr: string,
    isEndTimeActive: boolean
  ) {
    const nextStart = buildLocalDate(
      startDateStr,
      startTimeStr,
      isStartTimeActive
    );

    if (!nextStart) {
      setError(null);
      emit(null);
      return;
    }

    let nextEnd = showEndInput
      ? buildLocalDate(endDateStr, endTimeStr, isEndTimeActive)
      : null;

    // The start moved and left the previous explicit end behind it -- shift
    // the end by the same delta instead of rejecting the edit, preserving
    // the window's original duration (the alternative, pinning the end to
    // the new start, would collapse that duration instead).
    if (
      start &&
      nextEnd &&
      nextStart.getTime() !== start.getTime() &&
      nextEnd < nextStart
    ) {
      nextEnd = new Date(
        nextEnd.getTime() + (nextStart.getTime() - start.getTime())
      );
    }

    const problem = validate(nextStart, nextEnd, due);
    setError(problem);
    if (problem) return;

    emit(formatRange(nextStart, effectiveEnd(nextStart, nextEnd)));
  }

  // Reveals the end-date field so the target can span more than its start day.
  // The end target itself is only committed once the user picks an end date;
  // until then the target stays a single day.
  function handleAddEnd() {
    setForceShowEnd(true);
  }

  // Drops the end date, turning the target back into a single day (whose end
  // target is 23:59 of that day).
  function handleRemoveEnd() {
    setForceShowEnd(false);
    const nextStart = buildLocalDate(
      startValues.date,
      startValues.time,
      showStartTime
    );
    const problem = validate(nextStart, null, due);
    setError(problem);
    if (problem) return;
    emit(formatRange(nextStart, nextStart && effectiveEnd(nextStart, null)));
  }

  function handleClear() {
    setError(null);
    setForceShowEnd(false);
    emit(null);
  }

  return (
    <div className="@container space-y-1.5">
      {/* one bordered pill, matching TargetBadge exactly — icon on the
          left, dates auto-sized (not stretched full width), no "Start
          Date"/"End Date" labels. Below the @lg container width it switches
          to a 2-column grid: the icon spans both stacked lines, the arrow
          sits centered and rotated between them (see @max-lg: variants
          below) -- a *container* query (keyed to this pill's own available
          width) rather than a viewport one, so it also triggers inside a
          narrow host (e.g. a max-w-sm panel) on an otherwise-wide screen. */}
      <div
        className={clsx(
          // min-h-8.5 matches DueEditor's pill height -- was h-8.5 (fixed),
          // which clipped a second line instead of growing to fit it.
          'border-nyx-600 text-nyx-400 flex min-h-8.5 w-fit flex-wrap items-center gap-1.5 rounded-full border pr-2 pl-3 font-mono',
          // no @max-lg:h-auto / @max-lg:items-center here: with min-h-8.5
          // (instead of the old fixed h-8.5) there is no height to override,
          // and items-center is already on the base class list.
          '@max-lg:grid @max-lg:grid-cols-[auto_1fr] @max-lg:gap-x-2 @max-lg:gap-y-1 @max-lg:rounded-2xl @max-lg:px-3.5 @max-lg:py-2.5'
        )}
      >
        {/* Icon and input text both bumped to match the default input's
            own size (15px icon, text-body) -- was 13px/text-caption,
            smaller than every other input in the app. */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => openNativePicker(startDateRef.current)}
          title="Open start date picker"
          className="text-nyx-400 hover:text-nyx-200 flex shrink-0 items-center disabled:cursor-not-allowed @max-lg:col-start-1 @max-lg:row-span-3 @max-lg:self-center"
        >
          <Target size={15} />
        </button>

        {/* Same layout as DueEditor: date, then (if active) a middot +
            time, then the TimeToggle last -- was icon-first with the
            toggle leading the date, a different order than Due's for no
            real reason. Widths match Due's too (w-[11ch]/w-13). */}
        <span className="inline-flex shrink-0 items-center gap-1.5 @max-lg:col-start-2 @max-lg:row-start-1">
          <TextInput
            ref={startDateRef}
            type="date"
            value={startValues.date}
            disabled={disabled}
            onChange={(e) => {
              commitRange(
                e.target.value,
                startValues.time,
                showStartTime,
                endValues.date,
                endValues.time,
                showEndTime
              );
            }}
            className="due-input text-nyx-400! w-[11ch]! shrink-0 border-0! bg-transparent! p-0! text-center text-body!"
          />
          {showStartTime && startValues.date && (
            <>
              <button
                type="button"
                disabled={disabled}
                onClick={() => openNativePicker(startTimeRef.current)}
                title="Open start time picker"
                className="border-0! bg-transparent! p-0! opacity-50"
              >
                ·
              </button>
              <TextInput
                ref={startTimeRef}
                type="time"
                value={startValues.time || '09:00'}
                disabled={disabled}
                onChange={(e) => {
                  commitRange(
                    startValues.date,
                    e.target.value,
                    true,
                    endValues.date,
                    endValues.time,
                    showEndTime
                  );
                }}
                className="due-input text-nyx-400! w-13! shrink-0 border-0! bg-transparent! p-0! text-center text-body!"
              />
            </>
          )}
          <TimeToggle
            active={showStartTime}
            disabled={disabled}
            onClick={() => {
              const nextState = !showStartTime;
              setShowStartTime(nextState);
              commitRange(
                startValues.date,
                nextState ? startValues.time || '09:00' : '00:00',
                nextState,
                endValues.date,
                endValues.time,
                showEndTime
              );
            }}
          />
        </span>

        {/* The arrow (and second date) only appear once the target spans more
            than its start day. A target with just a start date is a single day
            whose end target is 23:59 of that day — there is no open-ended
            target, so no ∞ glyph. */}
        {showEndInput && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => openNativePicker(endDateRef.current)}
            title="Open end date picker"
            className="text-nyx-600 hover:text-nyx-300 shrink-0 border-0! bg-transparent! p-0! @max-lg:col-start-2 @max-lg:row-start-2 @max-lg:rotate-90 @max-lg:justify-self-center"
          >
            →
          </button>
        )}

        <span className="inline-flex shrink-0 items-center gap-1.5 @max-lg:col-start-2 @max-lg:row-start-3">
          {showEndInput ? (
            <>
              <TextInput
                ref={endDateRef}
                type="date"
                value={endValues.date}
                disabled={disabled}
                onChange={(e) => {
                  commitRange(
                    startValues.date,
                    startValues.time,
                    showStartTime,
                    e.target.value,
                    endValues.time,
                    showEndTime
                  );
                }}
                className="due-input text-nyx-400! w-[11ch]! shrink-0 border-0! bg-transparent! p-0! text-center text-body!"
              />
              {showEndTime && endValues.date && (
                <>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => openNativePicker(endTimeRef.current)}
                    title="Open end time picker"
                    className="border-0! bg-transparent! p-0! opacity-50"
                  >
                    ·
                  </button>
                  <TextInput
                    ref={endTimeRef}
                    type="time"
                    value={endValues.time || '18:00'}
                    disabled={disabled}
                    onChange={(e) => {
                      commitRange(
                        startValues.date,
                        startValues.time,
                        showStartTime,
                        endValues.date,
                        e.target.value,
                        true
                      );
                    }}
                    className="due-input text-nyx-400! w-13! shrink-0 border-0! bg-transparent! p-0! text-center text-body!"
                  />
                </>
              )}
              <TimeToggle
                active={showEndTime}
                disabled={disabled}
                onClick={() => {
                  const nextState = !showEndTime;
                  setShowEndTime(nextState);
                  commitRange(
                    startValues.date,
                    startValues.time,
                    showStartTime,
                    endValues.date,
                    nextState ? endValues.time || '18:00' : '00:00',
                    nextState
                  );
                }}
              />
              <button
                type="button"
                disabled={disabled}
                onClick={handleRemoveEnd}
                title="Remove end date (single day)"
                className="text-nyx-500 hover:text-tartarus-500 flex shrink-0 items-center"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            startValues.date && (
              // Matches the app's standard "add, bordered" pill (Forge)
              // instead of a plain unbordered text+icon link, which was
              // the only add control in the app without that chrome.
              <button
                type="button"
                disabled={disabled}
                onClick={handleAddEnd}
                title="Add end date"
                className="border-nyx-700 text-nyx-500 hover:text-nyx-300 flex shrink-0 items-center gap-0.5 rounded border px-1.5 py-0.5 text-label transition-colors"
              >
                <Plus size={10} /> end
              </button>
            )
          )}
        </span>

        {!hideClear && (start || end) && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            title="Clear target"
            className="text-nyx-500 hover:text-tartarus-500 ml-1 flex shrink-0 items-center @max-lg:col-start-2 @max-lg:row-start-3 @max-lg:ml-auto"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && <p className="text-tartarus-500 text-caption font-medium">{error}</p>}
    </div>
  );
}

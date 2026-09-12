import { useMemo, useState } from 'react';
import { Plus, Target, X } from 'lucide-react';
import clsx from 'clsx';
import { TextInput, TimeToggle } from './ui';
import { parseRange, formatRange, endOfLocalDay } from '../../lib/range';

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
  if (due) {
    const dueDate = new Date(due);
    if (start >= dueDate) return 'Start must be before the due date.';
    // Compare the effective end target: an untimed end date lands at the end
    // of its day (23:59), not midnight, so that's what must fit before the due.
    if (end) {
      const endTarget =
        end.getHours() === 0 && end.getMinutes() === 0
          ? endOfLocalDay(end)
          : end;
      if (endTarget > dueDate) return 'End must be on or before the due date.';
    }
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
// on every later day.
function effectiveEnd(start: Date, end: Date | null): Date | null {
  if (end) return end;
  if (start.getHours() === 0 && start.getMinutes() === 0) {
    return endOfLocalDay(start);
  }
  return null;
}

export default function TargetEditor({
  value,
  due,
  onChange,
  disabled,
  hideClear,
}: TargetEditorProps) {
  const { start, end } = parseRange(value ?? null);
  const [error, setError] = useState<string | null>(null);
  const [forceShowEnd, setForceShowEnd] = useState(false);

  const startValues = useMemo(() => getLocalValues(start), [start]);
  const endValues = useMemo(() => getLocalValues(end), [end]);

  const [showStartTime, setShowStartTime] = useState(() => startValues.hasTime);
  const [showEndTime, setShowEndTime] = useState(() => endValues.hasTime);

  // Resets forceShowEnd/error whenever `value` changes from outside (e.g.
  // switching between tasks) -- adjusted during render rather than in a
  // useEffect, per React's own guidance for resetting state on a prop
  // change, so this doesn't trigger an extra cascading render.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setForceShowEnd(false);
    setError(null);
  }

  const showEndInput = Boolean(end) || forceShowEnd;

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
    const nextEnd = showEndInput
      ? buildLocalDate(endDateStr, endTimeStr, isEndTimeActive)
      : null;

    if (!nextStart) {
      setError(null);
      onChange(null);
      return;
    }

    const problem = validate(nextStart, nextEnd, due);
    setError(problem);
    if (problem) return;

    onChange(formatRange(nextStart, effectiveEnd(nextStart, nextEnd)));
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
    onChange(formatRange(nextStart, nextStart && effectiveEnd(nextStart, null)));
  }

  function handleClear() {
    setError(null);
    setForceShowEnd(false);
    onChange(null);
  }

  return (
    <div className="space-y-1.5">
      {/* one bordered pill, matching TargetBadge exactly — icon on the
          left, dates auto-sized (not stretched full width), no "Start
          Date"/"End Date" labels. Below 350px it switches to a 2-column
          grid: the icon spans both stacked lines, the arrow sits centered
          and rotated between them (see max-[350px]: variants below). */}
      <div
        className={clsx(
          // h-8.5 matches DueEditor's pill height -- was py-1 (no fixed
          // height), which read shorter than the app's other inputs.
          'border-nyx-600 text-nyx-400 flex h-8.5 w-fit flex-wrap items-center gap-1.5 rounded-full border pr-2 pl-3 font-mono',
          'max-[350px]:grid max-[350px]:grid-cols-[auto_1fr] max-[350px]:items-center max-[350px]:gap-x-2 max-[350px]:gap-y-1 max-[350px]:h-auto max-[350px]:rounded-2xl max-[350px]:px-3.5 max-[350px]:py-2.5'
        )}
      >
        {/* Icon and input text both bumped to match the default input's
            own size (15px icon, text-body) -- was 13px/text-caption,
            smaller than every other input in the app. */}
        <Target
          size={15}
          className="shrink-0 max-[350px]:col-start-1 max-[350px]:row-span-3 max-[350px]:self-center"
        />

        {/* Same layout as DueEditor: date, then (if active) a middot +
            time, then the TimeToggle last -- was icon-first with the
            toggle leading the date, a different order than Due's for no
            real reason. Widths match Due's too (w-[11ch]/w-13). */}
        <span className="inline-flex shrink-0 items-center gap-1.5 max-[350px]:col-start-2 max-[350px]:row-start-1">
          <TextInput
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
              <span className="opacity-50">·</span>
              <TextInput
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
          <span className="text-nyx-600 shrink-0 max-[350px]:col-start-2 max-[350px]:row-start-2 max-[350px]:justify-self-center max-[350px]:rotate-90">
            →
          </span>
        )}

        <span className="inline-flex shrink-0 items-center gap-1.5 max-[350px]:col-start-2 max-[350px]:row-start-3">
          {showEndInput ? (
            <>
              <TextInput
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
                  <span className="opacity-50">·</span>
                  <TextInput
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
            className="text-nyx-500 hover:text-tartarus-500 ml-1 flex shrink-0 items-center max-[350px]:col-start-2 max-[350px]:row-start-3 max-[350px]:ml-auto"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && <p className="text-tartarus-500 text-caption font-medium">{error}</p>}
    </div>
  );
}

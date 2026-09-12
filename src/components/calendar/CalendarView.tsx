import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { addDays, format, isToday, startOfWeek } from 'date-fns';
import { parseRange } from '../../lib/range';
import { minutesToHuman, isOverdue } from '../../lib/dateUtils';
import { EVENT_TYPE_META, OPEN_STATUSES } from '../../lib/constants';
import { getTimezone } from '../../lib/timezone';
import { getEventLabel } from '../../lib/eventLabel';
import { ProjectChip, TaskProgressBar } from '../common/ui';
import { computeTaskProgress, type TaskProgress } from '../../lib/taskProgress';
import { computeLogSegments } from '../../lib/logSegments';
import type { Event, Task, Project, Field, TaskLog } from '../../lib/types';

const HOUR_HEIGHT = 48; // px
const DAY_HEIGHT = HOUR_HEIGHT * 24;
const DAY_COUNT_OPTIONS = [1, 3, 5, 7] as const;

export interface DueItem {
  type: 'task' | 'project';
  id: string;
  name: string;
}

type PositionedEvent = Event & {
  start: Date;
  end: Date;
  label: string;
  projectName: string | null;
  projectField: string | null;
  progress: TaskProgress | null;
  isDone: boolean;
  isCancelled: boolean;
  isLate: boolean;
};

interface PositionedLogSegment {
  top: number;
  height: number;
  matched: boolean;
}

interface PositionedLog {
  id: string;
  taskName: string;
  timeRangeLabel: string;
  labelTop: number;
  segments: PositionedLogSegment[];
}

interface DaySummary {
  scheduledMinutes: number;
  loggedMinutes: number;
  matchedMinutes: number;
  scheduledColorClass: string;
}

// Ticks once a minute so the current-time line drifts without re-deriving
// the whole calendar on every render.
function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function minutesFromMidnight(date: Date): number {
  const tz = getTimezone();
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0) % 24;
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

interface CalendarViewProps {
  events: Event[];
  tasks?: Task[];
  projects?: Project[];
  fields?: Field[];
  taskLogs?: TaskLog[];
  onSlotClick: (date: Date) => void;
  onEventClick: (event: Event) => void;
  onMilestoneClick?: (item: DueItem) => void;
}

export default function CalendarView({
  events,
  tasks = [],
  projects = [],
  fields = [],
  taskLogs = [],
  onSlotClick,
  onEventClick,
  onMilestoneClick,
}: CalendarViewProps) {
  const [anchor, setAnchor] = useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [daysToShow, setDaysToShow] = useState<number>(7);
  const [showLoggedTime, setShowLoggedTime] = useState(false);
  const now = useNow();
  const scrollRef = useRef<HTMLDivElement>(null);
  const days = useMemo(
    () => Array.from({ length: daysToShow }, (_, i) => addDays(anchor, i)),
    [anchor, daysToShow]
  );
  const gridColsStyle = { gridTemplateColumns: `48px repeat(${daysToShow}, 1fr)` };

  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  );
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const fieldsById = useMemo(
    () => new Map(fields.map((f) => [f.id, f])),
    [fields]
  );
  const logsByTask = useMemo(() => {
    const map = new Map<string, TaskLog[]>();
    for (const log of taskLogs) {
      if (!log.task_id) continue;
      if (!map.has(log.task_id)) map.set(log.task_id, []);
      map.get(log.task_id)!.push(log);
    }
    return map;
  }, [taskLogs]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, PositionedEvent[]>(
      days.map((d) => [format(d, 'yyyy-MM-dd'), []])
    );
    const tz = getTimezone();
    for (const ev of events) {
      const { start, end } = parseRange(ev.duration as unknown as string);
      if (!start) continue;
      // Bucket by the wall-clock date in the user's timezone
      const key = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(
        start
      ); // "YYYY-MM-DD"
      const task = ev.task_id ? tasksById.get(ev.task_id) : null;
      const project = ev.project_id ? projectsById.get(ev.project_id) : null;
      const projectField = project?.field_id
        ? (fieldsById.get(project.field_id)?.name ?? null)
        : null;
      const progress = task
        ? computeTaskProgress(task, logsByTask.get(task.id) ?? [])
        : null;
      const isDone = task?.status === 'done' || task?.status === 'cancelled';
      const isCancelled = task?.status === 'cancelled';
      const isLate = task ? isOverdue(task.due, task.status) : false;
      if (map.has(key))
        map.get(key)!.push({
          ...ev,
          start,
          end: end || new Date(start.getTime() + 30 * 60000),
          label: getEventLabel(ev, task?.name),
          projectName: project?.name ?? null,
          projectField,
          isDone,
          isCancelled,
          isLate,
          progress,
        });
    }
    return map;
  }, [events, days, tasksById, projectsById, fieldsById, logsByTask]);

  const dueItemsByDay = useMemo(() => {
    const map = new Map<string, DueItem[]>(
      days.map((d) => [format(d, 'yyyy-MM-dd'), []])
    );
    const tz = getTimezone();
    const dayKey = (d: string) => {
      const date = new Date(d);
      if (isNaN(date.getTime())) return null;
      return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(date);
    };
    for (const t of tasks) {
      if (!t.due || !OPEN_STATUSES.includes(t.status)) continue;
      const key = dayKey(t.due);
      if (key && map.has(key)) map.get(key)!.push({ type: 'task', id: t.id, name: t.name });
    }
    for (const p of projects) {
      if (!p.due || !OPEN_STATUSES.includes(p.status)) continue;
      const key = dayKey(p.due);
      if (key && map.has(key))
        map.get(key)!.push({ type: 'project', id: p.id, name: p.name });
    }
    return map;
  }, [tasks, projects, days]);

  const { logsByDay, daySummaryByDay } = useMemo(() => {
    const logsMap = new Map<string, PositionedLog[]>(
      days.map((d) => [format(d, 'yyyy-MM-dd'), []])
    );
    const summaryMap = new Map<string, DaySummary>(
      days.map((d) => [
        format(d, 'yyyy-MM-dd'),
        {
          scheduledMinutes: 0,
          loggedMinutes: 0,
          matchedMinutes: 0,
          scheduledColorClass: 'text-nyx-500',
        },
      ])
    );
    const tz = getTimezone();
    const dayKey = (d: Date) =>
      new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);

    for (const [key, evs] of eventsByDay) {
      const summary = summaryMap.get(key);
      if (!summary || evs.length === 0) continue;
      const types = new Set<Event['event_type']>();
      let minutes = 0;
      for (const ev of evs) {
        minutes += (ev.end.getTime() - ev.start.getTime()) / 60000;
        types.add(ev.event_type);
      }
      summary.scheduledMinutes = minutes;
      summary.scheduledColorClass =
        types.size === 1
          ? (EVENT_TYPE_META[[...types][0]]?.text ?? 'text-nyx-500')
          : 'text-nyx-500';
    }

    for (const log of taskLogs) {
      if (!log.task_id) continue;
      const { start, end } = parseRange(log.duration as unknown as string);
      if (!start) continue;
      const logEnd = end || now;
      const key = dayKey(start);
      if (!logsMap.has(key)) continue;

      const task = tasksById.get(log.task_id);
      const taskEvents = events
        .filter((e) => e.task_id === log.task_id)
        .map((e) => parseRange(e.duration as unknown as string))
        .filter((iv) => iv.start && iv.end)
        .map((iv) => ({ start: iv.start as Date, end: iv.end as Date }));

      const rawSegments = computeLogSegments(start, logEnd, taskEvents);
      const segments = rawSegments.map((seg) => ({
        top: (minutesFromMidnight(seg.start) / 60) * HOUR_HEIGHT,
        height: Math.max(
          2,
          ((seg.end.getTime() - seg.start.getTime()) / 60000 / 60) *
            HOUR_HEIGHT
        ),
        matched: seg.matched,
      }));
      const labelBottom = (minutesFromMidnight(logEnd) / 60) * HOUR_HEIGHT;

      logsMap.get(key)!.push({
        id: log.id,
        taskName: task?.name ?? 'Untitled task',
        timeRangeLabel: `${format(start, 'h:mmaaaaa')}–${format(logEnd, 'h:mmaaaaa')}`,
        labelTop: Math.max(0, labelBottom - 24),
        segments,
      });

      const summary = summaryMap.get(key);
      if (summary) {
        const loggedMin = (logEnd.getTime() - start.getTime()) / 60000;
        const matchedMin = rawSegments
          .filter((s) => s.matched)
          .reduce(
            (sum, s) => sum + (s.end.getTime() - s.start.getTime()) / 60000,
            0
          );
        summary.loggedMinutes += loggedMin;
        summary.matchedMinutes += matchedMin;
      }
    }

    return { logsByDay: logsMap, daySummaryByDay: summaryMap };
  }, [taskLogs, events, days, tasksById, eventsByDay, now]);

  // Open on the earliest event in the visible range instead of midnight, so
  // switching weeks or day-counts doesn't dump you on an empty-looking view.
  // Falls back to a reasonable default when there's nothing scheduled at all.
  useEffect(() => {
    if (!scrollRef.current) return;
    let earliestMinutes = Infinity;
    for (const evs of eventsByDay.values()) {
      for (const ev of evs) {
        earliestMinutes = Math.min(earliestMinutes, minutesFromMidnight(ev.start));
      }
    }
    const targetMinutes = Number.isFinite(earliestMinutes)
      ? earliestMinutes
      : 8 * 60;
    scrollRef.current.scrollTop = Math.max(
      0,
      (targetMinutes / 60) * HOUR_HEIGHT - HOUR_HEIGHT
    );
  }, [eventsByDay]);

  function defaultAnchorFor(n: number): Date {
    return n === 7 ? startOfWeek(new Date(), { weekStartsOn: 1 }) : new Date();
  }

  function handleColumnClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget) return; // ignore clicks on event blocks (they stop propagation)
    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const hour = Math.max(0, Math.min(23, Math.floor(offsetY / HOUR_HEIGHT)));
    const slotDate = new Date(day);
    slotDate.setHours(hour, 0, 0, 0);
    onSlotClick(slotDate);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setAnchor(addDays(anchor, -daysToShow))}
            className="text-nyx-400 hover:bg-nyx-800 rounded p-1.5 sm:p-1"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            onClick={() => setAnchor(addDays(anchor, daysToShow))}
            className="text-nyx-400 hover:bg-nyx-800 rounded p-1.5 sm:p-1"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setAnchor(defaultAnchorFor(daysToShow))}
            className="border-nyx-700 text-nyx-300 hover:bg-nyx-800 rounded border px-2 py-1 text-caption sm:py-0.5"
          >
            Today
          </button>
          <span className="text-nyx-300 ml-1 text-body sm:ml-2">
            {format(days[0], 'MMM d')} –{' '}
            {format(days[days.length - 1], 'MMM d, yyyy')}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          <div className="border-nyx-700 flex overflow-hidden rounded border text-caption">
            {DAY_COUNT_OPTIONS.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setDaysToShow(n);
                  setAnchor(defaultAnchorFor(n));
                }}
                className={`px-2 py-1 sm:px-2 sm:py-0.5 ${
                  daysToShow === n
                    ? 'bg-nyx-700 text-nyx-100'
                    : 'text-nyx-400 hover:bg-nyx-800'
                }`}
              >
                {n}d
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowLoggedTime((v) => !v)}
            className="text-nyx-300 flex items-center gap-2 text-caption"
          >
            <span
              className={`relative inline-block h-[17px] w-[30px] shrink-0 rounded-full transition-colors ${showLoggedTime ? 'bg-eros-500' : 'bg-nyx-700'}`}
            >
              <span
                className={`bg-nyx-100 absolute top-0.5 h-[13px] w-[13px] rounded-full transition-all ${showLoggedTime ? 'right-0.5' : 'left-0.5'}`}
              />
            </span>
            Show logged time
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="border-nyx-700 flex-1 overflow-y-auto rounded-t-lg border border-b-0"
      >
        <div
          style={gridColsStyle}
          className="border-nyx-700 bg-nyx-900 sticky top-0 z-10 grid border-b"
        >
          <div />
          {days.map((d) => {
            const dueItems = dueItemsByDay.get(format(d, 'yyyy-MM-dd')) || [];
            return (
              <div
                key={d.toISOString()}
                className={`border-nyx-700 border-l px-1.5 py-2 text-center ${isToday(d) ? 'bg-eros-500/10' : ''}`}
              >
                <p className="text-nyx-500 text-[11px] tracking-wide uppercase">
                  {format(d, 'EEE')}
                </p>
                <p
                  className={`text-body font-medium ${isToday(d) ? 'text-eros-400' : 'text-nyx-200'}`}
                >
                  {format(d, 'd')}
                </p>
                {dueItems.length > 0 && (
                  <div className="mt-0.5 flex items-center justify-center gap-1">
                    {dueItems.map((item) => (
                      <button
                        key={`${item.type}-${item.id}`}
                        title={`${item.name} · ${item.type} due today`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onMilestoneClick?.(item);
                        }}
                        className="text-eros-400 hover:text-eros-300"
                      >
                        <Flag size={10} />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={gridColsStyle} className="grid">
          <div style={{ height: DAY_HEIGHT }} className="relative">
            {Array.from({ length: 24 }).map((_, h) => (
              <div
                key={h}
                style={{ top: h * HOUR_HEIGHT }}
                className="text-nyx-600 absolute right-1.5 -translate-y-2 text-label"
              >
                {h === 0
                  ? ''
                  : `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'a' : 'p'}`}
              </div>
            ))}
          </div>
          {days.map((day) => {
            const dayKeyStr = format(day, 'yyyy-MM-dd');
            const dayEvents = eventsByDay.get(dayKeyStr) || [];
            const dayLogs = logsByDay.get(dayKeyStr) || [];
            const todayColumn = isToday(day);
            return (
              <div
                key={day.toISOString()}
                onClick={(e) => handleColumnClick(day, e)}
                style={{ height: DAY_HEIGHT }}
                className={`border-nyx-700 relative cursor-pointer border-l ${todayColumn ? 'bg-eros-500/5' : ''}`}
              >
                {Array.from({ length: 24 }).map((_, h) => (
                  <div
                    key={h}
                    style={{ top: h * HOUR_HEIGHT }}
                    className="bg-nyx-800 pointer-events-none absolute h-px w-full"
                  />
                ))}
                {todayColumn && (
                  <div
                    style={{ top: (minutesFromMidnight(now) / 60) * HOUR_HEIGHT }}
                    className="pointer-events-none absolute z-20 h-0.5 w-full bg-eros-400"
                  >
                    <span className="bg-eros-400 absolute top-1/2 -left-1 h-2 w-2 -translate-y-1/2 rounded-full" />
                  </div>
                )}
                {dayEvents.map((ev) => {
                  const top =
                    (minutesFromMidnight(ev.start) / 60) * HOUR_HEIGHT;
                  const height = Math.max(
                    18,
                    ((ev.end.getTime() - ev.start.getTime()) / 60000 / 60) *
                      HOUR_HEIGHT
                  );
                  const meta =
                    EVENT_TYPE_META[ev.event_type] || EVENT_TYPE_META.scheduled;
                  return (
                    <button
                      key={ev.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(ev);
                      }}
                      style={{ top, height, opacity: ev.isDone ? 0.38 : 1 }}
                      className={`absolute left-1 flex flex-col overflow-hidden rounded border-l-2 px-1.5 py-0.5 text-left text-[11px] leading-tight ${showLoggedTime ? 'right-2.5' : 'right-1'} ${meta.bg} ${meta.text} ${meta.border} ${meta.borderStyle} ${
                        ev.isLate && !ev.isDone
                          ? 'border-tartarus-500! border-solid! animate-pulse'
                          : ''
                      }`}
                    >
                      <span
                        className={`shrink-0 truncate font-medium ${ev.isCancelled ? 'line-through' : ''}`}
                      >
                        {ev.label}
                      </span>
                      {ev.projectName && (
                        <ProjectChip
                          name={ev.projectName}
                          fieldName={ev.projectField}
                          className="mt-0.5 shrink-0"
                        />
                      )}
                      {ev.progress && (
                        <TaskProgressBar
                          progress={ev.progress}
                          className="mt-0.5 shrink-0"
                        />
                      )}
                    </button>
                  );
                })}
                {showLoggedTime &&
                  dayLogs.map((log) => (
                    <div key={log.id}>
                      {log.segments.map((seg, i) => (
                        <div
                          key={i}
                          style={{ top: seg.top, height: seg.height }}
                          className={`pointer-events-none absolute right-1 w-1 rounded-sm ${
                            seg.matched ? 'bg-nyx-100' : 'log-rail-gap'
                          }`}
                        />
                      ))}
                      <div
                        style={{ top: log.labelTop }}
                        className="bg-nyx-900/95 text-nyx-400 pointer-events-none absolute right-1.5 z-10 max-w-[85%] rounded px-1 py-0.5 text-right font-mono text-[9px] leading-tight"
                      >
                        <span className="text-nyx-200 block truncate">
                          {log.taskName}
                        </span>
                        {log.timeRangeLabel}
                      </div>
                    </div>
                  ))}
              </div>
            );
          })}
        </div>
      </div>

      {showLoggedTime && (
        <div
          style={gridColsStyle}
          className="border-nyx-700 bg-nyx-800 grid rounded-b-lg border border-t-0"
        >
          <div />
          {days.map((day) => {
            const summary = daySummaryByDay.get(format(day, 'yyyy-MM-dd'));
            if (!summary) return <div key={day.toISOString()} />;
            const hasMix =
              summary.matchedMinutes > 0 &&
              summary.matchedMinutes < summary.loggedMinutes;
            return (
              <div
                key={day.toISOString()}
                className="border-nyx-700 flex items-center justify-between gap-1 border-l px-2 py-1.5 font-mono text-label"
              >
                <span className={summary.scheduledColorClass}>
                  {minutesToHuman(summary.scheduledMinutes)}
                </span>
                <span className="text-nyx-400">
                  {hasMix
                    ? `${minutesToHuman(summary.matchedMinutes)}/${minutesToHuman(summary.loggedMinutes)}`
                    : minutesToHuman(summary.loggedMinutes)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

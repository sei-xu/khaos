import { useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { isToday, startOfDay, endOfDay } from 'date-fns';
import {
  CalendarClock,
  CheckCircle2,
  Target,
  Star,
} from 'lucide-react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useTasks } from '../hooks/useHierarchy';
import { useEvents, useScheduledTaskIds, useEventMutations } from '../hooks/useEvents';
import {
  useTodayTaskIds,
  useMarkedPastTaskIds,
  useTodayMutations,
} from '../hooks/useMoments';
import { OPEN_STATUSES } from '../lib/constants';
import { parseRange, targetEnd } from '../lib/range';
import { getEventLabel } from '../lib/eventLabel';
import { DueBadge, TargetBadge } from '../components/common/ui';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import type { Event, Task } from '../lib/types';

// Auto-refresh cadence for the dashboard's live queries. Kept well above the
// global 15s staleTime so this is purely a "someone else changed something"
// safety net, not the primary fetch path.
const AUTO_REFRESH_MS = 30_000;

// First hour of the compact day-calendar column shown below the pills — runs
// through midnight so a late-scheduled task is still droppable.
const CALENDAR_START_HOUR = 6;

interface TaskPillProps {
  task: Task;
  onOpen: (task: Task) => void;
  faded?: boolean;
  children: ReactNode;
}

// Draggable pill matching the app's existing badge language (DueBadge /
// TargetBadge: chrome-less or thin-bordered rounded chip, small mono/body
// text). Dragging one onto the "Marked" group or a calendar slot below
// changes that task's state — see DashboardPage's handleDragEnd. A plain
// click (one that never crosses the drag activation distance) opens the
// task, same as clicking a Kanban card. Full-width within its column so a
// wide badge (e.g. TargetBadge's start→end range) always has room. `faded`
// dims a pill that's stale (e.g. marked on a past day, never resolved).
function TaskPill({ task, onOpen, faded, children }: TaskPillProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 30 }
    : undefined;
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={task.name}
      onClick={() => !isDragging && onOpen(task)}
      className={`border-nyx-700 bg-nyx-800 text-nyx-200 hover:border-nyx-500 flex w-full cursor-grab items-center gap-1.5 rounded-full border px-2 py-1 text-caption active:cursor-grabbing ${faded ? 'opacity-50' : ''}`}
    >
      <span className="min-w-0 flex-1 truncate">{task.name}</span>
      {isDragging ? null : children}
    </button>
  );
}

interface PillGroupProps {
  icon: ReactNode;
  label: string;
  accentClass: string;
  count: number;
  emptyLabel: string;
  droppableId?: string;
  children: ReactNode;
}

function PillGroup({
  icon,
  label,
  accentClass,
  count,
  emptyLabel,
  droppableId,
  children,
}: PillGroupProps) {
  const droppable = useDroppable({ id: droppableId ?? '__none__' });
  const isDropTarget = Boolean(droppableId);
  return (
    <section>
      <h2
        className={`mb-2 flex items-center gap-1.5 text-caption font-semibold tracking-wide uppercase ${accentClass}`}
      >
        {icon} {label} ({count})
      </h2>
      <div
        ref={isDropTarget ? droppable.setNodeRef : undefined}
        className={`flex min-h-[2.25rem] flex-col gap-1.5 rounded-lg p-1 transition-colors ${
          isDropTarget && droppable.isOver
            ? 'bg-nyx-800 ring-eros-400 ring-1'
            : ''
        }`}
      >
        {count ? children : <p className="text-nyx-600 px-1 text-body">{emptyLabel}</p>}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  const { data: events = [] } = useEvents() as { data: Event[] };
  const { data: todayTaskIds } = useTodayTaskIds();
  const { data: markedPastTaskIds } = useMarkedPastTaskIds();
  const scheduledTaskIds = useScheduledTaskIds();
  const { mark } = useTodayMutations();
  const { create: createEvent } = useEventMutations();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const isMutating = useIsMutating();

  // Auto-update: periodically refetch the dashboard's live data. Skipped
  // while a mutation (e.g. an in-flight drag-drop) is running so a refetch
  // never races an optimistic update or clobbers a pending drop.
  useEffect(() => {
    const id = setInterval(() => {
      if (isMutating > 0) return;
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['moments', 'today'] });
    }, AUTO_REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryClient]);

  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));

  const markedTaskIds = todayTaskIds ?? new Set<string>();
  const pastMarkedTaskIds = markedPastTaskIds ?? new Set<string>();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  // Due covers overdue + due-today + future-due tasks together — DueBadge's
  // color (red/pulsing for overdue vs. copper otherwise) already tells them
  // apart, so there's no separate "Overdue" / "Due today" section anymore.
  const duePills = openTasks
    .filter((t) => t.due)
    .sort((a, b) => new Date(a.due!).getTime() - new Date(b.due!).getTime());
  // Target shows tasks whose window covers today (current) plus tasks whose
  // window already ended with work still open (past, rendered yellowish via
  // TargetBadge's `past` prop below) — future-only targets stay hidden.
  const targetPills = openTasks
    .filter((t) => t.target)
    .map((t) => {
      const end = targetEnd(t.target as string);
      return end && end < todayStart ? { task: t, past: true } : { task: t, past: false };
    })
    .filter(({ task: t, past }) => {
      if (past) return true;
      const { start } = parseRange(t.target as string);
      const end = targetEnd(t.target as string);
      return Boolean(start && end && start <= todayEnd && end >= todayStart);
    });
  const scheduledPills = openTasks.filter((t) => scheduledTaskIds.has(t.id));
  // Marked pairs today's marks (full opacity) with tasks left marked on a
  // past day and never resolved (faded, see TaskPill's `faded` prop below).
  const markedPills = openTasks
    .filter((t) => markedTaskIds.has(t.id))
    .map((t) => ({ task: t, faded: false }))
    .concat(
      openTasks
        .filter((t) => !markedTaskIds.has(t.id) && pastMarkedTaskIds.has(t.id))
        .map((t) => ({ task: t, faded: true }))
    );

  const todaysEvents = events
    .map((e) => ({ ...e, ...parseRange(e.duration as unknown as string) }))
    .filter(
      (e): e is typeof e & { start: Date } =>
        Boolean(e.start) && isToday(e.start as Date)
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  const eventsByHour = useMemo(() => {
    const map = new Map<number, typeof todaysEvents>();
    for (const ev of todaysEvents) {
      const hour = ev.start.getHours();
      if (!map.has(hour)) map.set(hour, []);
      map.get(hour)!.push(ev);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events]);

  const calendarHours = Array.from(
    { length: 24 - CALENDAR_START_HOUR },
    (_, i) => CALENDAR_START_HOUR + i
  );

  const openTaskId = searchParams.get('taskId');
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;
  function openTask_(task: Task) {
    setSearchParams({ taskId: String(task.id) });
  }
  function closeTask() {
    searchParams.delete('taskId');
    setSearchParams(searchParams);
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const task = tasksById.get(String(active.id));
    if (!task) return;

    if (over.id === 'marked-zone') {
      if (!markedTaskIds.has(task.id)) mark.mutate(task.id);
      return;
    }

    if (typeof over.id === 'string' && over.id.startsWith('slot:')) {
      const hour = Number(over.id.slice('slot:'.length));
      if (Number.isNaN(hour)) return;
      const start = new Date();
      start.setHours(hour, 0, 0, 0);
      // Estimate-aware: the dropped slot becomes the start, and the event
      // runs for the task's `estimate` (minutes), defaulting to 30 when the
      // task carries no estimate.
      const minutes = task.estimate || 30;
      const end = new Date(start.getTime() + minutes * 60000);
      createEvent.mutate({
        name: task.name,
        eventType: 'scheduled',
        start,
        end,
        taskId: task.id,
      });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-5">
      <h1 className="font-display text-nyx-100 mb-1 text-display-lg">Today</h1>
      <p className="text-nyx-500 mb-6 text-body">
        {new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <PillGroup
            icon={<CheckCircle2 size={13} />}
            label="Due"
            accentClass="text-eros-400"
            count={duePills.length}
            emptyLabel="Nothing with a due date."
          >
            {duePills.map((task) => (
              <TaskPill key={task.id} task={task} onOpen={openTask_}>
                <DueBadge due={task.due} status={task.status} />
              </TaskPill>
            ))}
          </PillGroup>

          <PillGroup
            icon={<Target size={13} />}
            label="Target"
            accentClass="text-pontus-400"
            count={targetPills.length}
            emptyLabel="Nothing targeted for today."
          >
            {targetPills.map(({ task, past }) => (
              <TaskPill key={task.id} task={task} onOpen={openTask_}>
                <TargetBadge target={task.target as string | null} past={past} />
              </TaskPill>
            ))}
          </PillGroup>

          <PillGroup
            icon={<Star size={13} />}
            label="Marked"
            accentClass="text-eros-400"
            count={markedPills.length}
            emptyLabel="Drag a task here to mark it for today."
            droppableId="marked-zone"
          >
            {markedPills.map(({ task, faded }) => (
              <TaskPill key={task.id} task={task} onOpen={openTask_} faded={faded}>
                <Star size={11} className="text-eros-400 shrink-0" fill="currentColor" />
              </TaskPill>
            ))}
          </PillGroup>

          <section>
            <h2 className="text-sage-500 mb-2 flex items-center gap-1.5 text-caption font-semibold tracking-wide uppercase">
              <CalendarClock size={13} /> Scheduled ({scheduledPills.length})
            </h2>
            {!todaysEvents.length && (
              <p className="text-nyx-600 mb-1 px-1 text-body">
                Drag a pill onto an hour to schedule it.
              </p>
            )}
            <div className="border-nyx-700 divide-nyx-800 max-h-[28rem] divide-y overflow-y-auto rounded-lg border">
              {calendarHours.map((hour) => (
                <CalendarSlot
                  key={hour}
                  hour={hour}
                  events={eventsByHour.get(hour) ?? []}
                  tasksById={tasksById}
                />
              ))}
            </div>
          </section>
        </div>
      </DndContext>

      {openTask && (
        <TaskDetailModal
          taskId={openTask.id}
          task={openTask}
          onClose={closeTask}
          onOpenTask={openTask_}
        />
      )}
    </div>
  );
}

interface CalendarSlotProps {
  hour: number;
  events: (Event & { start: Date })[];
  tasksById: Map<string, Task>;
}

// One row of the compact day-calendar column — droppable (id `slot:{hour}`)
// so a dragged pill can be scheduled there, and lists whatever's already
// scheduled in that hour.
function CalendarSlot({ hour, events, tasksById }: CalendarSlotProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${hour}` });
  const label = `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? 'am' : 'pm'}`;
  return (
    <div
      ref={setNodeRef}
      className={`flex min-h-[2rem] items-center gap-3 px-4 py-1.5 transition-colors ${
        isOver ? 'bg-eros-500/10' : ''
      }`}
    >
      <span className="text-nyx-500 w-10 shrink-0 font-mono text-caption">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {events.map((ev) => {
          const taskName = ev.task_id ? tasksById.get(ev.task_id)?.name : null;
          return (
            <span
              key={ev.id}
              className="text-nyx-100 flex min-w-0 items-center gap-1.5 text-body"
            >
              <span className="text-nyx-500 font-mono text-caption">
                {ev.start.toLocaleTimeString(undefined, {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              <span className="truncate">{getEventLabel(ev, taskName)}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

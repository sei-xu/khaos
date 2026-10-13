import { Fragment, useEffect, useMemo, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient, useIsMutating } from '@tanstack/react-query';
import { isToday, startOfDay, endOfDay } from 'date-fns';
import { CalendarClock, CheckCircle2, Target, Star } from 'lucide-react';
import {
  DndContext,
  useDraggable,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  useTasks,
  useSections,
  useProjects,
  useFields,
} from '../hooks/useHierarchy';
import { useEvents, useEventMutations } from '../hooks/useEvents';
import {
  useTodayTaskIds,
  useMarkedPastTaskIds,
  useTodayMutations,
} from '../hooks/useMoments';
import { useBacklogTasks, useBacklogMutations } from '../hooks/useBacklog';
import { OPEN_STATUSES } from '../lib/constants';
import { isOverdue } from '../lib/dateUtils';
import { parseRange, targetEnd } from '../lib/range';
import { getEventLabel } from '../lib/eventLabel';
import {
  DueBadge,
  StatusIcon,
  PriorityBadge,
  ProjectChip,
} from '../components/common/ui';
import { TargetBadge } from '../components/common/TargetEditor';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import type { Event, Field, Id, Project, Section, Task } from '../lib/types';

// Auto-refresh cadence for the dashboard's live queries. Kept well above the
// global 15s staleTime so this is purely a "someone else changed something"
// safety net, not the primary fetch path.
const AUTO_REFRESH_MS = 30_000;

// First hour of the compact day-calendar column shown below the pills — runs
// through midnight so a late-scheduled task is still droppable.
const CALENDAR_START_HOUR = 6;

// backlog_rank is the primary sort key within each Today group (lower
// first); tasks without a rank fall back to the group's own date-based
// comparator and sort after every ranked task. Scheduled is excluded — its
// pills render by calendar hour below, not in list order, so a rank
// wouldn't change anything visible there.
function byBacklogRank<T extends { task: Task }>(
  items: T[],
  fallback: (a: T, b: T) => number
): T[] {
  return [...items].sort((a, b) => {
    const ra = a.task.backlog_rank;
    const rb = b.task.backlog_rank;
    if (ra != null && rb != null) return ra - rb;
    if (ra != null) return -1;
    if (rb != null) return 1;
    return fallback(a, b);
  });
}

interface TaskPillProps {
  task: Task;
  onOpen: (task: Task) => void;
  projectName?: string | null;
  projectField?: string | null;
  faded?: boolean;
  // 1-based position in the backlog queue, when the task is queued.
  rankPosition?: number;
  children: ReactNode;
}

// What TaskPillBody itself renders: the subset of TaskPillProps that ends
// up as markup, plus the drag state that hides the second row.
type TaskPillBodyProps = Pick<
  TaskPillProps,
  'task' | 'projectName' | 'projectField' | 'rankPosition' | 'children'
> & { isDragging: boolean };

// Shared chrome for both pill variants below (plain draggable and
// sortable) — same look either way; `faded` dims a stale pill.
function pillClassName(faded?: boolean): string {
  return `border-nyx-700 bg-nyx-800 text-nyx-200 hover:border-nyx-500 flex w-full cursor-grab flex-col items-start gap-1 rounded-lg border px-2 py-1.5 text-left text-caption active:cursor-grabbing ${faded ? 'opacity-50' : ''}`;
}

// backlog_rank's position badge: only shown when the task is actually
// queued (null means "not in the backlog", not "rank 0"). Position is
// 1-based and computed by the caller (it depends on the group's full
// sorted order, not just this task's raw rank value).
function RankBadge({ position }: { position: number }) {
  return (
    <span
      title="Position in the backlog"
      className="bg-nyx-900 text-hypnos-400 flex shrink-0 items-center justify-center rounded-full px-1 font-mono text-[10px] font-bold"
    >
      {position}
    </span>
  );
}

function TaskPillBody({
  task,
  projectName,
  projectField,
  rankPosition,
  isDragging,
  children,
}: TaskPillBodyProps) {
  return (
    <>
      <span className="flex w-full items-center gap-1.5">
        {rankPosition != null && <RankBadge position={rankPosition} />}
        <span className="min-w-0 flex-1 truncate">{task.name}</span>
        {!isDragging && (
          <span className="flex shrink-0 items-center gap-1">
            <StatusIcon status={task.status} size={14} />
            <PriorityBadge priority={task.priority} />
          </span>
        )}
      </span>
      {isDragging ? null : (
        <span className="flex w-full flex-wrap items-center gap-1.5">
          {children}
          <ProjectChip
            name={projectName}
            fieldName={projectField}
            className="min-w-0 flex-1 justify-end"
          />
        </span>
      )}
    </>
  );
}

// Draggable pill matching the app's existing badge language (DueBadge /
// TargetBadge: chrome-less or thin-bordered rounded chip, small mono/body
// text). Dragging one onto the "Marked" group or a calendar slot below
// changes that task's state — see DashboardPage's handleDragEnd. A plain
// click (one that never crosses the drag activation distance) opens the
// task, same as clicking a Kanban card. Two rows: the task name on top
// (left) with status/priority on the same line (right), and the group's
// own badge/project below — rounded-lg rather than the single-line pill's
// rounded-full, since a fully round corner reads wrong once the content
// wraps to two rows. `faded` dims a pill that's stale (e.g. marked on a
// past day, never resolved).
function TaskPill({
  task,
  onOpen,
  projectName,
  projectField,
  faded,
  rankPosition,
  children,
}: TaskPillProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = {
    touchAction: 'none' as const,
    ...(transform
      ? {
          transform: `translate(${transform.x}px, ${transform.y}px)`,
          zIndex: 30,
        }
      : undefined),
  };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={task.name}
      onClick={() => !isDragging && onOpen(task)}
      className={pillClassName(faded)}
    >
      <TaskPillBody
        task={task}
        projectName={projectName}
        projectField={projectField}
        rankPosition={rankPosition}
        isDragging={isDragging}
      >
        {children}
      </TaskPillBody>
    </button>
  );
}

// Same visuals as TaskPill, but sortable within the Marked group (dropping
// one pill above/below another there writes its backlog_rank — see
// DashboardPage's handleDragEnd) instead of only draggable onto other drop
// targets. Only the Marked group uses this: Target/Due/Scheduled stay
// read-only order (their own date-based criteria), matching the plan's
// "backlog_rank primary, current criteria fallback" rule without adding
// drag-reorder everywhere.
function SortableTaskPill({
  task,
  onOpen,
  projectName,
  projectField,
  faded,
  rankPosition,
  children,
}: TaskPillProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: 'none' as const,
  };
  return (
    <button
      type="button"
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      title={task.name}
      onClick={() => !isDragging && onOpen(task)}
      className={pillClassName(faded)}
    >
      <TaskPillBody
        task={task}
        projectName={projectName}
        projectField={projectField}
        rankPosition={rankPosition}
        isDragging={isDragging}
      >
        {children}
      </TaskPillBody>
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
        className={`text-caption mb-2 flex items-center gap-1.5 font-semibold tracking-wide uppercase ${accentClass}`}
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
        {count ? (
          children
        ) : (
          <p className="text-nyx-600 text-body px-1">{emptyLabel}</p>
        )}
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  const { data: sections = [] } = useSections() as { data: Section[] };
  const { data: projects = [] } = useProjects() as { data: Project[] };
  const { data: fields = [] } = useFields() as { data: Field[] };
  const { data: events = [] } = useEvents() as { data: Event[] };
  const { data: todayTaskIds } = useTodayTaskIds();
  const { data: markedPastTaskIds } = useMarkedPastTaskIds();
  const { mark } = useTodayMutations();
  const { create: createEvent } = useEventMutations();
  const backlogTasks = useBacklogTasks();
  const { reorder: reorderBacklog } = useBacklogMutations();
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
  // 1-based position in the global backlog queue, shown as RankBadge on a
  // pill — the same number the Backlog view's own position column shows.
  const backlogPositionById = useMemo(
    () => new Map(backlogTasks.map((t, i) => [t.id, i + 1])),
    [backlogTasks]
  );
  const sectionsById = useMemo(
    () => new Map(sections.map((s) => [s.id, s])),
    [sections]
  );
  const projectsById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects]
  );
  const fieldsById = useMemo(
    () => new Map(fields.map((f) => [f.id, f])),
    [fields]
  );

  function projectForTask(task: Task): Project | null {
    const section = sectionsById.get(task.section_id!);
    return section ? (projectsById.get(section.project_id!) ?? null) : null;
  }

  function fieldNameForProject(project: Project | null): string | null {
    if (!project?.field_id) return null;
    return fieldsById.get(project.field_id)?.name ?? null;
  }

  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));

  const markedTaskIds = todayTaskIds ?? new Set<string>();
  const pastMarkedTaskIds = markedPastTaskIds ?? new Set<string>();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const todaysEvents = events
    .map((e) => ({ ...e, ...parseRange(e.duration as unknown as string) }))
    .filter(
      (e): e is typeof e & { start: Date } =>
        Boolean(e.start) && isToday(e.start as Date)
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Each open task belongs to at most one of the four groups below — the
  // highest-priority one it matches, in this order: scheduled, marked,
  // targeted, due. A task with an event on today's calendar is already
  // visible there, so it's excluded from Marked/Target/Due; a task marked
  // for today is excluded from Target/Due; and so on. This keeps the Today
  // tab from showing the same task twice under different criteria.
  const scheduledTodayTaskIds = new Set<Id>(
    todaysEvents.filter((e) => e.task_id).map((e) => e.task_id as Id)
  );

  // Marked pairs today's marks (full opacity) with tasks left marked on a
  // past day and never resolved (faded, see TaskPill's `faded` prop below).
  // backlog_rank sorts each of those two subgroups (current/past), rather
  // than the whole list, so a highly-ranked stale task still doesn't jump
  // ahead of today's current marks — see byBacklogRank above.
  const markedPills = byBacklogRank(
    openTasks
      .filter(
        (t) => markedTaskIds.has(t.id) && !scheduledTodayTaskIds.has(t.id)
      )
      .map((t) => ({ task: t, faded: false })),
    () => 0
  ).concat(
    byBacklogRank(
      openTasks
        .filter(
          (t) =>
            !markedTaskIds.has(t.id) &&
            pastMarkedTaskIds.has(t.id) &&
            !scheduledTodayTaskIds.has(t.id)
        )
        .map((t) => ({ task: t, faded: true })),
      () => 0
    )
  );
  const markedShownIds = new Set(markedPills.map((p) => p.task.id));
  // Drag-reorder within Marked is restricted to today's current marks that
  // are already in the backlog queue — their backlog_rank gives a real
  // neighborhood to compute a new rank from (see handleDragEnd below).
  // Unranked current marks and stale past marks still show, just not
  // sortable (add them to the backlog first via BacklogToggle).
  const markedRankedCurrent = markedPills
    .filter((p) => !p.faded && p.task.backlog_rank !== null)
    .map((p) => p.task);
  const markedUnrankedCurrent = markedPills.filter(
    (p) => !p.faded && p.task.backlog_rank === null
  );
  const markedPast = markedPills.filter((p) => p.faded);

  // Target shows tasks whose window covers today (current) plus tasks whose
  // window already ended with work still open (past, rendered yellowish via
  // TargetBadge's `past` prop below) — future-only targets stay hidden.
  const targetPillsUnsorted = openTasks
    .filter(
      (t) =>
        t.target &&
        !scheduledTodayTaskIds.has(t.id) &&
        !markedShownIds.has(t.id)
    )
    .map((t) => {
      const end = targetEnd(t.target as string);
      return end && end < todayStart
        ? { task: t, past: true }
        : { task: t, past: false };
    })
    .filter(({ task: t, past }) => {
      if (past) return true;
      const { start } = parseRange(t.target as string);
      const end = targetEnd(t.target as string);
      return Boolean(start && end && start <= todayEnd && end >= todayStart);
    });
  // In-range targets first, then a divider, then past-due targets — each
  // subgroup sorted by backlog_rank primary, soonest end date as fallback
  // (same split reasoning as markedPills above).
  const targetEndKey = (p: { task: Task }) =>
    targetEnd(p.task.target as string)?.getTime() ?? 0;
  const targetPills = byBacklogRank(
    targetPillsUnsorted.filter((p) => !p.past),
    (a, b) => targetEndKey(a) - targetEndKey(b)
  ).concat(
    byBacklogRank(
      targetPillsUnsorted.filter((p) => p.past),
      (a, b) => targetEndKey(a) - targetEndKey(b)
    )
  );
  const firstPastTargetIndex = targetPills.findIndex((p) => p.past);
  const targetShownIds = new Set(targetPills.map((p) => p.task.id));

  // Due today/future first, then a divider, then overdue — same grouping
  // and backlog_rank-primary/date-fallback split as Target above.
  const duePillsUnsorted = openTasks
    .filter(
      (t) =>
        t.due &&
        !scheduledTodayTaskIds.has(t.id) &&
        !markedShownIds.has(t.id) &&
        !targetShownIds.has(t.id)
    )
    .map((t) => ({ task: t, overdue: isOverdue(t.due, t.status) }));
  const dueDateKey = (p: { task: Task }) => new Date(p.task.due!).getTime();
  const duePills = byBacklogRank(
    duePillsUnsorted.filter((p) => !p.overdue),
    (a, b) => dueDateKey(a) - dueDateKey(b)
  ).concat(
    byBacklogRank(
      duePillsUnsorted.filter((p) => p.overdue),
      (a, b) => dueDateKey(a) - dueDateKey(b)
    )
  );
  const firstOverdueIndex = duePills.findIndex((p) => p.overdue);

  const scheduledPills = openTasks.filter((t) =>
    scheduledTodayTaskIds.has(t.id)
  );

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
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const task = tasksById.get(String(active.id));
    if (!task) return;

    // Reordering a ranked Marked pill. The new rank is always computed on
    // the *global* backlog queue (backlogTasks), never on the Marked subset:
    // a midpoint between two marked neighbors can land exactly on the rank
    // of an unmarked task queued between them, producing duplicate ranks.
    //
    // The target is resolved from the collision list, not only `over`: the
    // 'marked-zone' droppable wraps the pills and, under the default
    // rectIntersection (IoU), wins against a neighbor pill when the group is
    // small — so `over` alone would be 'marked-zone' and the reorder would
    // silently no-op.
    const markedRankedIds = new Set(markedRankedCurrent.map((t) => t.id));
    if (markedRankedIds.has(String(active.id)) && over.id !== active.id) {
      const overId = String(over.id);
      const targetId = markedRankedIds.has(overId)
        ? overId
        : overId === 'marked-zone'
          ? e.collisions
              ?.map((c) => String(c.id))
              .find((id) => id !== String(active.id) && markedRankedIds.has(id))
          : undefined;
      if (targetId) {
        const oldIndex = backlogTasks.findIndex((t) => t.id === active.id);
        const newIndex = backlogTasks.findIndex((t) => t.id === targetId);
        if (oldIndex !== -1 && newIndex !== -1) {
          reorderBacklog.mutate({
            taskId: task.id,
            targetIndex: newIndex,
            ordered: arrayMove(backlogTasks, oldIndex, newIndex),
          });
        }
        return;
      }
    }

    // Dropping on the Marked group — its zone or any ranked pill inside it,
    // since a pill can be `over` instead of the zone — marks the task for
    // today. (A pill already marked is a no-op, not a reorder.)
    if (over.id === 'marked-zone' || markedRankedIds.has(String(over.id))) {
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
      <h1 className="font-display text-nyx-100 text-display-lg mb-1">Today</h1>
      <p className="text-nyx-500 text-body mb-6">
        {new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <section>
            <h2 className="text-sage-500 text-caption mb-2 flex items-center gap-1.5 font-semibold tracking-wide uppercase">
              <CalendarClock size={13} /> Scheduled ({scheduledPills.length})
            </h2>
            {!todaysEvents.length && (
              <p className="text-nyx-600 text-body mb-1 px-1">
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

          <PillGroup
            icon={<Star size={13} />}
            label="Marked"
            accentClass="text-eros-400"
            count={markedPills.length}
            emptyLabel="Drag a task here to mark it for today."
            droppableId="marked-zone"
          >
            <SortableContext
              items={markedRankedCurrent.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {markedRankedCurrent.map((task) => {
                const project = projectForTask(task);
                return (
                  <SortableTaskPill
                    key={task.id}
                    task={task}
                    onOpen={openTask_}
                    rankPosition={backlogPositionById.get(task.id)}
                    projectName={project?.name}
                    projectField={fieldNameForProject(project)}
                  >
                    <Star
                      size={11}
                      className="text-eros-400 shrink-0"
                      fill="currentColor"
                    />
                    {task.due && (
                      <DueBadge due={task.due} status={task.status} />
                    )}
                  </SortableTaskPill>
                );
              })}
            </SortableContext>
            {markedUnrankedCurrent.map(({ task }) => {
              const project = projectForTask(task);
              return (
                <TaskPill
                  key={task.id}
                  task={task}
                  onOpen={openTask_}
                  projectName={project?.name}
                  projectField={fieldNameForProject(project)}
                >
                  <Star
                    size={11}
                    className="text-eros-400 shrink-0"
                    fill="currentColor"
                  />
                  {task.due && <DueBadge due={task.due} status={task.status} />}
                </TaskPill>
              );
            })}
            {Boolean(markedPast.length) &&
              Boolean(
                markedRankedCurrent.length + markedUnrankedCurrent.length
              ) && <hr className="border-nyx-700 my-1 w-full" />}
            {markedPast.map(({ task }) => {
              const project = projectForTask(task);
              return (
                <TaskPill
                  key={task.id}
                  task={task}
                  onOpen={openTask_}
                  faded
                  rankPosition={backlogPositionById.get(task.id)}
                  projectName={project?.name}
                  projectField={fieldNameForProject(project)}
                >
                  <Star
                    size={11}
                    className="text-eros-400 shrink-0"
                    fill="currentColor"
                  />
                  {task.due && <DueBadge due={task.due} status={task.status} />}
                </TaskPill>
              );
            })}
          </PillGroup>

          <PillGroup
            icon={<Target size={13} />}
            label="Target"
            accentClass="text-pontus-400"
            count={targetPills.length}
            emptyLabel="Nothing targeted for today."
          >
            {targetPills.map(({ task, past }, i) => {
              const project = projectForTask(task);
              return (
                <Fragment key={task.id}>
                  {i === firstPastTargetIndex && (
                    <hr className="border-nyx-700 my-1 w-full" />
                  )}
                  <TaskPill
                    task={task}
                    onOpen={openTask_}
                    rankPosition={backlogPositionById.get(task.id)}
                    projectName={project?.name}
                    projectField={fieldNameForProject(project)}
                  >
                    <TargetBadge
                      target={task.target as string | null}
                      past={past}
                    />
                    {task.due && (
                      <DueBadge due={task.due} status={task.status} />
                    )}
                  </TaskPill>
                </Fragment>
              );
            })}
          </PillGroup>

          <PillGroup
            icon={<CheckCircle2 size={13} />}
            label="Due"
            accentClass="text-tartarus-500"
            count={duePills.length}
            emptyLabel="Nothing with a due date."
          >
            {duePills.map(({ task }, i) => {
              const project = projectForTask(task);
              return (
                <Fragment key={task.id}>
                  {i === firstOverdueIndex && (
                    <hr className="border-nyx-700 my-1 w-full" />
                  )}
                  <TaskPill
                    task={task}
                    onOpen={openTask_}
                    rankPosition={backlogPositionById.get(task.id)}
                    projectName={project?.name}
                    projectField={fieldNameForProject(project)}
                  >
                    <DueBadge due={task.due} status={task.status} />
                  </TaskPill>
                </Fragment>
              );
            })}
          </PillGroup>
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
      <span className="text-nyx-500 text-caption w-10 shrink-0 font-mono">
        {label}
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        {events.map((ev) => {
          const taskName = ev.task_id ? tasksById.get(ev.task_id)?.name : null;
          return (
            <span
              key={ev.id}
              className="text-nyx-100 text-body flex min-w-0 items-center gap-1.5"
            >
              <span className="text-nyx-500 text-caption font-mono">
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

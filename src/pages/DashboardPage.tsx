import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isToday } from 'date-fns';
import {
  AlertTriangle,
  CalendarClock,
  CalendarCheck,
  Star,
  Target as TargetIcon,
} from 'lucide-react';
import {
  useTasks,
  useSections,
  useProjects,
  useFields,
} from '../hooks/useHierarchy';
import { useEvents } from '../hooks/useEvents';
import { useTodayTaskIds } from '../hooks/useMoments';
import { OPEN_STATUSES } from '../lib/constants';
import { isOverdue } from '../lib/dateUtils';
import { parseRange, targetEnd } from '../lib/range';
import { getEventLabel } from '../lib/eventLabel';
import { EmptyState } from '../components/common/ui';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import TaskRow from '../components/tasks/TaskRow';
import type { Event, Field, Id, Project, Section, Task } from '../lib/types';

// A task's `target` planning window "covers" today when today falls
// anywhere between its start and its end target (inclusive).
function isTargetedToday(target: unknown): boolean {
  const { start } = parseRange(target);
  if (!start) return false;
  const end = targetEnd(target) ?? start;
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date();
  dayEnd.setHours(23, 59, 59, 999);
  return start <= dayEnd && end >= dayStart;
}

export default function DashboardPage() {
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  const { data: sections = [] } = useSections() as { data: Section[] };
  const { data: projects = [] } = useProjects() as { data: Project[] };
  const { data: fields = [] } = useFields() as { data: Field[] };
  const { data: events = [] } = useEvents() as { data: Event[] };
  const { data: markedTaskIds } = useTodayTaskIds();
  const [searchParams, setSearchParams] = useSearchParams();

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
  const tasksById = useMemo(
    () => new Map(tasks.map((t) => [t.id, t])),
    [tasks]
  );

  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status));
  const todaysEvents = events
    .map((e) => ({ ...e, ...parseRange(e.duration as unknown as string) }))
    .filter(
      (e): e is typeof e & { start: Date } =>
        Boolean(e.start) && isToday(e.start as Date)
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  // Each open task lands in exactly one Today bucket — the highest-priority
  // criterion it matches, in this order: scheduled, marked, targeted, due.
  const scheduledTaskIds = new Set<Id>(
    todaysEvents.filter((e) => e.task_id).map((e) => e.task_id as Id)
  );
  const scheduled: Task[] = [];
  const marked: Task[] = [];
  const targeted: Task[] = [];
  const due: Task[] = [];
  openTasks.forEach((t) => {
    if (scheduledTaskIds.has(t.id)) {
      scheduled.push(t);
    } else if (markedTaskIds?.has(t.id)) {
      marked.push(t);
    } else if (isTargetedToday(t.target)) {
      targeted.push(t);
    } else if (
      t.due &&
      (isOverdue(t.due, t.status) || isToday(new Date(t.due)))
    ) {
      due.push(t);
    }
  });

  const openTaskId = searchParams.get('taskId');
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;
  function openTask_(task: Task) {
    setSearchParams({ taskId: String(task.id) });
  }
  function closeTask() {
    searchParams.delete('taskId');
    setSearchParams(searchParams);
  }

  function projectForTask(task: Task): Project | null {
    const section = sectionsById.get(task.section_id!);
    return section ? (projectsById.get(section.project_id!) ?? null) : null;
  }

  function fieldNameForProject(project: Project | null): string | null {
    if (!project?.field_id) return null;
    return fieldsById.get(project.field_id)?.name ?? null;
  }

  const buckets = [
    {
      key: 'scheduled',
      title: 'Scheduled',
      icon: CalendarCheck,
      colorClass: 'text-pontus-400',
      tasks: scheduled,
      emptyMessage: 'Nothing scheduled today.',
    },
    {
      key: 'marked',
      title: 'Marked for today',
      icon: Star,
      colorClass: 'text-hypnos-400',
      tasks: marked,
      emptyMessage: 'Nothing marked for today.',
    },
    {
      key: 'targeted',
      title: 'Targeted',
      icon: TargetIcon,
      colorClass: 'text-eros-400',
      tasks: targeted,
      emptyMessage: 'Nothing targeted today.',
    },
    {
      key: 'due',
      title: 'Due',
      icon: AlertTriangle,
      colorClass: 'text-tartarus-500',
      tasks: due,
      emptyMessage: 'Nothing due. Good work.',
    },
  ];

  return (
    <div className="mx-auto max-w-4xl px-6 py-5">
      <h1 className="font-display text-nyx-100 mb-1 text-display-lg">Today</h1>
      <p className="text-nyx-500 mb-6 text-body">
        {new Date().toLocaleDateString(undefined, {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
        })}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {buckets.map(({ key, title, icon: Icon, colorClass, tasks: bucketTasks, emptyMessage }) => (
          <section key={key}>
            <h2
              className={`mb-2 flex items-center gap-1.5 text-caption font-semibold tracking-wide uppercase ${colorClass}`}
            >
              <Icon size={13} /> {title} ({bucketTasks.length})
            </h2>
            {!bucketTasks.length ? (
              <p className="text-nyx-600 text-body">{emptyMessage}</p>
            ) : (
              <div className="space-y-1">
                {bucketTasks.map((task) => {
                  const project = projectForTask(task);
                  return (
                    <TaskRow
                      key={task.id}
                      task={task}
                      projectName={project?.name}
                      projectField={fieldNameForProject(project)}
                      onOpen={openTask_}
                    />
                  );
                })}
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="mt-6">
        <h2 className="mb-2 flex items-center gap-1.5 text-caption font-semibold tracking-wide text-pontus-400 uppercase">
          <CalendarClock size={13} /> Today&lsquo;s calendar
        </h2>
        {!todaysEvents.length ? (
          <EmptyState
            icon={CalendarClock}
            title="Nothing on the calendar today"
          />
        ) : (
          <div className="divide-nyx-700 border-nyx-700 divide-y rounded-lg border">
            {todaysEvents.map((ev) => {
              const taskName = ev.task_id
                ? tasksById.get(ev.task_id)?.name
                : null;
              return (
                <div
                  key={ev.id}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span className="text-nyx-400 w-20 shrink-0 font-mono text-caption">
                    {ev.start.toLocaleTimeString(undefined, {
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </span>
                  <span className="text-nyx-100 text-body">
                    {getEventLabel(ev, taskName)}
                  </span>
                  <span className="text-nyx-600 ml-auto text-caption">
                    {ev.event_type}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>

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

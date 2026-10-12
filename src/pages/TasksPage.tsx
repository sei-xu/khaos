import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  List,
  Columns3,
  BarChart3,
  ListOrdered,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import {
  useTasks,
  useProjects,
  useSections,
  useFields,
} from '../hooks/useHierarchy';
import { useTags, useTagLinks } from '../hooks/useTags';
import { STATUSES, PRIORITIES, OPEN_STATUSES } from '../lib/constants';
import { Select, TextInput } from '../components/common/ui';
import TaskList, { type ProjectInfo } from '../components/tasks/TaskList';
import KanbanBoard from '../components/tasks/KanbanBoard';
import PriorityBoard from '../components/tasks/PriorityBoard';
import BacklogList from '../components/tasks/BacklogList';
import TaskDetailModal from '../components/tasks/TaskDetailModal';
import type { Id, Priority, Status, Task } from '../lib/types';

type ViewId = 'list' | 'kanban' | 'priority' | 'backlog';

const VIEWS: { id: ViewId; label: string; icon: LucideIcon }[] = [
  { id: 'list', label: 'List', icon: List },
  { id: 'kanban', label: 'Board', icon: Columns3 },
  { id: 'priority', label: 'Priority', icon: BarChart3 },
  { id: 'backlog', label: 'Backlog', icon: ListOrdered },
];

export default function TasksPage() {
  const { data: tasks = [] } = useTasks();
  const { data: projects = [] } = useProjects();
  const { data: sections = [] } = useSections();
  const { data: fields = [] } = useFields();
  const { data: tags = [] } = useTags();
  const { data: tagLinks = [] } = useTagLinks();
  const [searchParams, setSearchParams] = useSearchParams();

  const [view, setView] = useState<ViewId>('list');
  const [statusFilter, setStatusFilter] = useState<Status | 'open' | 'all'>(
    'open'
  );
  const [priorityFilter, setPriorityFilter] = useState<Priority | 'all'>(
    'all'
  );
  const [projectFilter, setProjectFilter] = useState<Id | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<Id | 'all'>('all');
  const [search, setSearch] = useState('');

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

  // Single source of truth for "which project/field does this task belong
  // to" — computed once here and handed to every view (list/kanban/priority)
  // so the ProjectChip lookup logic doesn't get duplicated three times.
  const projectInfoById = useMemo(() => {
    const map = new Map<Id, ProjectInfo>();
    tasks.forEach((t) => {
      const section = t.section_id ? sectionsById.get(t.section_id) : null;
      const project = section?.project_id
        ? projectsById.get(section.project_id)
        : null;
      const fieldName = project?.field_id
        ? fieldsById.get(project.field_id)?.name
        : null;
      map.set(t.id, {
        name: project?.name ?? null,
        fieldName: fieldName ?? null,
      });
    });
    return map;
  }, [tasks, sectionsById, projectsById, fieldsById]);

  const taggedTaskIds = useMemo(() => {
    if (tagFilter === 'all') return null;
    return new Set(
      tagLinks
        .filter((l) => l.work_tag_id === tagFilter && l.task_id)
        .map((l) => l.task_id as Id)
    );
  }, [tagLinks, tagFilter]);

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (statusFilter === 'open' && !OPEN_STATUSES.includes(t.status))
        return false;
      if (
        statusFilter !== 'open' &&
        statusFilter !== 'all' &&
        t.status !== statusFilter
      )
        return false;
      if (
        priorityFilter !== 'all' &&
        (t.priority || 'medium') !== priorityFilter
      )
        return false;
      if (projectFilter !== 'all') {
        const section = t.section_id ? sectionsById.get(t.section_id) : null;
        if (!section || section.project_id !== projectFilter) return false;
      }
      if (taggedTaskIds && !taggedTaskIds.has(t.id)) return false;
      if (
        search.trim() &&
        !t.name.toLowerCase().includes(search.trim().toLowerCase())
      )
        return false;
      return true;
    });
  }, [
    tasks,
    statusFilter,
    priorityFilter,
    projectFilter,
    taggedTaskIds,
    search,
    sectionsById,
  ]);

  const openTaskId = searchParams.get('taskId');
  const openTask = openTaskId ? tasks.find((t) => t.id === openTaskId) : null;

  function openTask_(task: Task) {
    setSearchParams({ taskId: String(task.id) });
  }
  function closeTask() {
    searchParams.delete('taskId');
    setSearchParams(searchParams);
  }

  return (
    <div className="px-6 py-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-nyx-100 text-display-lg">All tasks</h1>
        <div className="border-nyx-700 flex items-center gap-1 rounded-lg border p-0.5">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              className={clsx(
                'flex items-center gap-1.5 rounded-md px-2 py-1.5 text-caption font-medium transition-colors',
                view === v.id
                  ? 'bg-nyx-700 text-nyx-100'
                  : 'text-nyx-500 hover:text-nyx-200'
              )}
            >
              <v.icon size={13} /> {v.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <TextInput
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search tasks…"
          className="max-w-56"
        />
        <Select
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as Status | 'open' | 'all')
          }
        >
          <option value="open">Open (not done/cancelled)</option>
          <option value="all">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace('_', ' ')}
            </option>
          ))}
        </Select>
        <Select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as Priority | 'all')
          }
        >
          <option value="all">All priorities</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          value={projectFilter}
          onChange={(e) => setProjectFilter(e.target.value)}
        >
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {Boolean(tags.length) && (
          <Select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
          >
            <option value="all">All tags</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        )}
        <span className="text-nyx-600 ml-auto text-caption">
          {filtered.length} tasks
        </span>
      </div>

      {view === 'list' && (
        <TaskList
          tasks={filtered}
          projectInfoById={projectInfoById}
          onOpenTask={openTask_}
        />
      )}
      {view === 'kanban' && (
        <KanbanBoard
          tasks={filtered}
          projectInfoById={projectInfoById}
          onOpenTask={openTask_}
        />
      )}
      {view === 'priority' && (
        <PriorityBoard
          tasks={filtered}
          projectInfoById={projectInfoById}
          onOpenTask={openTask_}
        />
      )}
      {view === 'backlog' && (
        <BacklogList
          tasks={filtered}
          projectInfoById={projectInfoById}
          onOpenTask={openTask_}
        />
      )}

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

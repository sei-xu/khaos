import { useNavigate } from 'react-router-dom';
import { useTasks, useProjects, useFields } from '../../hooks/useHierarchy';
import { useEvents } from '../../hooks/useEvents';
import { useAllTaskLogs } from '../../hooks/useTimeTracking';
import { InlineEntityPreview } from './InlineEntityPreview';
import { InlineEventPreview } from './InlineEventPreview';
import { computeTaskProgress } from '../../lib/taskProgress';
import type { ChatEntityType } from '../../lib/chat/entityRefs';
import type { Task, Project, Field, Event, TaskLog } from '../../lib/types';

interface EntityChipProps {
  entityType: ChatEntityType;
  id: string;
}

// Resolves a [[task:id]] / [[project:id]] / [[event:id]] token against
// whatever's already in the React Query cache (all loaded app-wide) and
// renders it as a clickable, formatted chip instead of raw text.
export function EntityChip({ entityType, id }: EntityChipProps) {
  const navigate = useNavigate();
  const { data: tasks = [] } = useTasks() as { data: Task[] };
  const { data: projects = [] } = useProjects() as { data: Project[] };
  const { data: fields = [] } = useFields() as { data: Field[] };
  const { data: events = [] } = useEvents() as { data: Event[] };
  const { data: taskLogs = [] } = useAllTaskLogs() as { data: TaskLog[] };

  if (entityType === 'event') {
    const event = events.find((e) => e.id === id);
    if (!event) {
      return (
        <span className="text-nyx-600 my-1 block text-caption italic">
          (event unavailable)
        </span>
      );
    }
    const task = event.task_id
      ? (tasks.find((t) => t.id === event.task_id) ?? null)
      : null;
    const project = event.project_id
      ? (projects.find((p) => p.id === event.project_id) ?? null)
      : null;
    const projectField = project?.field_id
      ? (fields.find((f) => f.id === project.field_id)?.name ?? null)
      : null;
    const progress = task
      ? computeTaskProgress(
          task,
          taskLogs.filter((l) => l.task_id === task.id)
        )
      : null;

    return (
      <button
        onClick={() => navigate(`/calendar?eventId=${id}`)}
        className="my-1 block w-full text-left"
      >
        <InlineEventPreview
          event={event}
          taskName={task?.name}
          projectName={project?.name}
          projectField={projectField}
          progress={progress}
        />
      </button>
    );
  }

  const data =
    entityType === 'task'
      ? tasks.find((t) => t.id === id)
      : projects.find((p) => p.id === id);

  if (!data) {
    return (
      <span className="text-nyx-600 my-1 block text-caption italic">
        ({entityType} unavailable)
      </span>
    );
  }

  return (
    <button
      onClick={() =>
        navigate(
          entityType === 'task' ? `/tasks?taskId=${id}` : `/projects/${id}`
        )
      }
      className="my-1 block w-full text-left"
    >
      <InlineEntityPreview entityType={entityType} data={data} />
    </button>
  );
}

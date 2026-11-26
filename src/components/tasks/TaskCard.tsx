import { useDraggable } from '@dnd-kit/core';
import { StatusBadge, PriorityBadge, ProjectChip } from '../common/ui';
import TaskName from './TaskName';
import type { ProjectInfo } from './TaskList';
import type { Task } from '../../lib/types';

interface TaskCardProps {
  task: Task;
  projectInfo?: ProjectInfo;
  onOpen: (task: Task) => void;
  // Kanban groups columns by status, so its card's own badge is priority;
  // Priority groups by priority, so its card shows status instead — the
  // one real difference between what used to be two near-identical Card
  // components.
  secondary: 'status' | 'priority';
}

// Shared card for the Kanban and Priority boards — was two components
// differing only in which badge (status vs. priority) doubles as the
// column's own grouping value. `TaskName lines={2}` gives the name real
// room before it clamps, instead of the single-line truncation a row uses.
export default function TaskCard({
  task,
  projectInfo,
  onOpen,
  secondary,
}: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = {
    touchAction: 'none' as const,
    ...(transform
      ? {
          transform: `translate(${transform.x}px, ${transform.y}px)`,
          zIndex: 10,
        }
      : undefined),
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onOpen(task)}
      className="border-nyx-700 bg-nyx-800 text-nyx-100 shadow-card text-body cursor-grab rounded-md border p-2 active:cursor-grabbing"
    >
      <TaskName
        name={task.name}
        status={task.status}
        lines={2}
        className="mb-1.5 block leading-snug"
      />
      <div className="flex items-center justify-between gap-2">
        {secondary === 'status' ? (
          <StatusBadge status={task.status} />
        ) : (
          <PriorityBadge priority={task.priority} />
        )}
        {projectInfo?.name && (
          <ProjectChip
            name={projectInfo.name}
            fieldName={projectInfo.fieldName}
            className="min-w-0"
          />
        )}
      </div>
    </div>
  );
}

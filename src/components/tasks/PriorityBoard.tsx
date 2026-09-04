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
import { PRIORITIES, PRIORITY_META } from '../../lib/constants';
import { StatusBadge, ProjectChip } from '../common/ui';
import { useTaskMutations } from '../../hooks/useHierarchy';
import type { ProjectInfo } from './TaskList';
import type { Id, Priority, Task } from '../../lib/types';

interface CardProps {
  task: Task;
  projectInfo?: ProjectInfo;
  onOpen: (task: Task) => void;
}

function Card({ task, projectInfo, onOpen }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: task.id });
  const style = {
    touchAction: 'none' as const,
    ...(transform
      ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 10 }
      : undefined),
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={() => !isDragging && onOpen(task)}
      className="border-nyx-700 bg-nyx-800 text-nyx-100 shadow-card cursor-grab rounded-md border p-2 text-body active:cursor-grabbing"
    >
      <p className="mb-1.5 leading-snug">{task.name}</p>
      <div className="flex items-center justify-between gap-2">
        <StatusBadge status={task.status} />
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

interface ColumnProps {
  priority: Priority;
  tasks: Task[];
  projectInfoById: Map<Id, ProjectInfo>;
  onOpen: (task: Task) => void;
}

function Column({ priority, tasks, projectInfoById, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: priority });
  const meta = PRIORITY_META[priority];
  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border ${isOver ? 'border-eros-400' : 'border-nyx-700'} bg-nyx-900`}
    >
      <div className="border-nyx-700 flex items-center gap-1.5 border-b px-3 py-2">
        <span
          className="text-caption font-semibold tracking-wide uppercase"
          style={{ color: meta.iconColor }}
        >
          {meta.label}
        </span>
        <span className="text-nyx-600 ml-auto text-caption">{tasks.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
        {tasks.map((task) => (
          <Card
            key={task.id}
            task={task}
            projectInfo={projectInfoById.get(task.id)}
            onOpen={onOpen}
          />
        ))}
      </div>
    </div>
  );
}

interface PriorityBoardProps {
  tasks: Task[];
  projectInfoById: Map<Id, ProjectInfo>;
  onOpenTask: (task: Task) => void;
}

export default function PriorityBoard({
  tasks,
  projectInfoById,
  onOpenTask,
}: PriorityBoardProps) {
  const { update } = useTaskMutations();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over) return;
    const newPriority = over.id as Priority;
    const task = tasks.find((t) => t.id === active.id);
    if (task && task.priority !== newPriority) {
      update.mutate({ id: task.id, patch: { priority: newPriority } });
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {PRIORITIES.map((priority) => (
          <Column
            key={priority}
            priority={priority}
            tasks={tasks.filter((t) => (t.priority || 'medium') === priority)}
            projectInfoById={projectInfoById}
            onOpen={onOpenTask}
          />
        ))}
      </div>
    </DndContext>
  );
}

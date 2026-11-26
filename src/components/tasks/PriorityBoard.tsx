import {
  DndContext,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { PRIORITIES, PRIORITY_META } from '../../lib/constants';
import TaskCard from './TaskCard';
import { useTaskMutations } from '../../hooks/useHierarchy';
import type { ProjectInfo } from './TaskList';
import type { Id, Priority, Task } from '../../lib/types';

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
          <TaskCard
            key={task.id}
            task={task}
            projectInfo={projectInfoById.get(task.id)}
            onOpen={onOpen}
            secondary="status"
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

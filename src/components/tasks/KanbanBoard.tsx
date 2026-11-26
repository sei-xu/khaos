import {
  DndContext,
  useDroppable,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { STATUSES, STATUS_META } from '../../lib/constants';
import TaskCard from './TaskCard';
import { useTaskMutations } from '../../hooks/useHierarchy';
import type { ProjectInfo } from './TaskList';
import type { Id, Status, Task } from '../../lib/types';

interface ColumnProps {
  priority: Status;
  tasks: Task[];
  projectInfoById: Map<Id, ProjectInfo>;
  onOpen: (task: Task) => void;
}

function Column({ priority, tasks, projectInfoById, onOpen }: ColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: priority });
  const meta = STATUS_META[priority] || null;
  return (
    <div
      ref={setNodeRef}
      className={`flex w-64 shrink-0 flex-col rounded-lg border ${isOver ? 'border-eros-400' : 'border-nyx-700'} bg-nyx-900`}
    >
      <div className="border-nyx-700 flex items-center gap-1.5 border-b px-3 py-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${meta?.dot || 'bg-nyx-500'}`}
        />
        <span className="text-nyx-400 text-caption font-semibold tracking-wide uppercase">
          {priority}
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
            secondary="priority"
          />
        ))}
      </div>
    </div>
  );
}

interface KanbanBoardProps {
  tasks: Task[];
  projectInfoById: Map<Id, ProjectInfo>;
  onOpenTask: (task: Task) => void;
}

export default function KanbanBoard({
  tasks,
  projectInfoById,
  onOpenTask,
}: KanbanBoardProps) {
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
    const taskId = active.id;
    const newStatus = over.id as Status;
    const task = tasks.find((t) => t.id === taskId);
    if (task && task.status !== newStatus) {
      update.mutate({ id: task.id, patch: { status: newStatus } });
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {STATUSES.map((status) => (
          <Column
            key={status}
            priority={status}
            tasks={tasks.filter((t) => t.status === status)}
            projectInfoById={projectInfoById}
            onOpen={onOpenTask}
          />
        ))}
      </div>
    </DndContext>
  );
}

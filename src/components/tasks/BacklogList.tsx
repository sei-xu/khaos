// The Backlog view: a single vertical queue of open tasks, drag-sortable,
// whose order (tasks.backlog_rank) is the source of truth for ordering
// inside Today's Marked/Target/Due groups — see DashboardPage. Dependency
// (tasks_sequence) still decides what's unblocked; this only decides
// preference among tasks that are available to work on, so a `waiting`
// task shows up dimmed with a "blocked" hint instead of being reordered
// for you.
import {
  DndContext,
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
import { GripVertical, X, Plus, ListOrdered } from 'lucide-react';
import {
  EmptyState,
  StatusBadge,
  PriorityBadge,
  DueBadge,
  ProjectChip,
  IconAddButton,
} from '../common/ui';
import { OPEN_STATUSES } from '../../lib/constants';
import { useBacklogTasks, useBacklogMutations } from '../../hooks/useBacklog';
import type { ProjectInfo } from './TaskList';
import type { Id, Task } from '../../lib/types';

interface BacklogRowProps {
  task: Task;
  position: number;
  projectInfo?: ProjectInfo;
  onOpen: (task: Task) => void;
  onRemove: () => void;
}

function BacklogRow({
  task,
  position,
  projectInfo,
  onOpen,
  onRemove,
}: BacklogRowProps) {
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
    opacity: isDragging ? 0.5 : 1,
    touchAction: 'none' as const,
  };
  const blocked = task.status === 'waiting';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group hover:border-nyx-700 hover:bg-nyx-900 flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 ${blocked ? 'opacity-50' : ''}`}
    >
      <span
        {...attributes}
        {...listeners}
        className="text-nyx-700 hover:text-nyx-400 cursor-grab active:cursor-grabbing"
      >
        <GripVertical size={13} />
      </span>
      <span className="text-nyx-600 text-caption w-5 shrink-0 text-right font-mono">
        {position}
      </span>
      <button
        onClick={() => onOpen(task)}
        title={blocked ? 'Blocked — waiting on another task' : undefined}
        className="flex min-w-0 flex-1 items-center gap-1 text-left"
      >
        <StatusBadge status={task.status} />
        <span className="text-nyx-100 text-body min-w-0 flex-1 truncate">
          {task.name}
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1">
          <PriorityBadge priority={task.priority} />
          <DueBadge due={task.due} status={task.status} />
          <ProjectChip
            name={projectInfo?.name}
            fieldName={projectInfo?.fieldName}
          />
        </span>
      </button>
      <button
        type="button"
        title="Remove from backlog"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="text-nyx-700 hover:text-tartarus-500 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
      >
        <X size={13} />
      </button>
    </div>
  );
}

interface AddCandidateRowProps {
  task: Task;
  projectInfo?: ProjectInfo;
  onAdd: () => void;
}

function AddCandidateRow({ task, projectInfo, onAdd }: AddCandidateRowProps) {
  return (
    <div className="hover:bg-nyx-900 flex items-center gap-2 rounded-md px-2 py-1.5">
      <IconAddButton label="Add to backlog" onClick={onAdd} />
      <span className="text-nyx-300 text-body min-w-0 flex-1 truncate">
        {task.name}
      </span>
      <ProjectChip
        name={projectInfo?.name}
        fieldName={projectInfo?.fieldName}
      />
    </div>
  );
}

interface BacklogListProps {
  tasks: Task[];
  projectInfoById: Map<Id, ProjectInfo>;
  onOpenTask: (task: Task) => void;
}

export default function BacklogList({
  tasks,
  projectInfoById,
  onOpenTask,
}: BacklogListProps) {
  const backlog = useBacklogTasks().filter((t) =>
    OPEN_STATUSES.includes(t.status)
  );
  const { reorder, removeFromBacklog, add } = useBacklogMutations();

  const queuedIds = new Set(backlog.map((t) => t.id));
  const candidates = tasks.filter(
    (t) => OPEN_STATUSES.includes(t.status) && !queuedIds.has(t.id)
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 200, tolerance: 8 },
    })
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = backlog.findIndex((t) => t.id === active.id);
    const newIndex = backlog.findIndex((t) => t.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(backlog, oldIndex, newIndex);
    reorder.mutate({
      taskId: String(active.id),
      targetIndex: newIndex,
      ordered: reordered,
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="border-nyx-700 overflow-hidden rounded-lg border">
        <div className="border-nyx-700 bg-nyx-800 text-nyx-500 text-caption flex items-center gap-1.5 border-b px-3 py-2">
          <ListOrdered size={13} /> Backlog ({backlog.length})
        </div>
        <div className="p-2">
          {backlog.length ? (
            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext
                items={backlog.map((t) => t.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-0.5">
                  {backlog.map((task, i) => (
                    <BacklogRow
                      key={task.id}
                      task={task}
                      position={i + 1}
                      projectInfo={projectInfoById.get(task.id)}
                      onOpen={onOpenTask}
                      onRemove={() => removeFromBacklog.mutate(task.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <EmptyState
              icon={ListOrdered}
              title="Backlog is empty"
              hint="Add a task below to start ordering what you'll do next."
            />
          )}
        </div>
      </div>

      <div className="border-nyx-700 overflow-hidden rounded-lg border">
        <div className="border-nyx-700 bg-nyx-800 text-nyx-500 text-caption flex items-center gap-1.5 border-b px-3 py-2">
          <Plus size={13} /> Not queued ({candidates.length})
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {candidates.length ? (
            <div className="space-y-0.5">
              {candidates.map((task) => (
                <AddCandidateRow
                  key={task.id}
                  task={task}
                  projectInfo={projectInfoById.get(task.id)}
                  onAdd={() => add.mutate(task.id)}
                />
              ))}
            </div>
          ) : (
            <p className="text-nyx-600 text-body px-1 py-2">
              Every open task is already in the backlog.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

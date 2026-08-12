import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  GripVertical,
  Plus,
  MoreVertical,
  Trash2,
  CalendarRange,
  Info,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Infinity as InfinityIcon,
} from 'lucide-react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  TargetBadge,
  StatusBadge,
  StatusPicker,
  PriorityPicker,
} from '../common/ui';
import TargetEditor from '../common/TargetEditor';
import {
  useTaskMutations,
  useSectionMutations,
  useTasksSequence,
  useTaskStatusMoments,
} from '../../hooks/useHierarchy';
import { buildSequenceRail, collapseHiddenEdges } from '../../lib/sequenceGraph';
import { infiniteFadeOpacity, daysSince } from '../../lib/infiniteFade';
import TaskRow from '../tasks/TaskRow';
import SequenceRailCell from './SequenceRail';
import {
  SequenceLinkControls,
  TaskDropTarget,
  type LinkDir,
  type LinkingState,
} from './sequenceLinking';
import type { Id, Section, Task } from '../../lib/types';

interface SectionColumnProps {
  section: Section;
  orderedTasks: Task[];
  onOpenTask: (task: Task) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  linking?: LinkingState | null;
  onToggleLink?: (taskId: Id, dir: LinkDir) => void;
}

export default function SectionColumn({
  section,
  orderedTasks,
  onOpenTask,
  dragHandleProps,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  linking = null,
  onToggleLink,
}: SectionColumnProps) {
  const { create: createTask } = useTaskMutations();
  const { update: updateSection, remove: removeSection } =
    useSectionMutations();
  const { data: seqEdges = [] } = useTasksSequence();
  const { data: statusMoments } = useTaskStatusMoments();

  // Infinite sections gradually fade, then hide, done/cancelled tasks based
  // on how long ago they settled — keeps an ongoing/never-ending list from
  // accumulating clutter forever. See src/lib/infiniteFade.ts.
  const { visibleTasks, fadeByTaskId, hiddenTaskIds } = useMemo(() => {
    if (!section.is_infinite || !statusMoments) {
      return {
        visibleTasks: orderedTasks,
        fadeByTaskId: new Map<Id, number>(),
        hiddenTaskIds: new Set<Id>(),
      };
    }
    const fade = new Map<Id, number>();
    const hidden = new Set<Id>();
    const visible = orderedTasks.filter((task) => {
      if (task.status !== 'done' && task.status !== 'cancelled') return true;
      const changedAt = statusMoments.get(task.id);
      if (!changedAt) return true;
      const opacity = infiniteFadeOpacity(daysSince(changedAt));
      if (opacity === null) {
        hidden.add(task.id);
        return false;
      }
      fade.set(task.id, opacity);
      return true;
    });
    return { visibleTasks: visible, fadeByTaskId: fade, hiddenTaskIds: hidden };
  }, [orderedTasks, section.is_infinite, statusMoments]);

  const rail = useMemo(
    () =>
      buildSequenceRail(
        visibleTasks.map((t) => t.id),
        collapseHiddenEdges(seqEdges, hiddenTaskIds)
      ),
    [visibleTasks, seqEdges, hiddenTaskIds]
  );
  const [newTaskName, setNewTaskName] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);

  const settled = section.status === 'done' || section.status === 'cancelled';
  const [collapsed, setCollapsed] = useState(() => settled);
  // Auto-collapse the moment a section is marked done/cancelled, adjusted
  // during render (not an effect) — doesn't force it back open if the user
  // re-activates it while already collapsed.
  const [prevSettled, setPrevSettled] = useState(settled);
  if (settled !== prevSettled) {
    setPrevSettled(settled);
    if (settled) setCollapsed(true);
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!newTaskName.trim()) return;
    createTask.mutate({
      section_id: section.id,
      name: newTaskName.trim(),
      status: 'todo',
    });
    setNewTaskName('');
  }

  return (
    <div className="border-nyx-700 bg-nyx-800/40 rounded-lg border">
      <div className="border-nyx-700 space-y-2 border-b px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span
            {...dragHandleProps}
            className="text-nyx-600 hover:text-nyx-300 cursor-grab active:cursor-grabbing"
          >
            <GripVertical size={14} />
          </span>
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="text-nyx-500 hover:text-nyx-200 flex shrink-0 items-center"
            title={collapsed ? 'Expand section' : 'Collapse section'}
          >
            {collapsed ? (
              <ChevronRight size={14} />
            ) : (
              <ChevronDown size={14} />
            )}
          </button>
          <input
            value={section.name}
            onChange={(e) =>
              updateSection.mutate({
                id: section.id,
                patch: { name: e.target.value },
              })
            }
            className="text-nyx-100 min-w-0 flex-1 bg-transparent text-body font-medium focus:outline-none"
          />
          {section.is_infinite && (
            <span
              className="text-nyx-600 shrink-0"
              title="Infinite section — settled tasks fade and eventually hide"
            >
              <InfinityIcon size={13} />
            </span>
          )}
          {collapsed && (
            <span className="text-nyx-600 shrink-0 font-mono text-caption">
              {visibleTasks.length}
            </span>
          )}
          <div className="flex shrink-0 items-center">
            <button
              onClick={onMoveUp}
              disabled={!canMoveUp}
              title="Move section up"
              className="text-nyx-500 hover:text-nyx-200 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronUp size={15} />
            </button>
            <button
              onClick={onMoveDown}
              disabled={!canMoveDown}
              title="Move section down"
              className="text-nyx-500 hover:text-nyx-200 disabled:pointer-events-none disabled:opacity-30"
            >
              <ChevronDown size={15} />
            </button>
          </div>
          <div className="relative shrink-0">
            <button
              onClick={() => setMenuOpen((o) => !o)}
              className="text-nyx-500 hover:text-nyx-200"
            >
              <MoreVertical size={15} />
            </button>
            {menuOpen && (
              <div className="border-nyx-700 bg-nyx-800 shadow-panel absolute right-0 z-10 mt-1 w-52 rounded-md border py-1">
                <button
                  onClick={() => {
                    updateSection.mutate({
                      id: section.id,
                      patch: { is_infinite: !section.is_infinite },
                    });
                    setMenuOpen(false);
                  }}
                  className="text-nyx-400 hover:bg-nyx-700 flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-caption"
                >
                  <InfinityIcon size={12} />
                  {section.is_infinite
                    ? 'Turn off infinite mode'
                    : 'Make infinite section'}
                </button>
                <button
                  onClick={() => {
                    removeSection.mutate(section.id);
                    setMenuOpen(false);
                  }}
                  className="text-nyx-400 hover:bg-nyx-700 flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-caption"
                >
                  <Trash2 size={12} /> Remove section
                </button>
              </div>
            )}
          </div>
        </div>

        {collapsed ? (
          <div className="flex items-center gap-2">
            <StatusBadge status={section.status} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="text-nyx-600 hover:text-nyx-300 flex shrink-0 items-center"
              title="Tasks below follow their sequence order first; outside a sequence they're ordered by target start date, then due date — tasks with neither go last."
            >
              <Info size={13} />
            </span>
            <button
              onClick={() => setTargetOpen((o) => !o)}
              className="text-nyx-500 hover:text-nyx-200 flex shrink-0 items-center"
              title={targetOpen ? 'Hide target editor' : 'Edit target'}
            >
              {section.target ? (
                <TargetBadge target={section.target as string | null} />
              ) : (
                <CalendarRange size={14} />
              )}
            </button>
            <StatusPicker
              value={section.status}
              onChange={(status) =>
                updateSection.mutate({ id: section.id, patch: { status } })
              }
            />
            <PriorityPicker
              value={section.priority}
              onChange={(priority) =>
                updateSection.mutate({ id: section.id, patch: { priority } })
              }
            />
          </div>
        )}

        {targetOpen && !collapsed && (
          <div className="border-nyx-700 bg-nyx-900/50 rounded-md border p-2.5">
            <TargetEditor
              value={section.target as string | null}
              due={section.due}
              onChange={(v) =>
                updateSection.mutate({ id: section.id, patch: { target: v } })
              }
            />
          </div>
        )}
      </div>

      {!collapsed && (
        <div className="p-2">
          <div className="space-y-0.5">
            {visibleTasks.map((task, index) => (
              <TaskDropTarget
                key={task.id}
                taskId={task.id}
                armedSource={linking?.taskId === task.id}
              >
                <div className="group/row flex items-stretch">
                  {rail.laneCount > 0 && (
                    <SequenceRailCell
                      row={rail.rows[index]}
                      laneCount={rail.laneCount}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <TaskRow
                      task={task}
                      onOpen={onOpenTask}
                      fadeOpacity={fadeByTaskId.get(task.id)}
                    />
                  </div>
                  {onToggleLink && (
                    <SequenceLinkControls
                      taskId={task.id}
                      linking={linking}
                      onToggleLink={onToggleLink}
                    />
                  )}
                </div>
              </TaskDropTarget>
            ))}
          </div>

          <form
            onSubmit={addTask}
            className="mt-1 flex items-center gap-1.5 px-2 py-1"
          >
            <Plus size={13} className="text-nyx-600" />
            <input
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder="Add a task…"
              className="text-nyx-300 placeholder:text-nyx-600 flex-1 bg-transparent py-0.5 text-body focus:outline-none"
            />
          </form>
        </div>
      )}
    </div>
  );
}

interface SortableSectionWrapperProps {
  id: Id;
  children: (
    dragProps: Record<string, unknown>
  ) => ReactNode;
}

export function SortableSectionWrapper({
  id,
  children,
}: SortableSectionWrapperProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style}>
      {children({ ...attributes, ...listeners })}
    </div>
  );
}

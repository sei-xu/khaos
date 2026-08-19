import { GripVertical, CornerUpLeft, CornerDownRight } from 'lucide-react';
import {
  StatusBadge,
  PriorityBadge,
  DueBadge,
  TargetBadge,
  ScheduledBadge,
  TodayToggle,
  ProjectChip,
} from '../common/ui';
import { minutesToHuman } from '../../lib/dateUtils';
import { useSequenceCounts } from '../../hooks/useSequence';
import { useScheduledTaskIds } from '../../hooks/useEvents';
import { useTodayTaskIds, useTodayMutations } from '../../hooks/useMoments';
import type { Task } from '../../lib/types';

const DIMMED: Task['status'][] = ['done', 'cancelled'];

interface TaskRowProps {
  task: Task;
  onOpen: (task: Task) => void;
  projectName?: string | null;
  projectField?: string | null;
  dragRef?: React.Ref<HTMLDivElement>;
  dragStyle?: React.CSSProperties;
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>;
  // Overrides the default 0.38 dim for done/cancelled tasks — used by
  // infinite sections to gradually fade settled tasks as they age.
  fadeOpacity?: number;
}

export default function TaskRow({
  task,
  onOpen,
  projectName,
  projectField,
  dragRef,
  dragStyle,
  dragHandleProps,
  fadeOpacity,
}: TaskRowProps) {
  const draggable = Boolean(dragHandleProps);
  const dimmed = DIMMED.includes(task.status);
  const seqCounts = useSequenceCounts().get(task.id);
  const scheduled = useScheduledTaskIds().has(task.id);
  const { data: todayTaskIds } = useTodayTaskIds();
  const { mark, unmark } = useTodayMutations();
  const markedToday = Boolean(todayTaskIds?.has(task.id));
  const opacity = dimmed ? (fadeOpacity ?? 0.38) : 1;

  return (
    <div
      ref={dragRef}
      style={{ ...dragStyle, opacity }}
      className="group hover:border-nyx-700 hover:bg-nyx-900 flex items-start gap-1.5 rounded-md border border-transparent px-2 py-1.5"
    >
      {draggable && (
        <span
          {...dragHandleProps}
          className="text-nyx-700 hover:text-nyx-400 mt-0.5 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={13} />
        </span>
      )}

      <span className="mt-1 shrink-0">
        <TodayToggle
          marked={markedToday}
          onToggle={() => (markedToday ? unmark.mutate(task.id) : mark.mutate(task.id))}
        />
      </span>

      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpen(task)}
          className="flex w-full flex-col gap-0.5 text-left md:flex-row md:items-center md:gap-1"
        >
          <span className="flex min-w-0 items-center gap-1 md:flex-1">
            <StatusBadge status={task.status} />
            <span
              className={`text-nyx-100 min-w-0 flex-1 truncate text-body ${
                task.status === 'cancelled' ? 'line-through' : ''
              }`}
            >
              {task.name}
            </span>
          </span>
          <span className="flex shrink-0 flex-wrap items-center gap-1">
            <PriorityBadge priority={task.priority} />
            {task.estimate ? (
              <span className="text-nyx-600 shrink-0 font-mono text-caption">
                {minutesToHuman(task.estimate)}
              </span>
            ) : null}
            {Boolean(seqCounts?.before) && (
              <span
                title={`${seqCounts!.before} tarefa(s) antes desta`}
                className="text-nyx-500 flex shrink-0 items-center gap-0.5 text-[11px]"
              >
                <CornerUpLeft size={11} />
                {seqCounts!.before}
              </span>
            )}
            {Boolean(seqCounts?.after) && (
              <span
                title={`${seqCounts!.after} tarefa(s) depois desta`}
                className="text-nyx-500 flex shrink-0 items-center gap-0.5 text-[11px]"
              >
                <CornerDownRight size={11} />
                {seqCounts!.after}
              </span>
            )}
            <TargetBadge target={task.target as string | null} />
            <DueBadge due={task.due} status={task.status} />
            <ScheduledBadge scheduled={scheduled} />
          </span>
        </button>

        {projectName && (
          <div className="mt-0.5 pl-0.5">
            <ProjectChip name={projectName} fieldName={projectField} />
          </div>
        )}
      </div>
    </div>
  );
}

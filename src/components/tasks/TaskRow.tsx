import { GripVertical } from 'lucide-react';
import { StatusBadge, TodayToggle, BacklogToggle, ProjectChip } from '../common/ui';
import TaskName from './TaskName';
import TaskRowBadges from './TaskRowBadges';
import { useSequenceCounts } from '../../hooks/useSequence';
import { useScheduledTaskIds } from '../../hooks/useEvents';
import { useTodayTaskIds, useTodayMutations } from '../../hooks/useMoments';
import {
  useBacklogMutations,
  useBacklogPosition,
} from '../../hooks/useBacklog';
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
  const scheduledAt = useScheduledTaskIds().get(task.id);
  const { data: todayTaskIds } = useTodayTaskIds();
  const { mark, unmark } = useTodayMutations();
  const { add: addToBacklog, removeFromBacklog } = useBacklogMutations();
  const markedToday = Boolean(todayTaskIds?.has(task.id));
  const inBacklog = task.backlog_rank !== null;
  const backlogPosition = useBacklogPosition(task.id);
  const opacity = dimmed ? (fadeOpacity ?? 0.38) : 1;

  return (
    <div
      ref={dragRef}
      style={{ ...dragStyle, opacity }}
      className="group hover:border-nyx-700 hover:bg-nyx-900 @container flex items-start gap-1.5 rounded-md border border-transparent px-2 py-1.5"
    >
      {draggable && (
        <span
          {...dragHandleProps}
          className="text-nyx-700 hover:text-nyx-400 mt-0.5 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={13} />
        </span>
      )}

      <span className="mt-1 flex shrink-0 flex-col items-center gap-1">
        <TodayToggle
          marked={markedToday}
          onToggle={() => (markedToday ? unmark.mutate(task.id) : mark.mutate(task.id))}
        />
        <BacklogToggle
          queued={inBacklog}
          position={backlogPosition}
          onToggle={() =>
            inBacklog ? removeFromBacklog.mutate(task.id) : addToBacklog.mutate(task.id)
          }
        />
      </span>

      <div className="min-w-0 flex-1">
        <button
          onClick={() => onOpen(task)}
          className="flex w-full flex-col gap-0.5 text-left @md:flex-row @md:items-center @md:gap-1"
        >
          <span className="flex min-w-[20ch] items-center gap-1 @md:flex-1">
            <StatusBadge status={task.status} />
            <TaskName name={task.name} status={task.status} />
          </span>
          <TaskRowBadges
            priority={task.priority}
            estimateMinutes={task.estimate}
            seqBefore={seqCounts?.before ?? 0}
            seqAfter={seqCounts?.after ?? 0}
            target={task.target as string | null}
            scheduledAt={scheduledAt ?? null}
            due={task.due}
            dueStatus={task.status}
          />
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

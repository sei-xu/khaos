import { CornerUpLeft, CornerDownRight } from 'lucide-react';
import { PriorityBadge, DueBadge, ScheduledBadge } from '../common/ui';
import { TargetBadge } from '../common/TargetEditor';
import { minutesToHuman } from '../../lib/dateUtils';
import { presentBadges } from '../../lib/taskBadges';
import type { Priority, Status } from '../../lib/types';

interface TaskRowBadgesProps {
  priority: Priority | null;
  estimateMinutes: number | null;
  seqBefore: number;
  seqAfter: number;
  target: string | null;
  scheduledAt: string | Date | null;
  due: string | null;
  // DueBadge needs the task's status to decide "overdue" styling.
  dueStatus: Status | null;
}

// Container-query breakpoints (narrowest container a badge still shows in)
// implementing src/lib/taskBadges.ts's tested DISCARD_ORDER as real CSS:
// estimate goes first as the row's own `@container` narrows, then the
// sequence counters, then scheduled, then target. Priority and due render
// unconditionally — taskBadges.ts never discards them. Written as literal
// classes (not computed from JS) because Tailwind's build-time scanner only
// picks up class names it can see as text in the source.
const HIDE_UNTIL_CONTAINER: Record<string, string> = {
  estimate: 'hidden @lg:inline-flex',
  seqBefore: 'hidden @md:inline-flex',
  seqAfter: 'hidden @sm:inline-flex',
  scheduled: 'hidden @xs:inline-flex',
  target: 'hidden @2xs:inline-flex',
};

// Maps src/lib/taskBadges.ts's pure badge decision to the real badge
// components for TaskRow's density — the only place that JSX lives, so a
// change to the decision logic doesn't require touching markup and vice
// versa.
export default function TaskRowBadges({
  priority,
  estimateMinutes,
  seqBefore,
  seqAfter,
  target,
  scheduledAt,
  due,
  dueStatus,
}: TaskRowBadgesProps) {
  const badges = presentBadges(
    {
      priority,
      estimateMinutes,
      seqBefore,
      seqAfter,
      target,
      scheduledAt,
      due,
    },
    'row'
  );

  return (
    <span className="flex min-w-0 shrink items-center gap-1">
      {badges.map((badge) => {
        const hideClass = HIDE_UNTIL_CONTAINER[badge.kind];
        switch (badge.kind) {
          case 'priority':
            return <PriorityBadge key="priority" priority={priority} />;
          case 'estimate':
            return (
              <span
                key="estimate"
                className={`text-nyx-600 text-caption shrink-0 font-mono ${hideClass}`}
              >
                {minutesToHuman(estimateMinutes as number)}
              </span>
            );
          case 'seqBefore':
            return (
              <span
                key="seqBefore"
                title={`${badge.count} tarefa(s) antes desta`}
                className={`text-nyx-500 shrink-0 items-center gap-0.5 text-[11px] ${hideClass}`}
              >
                <CornerUpLeft size={11} className="inline" />
                {badge.count}
              </span>
            );
          case 'seqAfter':
            return (
              <span
                key="seqAfter"
                title={`${badge.count} tarefa(s) depois desta`}
                className={`text-nyx-500 shrink-0 items-center gap-0.5 text-[11px] ${hideClass}`}
              >
                <CornerDownRight size={11} className="inline" />
                {badge.count}
              </span>
            );
          case 'target':
            return (
              <span key="target" className={hideClass}>
                <TargetBadge target={target} />
              </span>
            );
          case 'scheduled':
            return (
              <span key="scheduled" className={hideClass}>
                <ScheduledBadge scheduledAt={scheduledAt} />
              </span>
            );
          case 'due':
            return <DueBadge key="due" due={due} status={dueStatus} />;
          default:
            return null;
        }
      })}
    </span>
  );
}

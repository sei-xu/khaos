import clsx from 'clsx';
import { isCancelledName } from '../../lib/taskBadges';
import type { Status } from '../../lib/types';

interface TaskNameProps {
  name: string;
  status?: Status | null;
  // 1 (default): single-line truncation — dense rows. 2: up to two lines
  // before clamping — cards/pills with vertical room to spare.
  lines?: 1 | 2;
  className?: string;
}

// The one task-name renderer in the app. Always carries the full name as a
// tooltip (`title`) so a clamped/truncated name is never unrecoverable, and
// always reserves `min-w-0 flex-1` so a parent flex row can actually give it
// the room the badge cluster doesn't claim — see src/lib/taskBadges.ts for
// how that cluster decides what to give up first.
export default function TaskName({
  name,
  status,
  lines = 1,
  className,
}: TaskNameProps) {
  return (
    <span
      title={name}
      className={clsx(
        'min-w-0 flex-1',
        lines === 1 ? 'truncate' : 'line-clamp-2',
        isCancelledName(status) && 'line-through',
        className
      )}
    >
      {name}
    </span>
  );
}

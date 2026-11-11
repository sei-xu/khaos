import { StatusBadge, PriorityBadge, DueBadge } from '../common/ui';
import type { Status, Priority } from '../../lib/types';

interface InlineEntityPreviewProps {
  entityType: 'task' | 'project' | 'section';
  data: Record<string, unknown>;
}

// Compact "TaskRow"/"ProjectCard" look reused for chat mentions and the
// confirmation card — same badges, no drag handle / navigation chrome.
export function InlineEntityPreview({
  entityType,
  data,
}: InlineEntityPreviewProps) {
  const name = (data.name as string) || 'Untitled';
  const status = (data.status as Status) ?? 'planning';
  const priority = (data.priority as Priority) ?? 'medium';
  const due = (data.due as string | null) ?? null;

  return (
    <div className="border-nyx-700 bg-nyx-900 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1.5">
      <StatusBadge status={status} />
      <span className="text-nyx-100 min-w-0 flex-1 truncate text-body">
        {name}
      </span>
      <PriorityBadge priority={priority} />
      <DueBadge due={due} status={status} />
      <span className="text-nyx-600 shrink-0 text-label tracking-wide uppercase">
        {entityType}
      </span>
    </div>
  );
}

import { ListTodo, FolderKanban } from 'lucide-react';
import { StatusBadge, PriorityBadge, DueBadge } from '../common/ui';
import TaskName from '../tasks/TaskName';
import type { Status, Priority } from '../../lib/types';

interface InlineEntityPreviewProps {
  entityType: 'task' | 'project';
  data: Record<string, unknown>;
}

// Same icon as the entity's own nav link (ListTodo/FolderKanban), not a
// spelled-out "task"/"project" label — that text cost the name ~90px in the
// one place truncation was worst (the chat chip's fixed max-w-xs width, now
// dropped in EntityChip.tsx).
const ENTITY_ICON = {
  task: ListTodo,
  project: FolderKanban,
};

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
  const Icon = ENTITY_ICON[entityType];

  return (
    <div className="border-nyx-700 bg-nyx-900 flex min-w-0 flex-1 items-center gap-1.5 rounded-md border px-2 py-1.5">
      <StatusBadge status={status} />
      <TaskName name={name} status={status} className="text-nyx-100 text-body" />
      <PriorityBadge priority={priority} />
      <DueBadge due={due} status={status} />
      <Icon size={13} className="text-nyx-600 shrink-0" aria-label={entityType} />
    </div>
  );
}

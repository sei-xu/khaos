import { ChevronRight } from 'lucide-react';
import { StatusBadge, PriorityBadge, DueBadge, TargetBadge, FieldBadge } from '../common/ui';
import { getFieldMeta } from '../../lib/fieldsConfig';
import type { Section } from '../../lib/types';

interface SectionRowProps {
  section: Section;
  projectName?: string | null;
  fieldName?: string | null;
  onClick?: () => void;
}

// The row-form sibling to SectionChip's breadcrumb, same shape as
// ProjectRow (status + name + priority/target/due) since a section is
// really a project-shaped container one level down -- no section/task
// count, though, since a section has nothing of its own to count. Same
// md: stack-then-align breakpoint as ProjectRow/TaskRow, so the
// project>section breadcrumb name stays readable on mobile instead of
// getting squeezed to nothing by the badges. border-y (transparent)
// matches TaskRow's own border-transparent on all sides, so this row
// renders at the exact same height as TaskRow. border-r closes the frame
// on the right, neutral Nyx (only the left spine carries field identity).
// Padding is symmetric px-2 (SPC "element" rung) -- was pl-2.5, a
// half-step off the spacing ladder. Every gap in the row -- outer stack,
// both inner groups -- is the same gap-1.5, so no element reads as more
// or less related to its neighbor than any other.
export default function SectionRow({
  section,
  projectName,
  fieldName,
  onClick,
}: SectionRowProps) {
  const fieldColor = getFieldMeta(fieldName).color;

  return (
    <button
      onClick={onClick}
      style={{ borderLeftColor: fieldColor }}
      className="group hover:bg-nyx-900 border-nyx-700 flex w-full flex-col gap-1.5 rounded-md border-y border-r border-l-2 py-1.5 px-2 text-left md:flex-row md:items-center"
    >
      <span className="flex min-w-0 items-center gap-1.5 md:flex-1">
        <FieldBadge fieldName={fieldName} size="xs" />
        <StatusBadge status={section.status} />
        <span className="text-nyx-500 shrink-0 truncate text-body font-bold">
          {projectName}
        </span>
        <ChevronRight size={12} className="text-nyx-700 shrink-0" />
        <span className="text-nyx-100 min-w-0 flex-1 truncate text-body">
          {section.name}
        </span>
      </span>
      <span className="flex shrink-0 flex-wrap items-center gap-1.5">
        <PriorityBadge priority={section.priority} />
        <TargetBadge target={section.target as string | null} />
        <DueBadge due={section.due} status={section.status} />
      </span>
    </button>
  );
}

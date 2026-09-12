import { ChevronRight } from 'lucide-react';
import { ProjectChip } from '../common/ui';

interface SectionChipProps {
  name: string;
  projectName?: string | null;
  projectField?: string | null;
}

// A section is never read on its own -- it's always shown with the project
// it belongs to, so this isn't a chip/row pair like Project has. One
// breadcrumb-shaped mark covers both compact and list contexts: the parent
// project first (already-established ProjectChip, icon-on-left, carries
// the field color), then the section name plain -- no icon of its own,
// since a section doesn't carry field/status identity the way projects
// and tasks do.
export default function SectionChip({
  name,
  projectName,
  projectField,
}: SectionChipProps) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5 text-caption">
      <ProjectChip name={projectName} fieldName={projectField} />
      <ChevronRight size={12} className="text-nyx-700 shrink-0" />
      <span className="text-nyx-200 truncate">{name}</span>
    </span>
  );
}

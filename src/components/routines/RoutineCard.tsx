import { CheckCircle, Pencil, Trash2 } from 'lucide-react';
import { FREQUENCY_OPTIONS, TIME_OPTIONS } from '../../lib/constants';
import type { RoutineWithField } from '../../lib/types';

function FrequencyLabel({ value }: { value: string }) {
  return (
    <span className="text-eros-400 font-mono text-caption">
      {FREQUENCY_OPTIONS.find((o) => o.value === value)?.label ?? value}
    </span>
  );
}

function TimeLabel({ value }: { value: string | null }) {
  return (
    <span className="text-nyx-400 text-caption">
      {TIME_OPTIONS.find((o) => o.value === value)?.label ?? value}
    </span>
  );
}

interface RoutineCardProps {
  routine: RoutineWithField;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
}

// The only real mark a routine has today -- a list row (RoutinesPage is
// its one home), no compact chip or chat mention exists. Extracted out of
// RoutinesPage so this docs page can demo the real component instead of
// a lookalike.
export default function RoutineCard({
  routine,
  onEdit,
  onDelete,
  onToggle,
}: RoutineCardProps) {
  return (
    <div className="border-nyx-700 bg-nyx-800/40 flex items-start gap-3 rounded-lg border px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-nyx-100 font-medium">{routine.name}</span>
          <FrequencyLabel value={routine.frequency} />
          <TimeLabel value={routine.preferred_time} />
          {routine.estimate && (
            <span className="text-nyx-500 font-mono text-caption">
              {routine.estimate}min
            </span>
          )}
        </div>
        {routine.constraints && (
          <p className="text-nyx-500 mt-1 text-caption leading-relaxed">
            {routine.constraints}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onToggle}
          title={routine.active ? 'Deactivate' : 'Activate'}
          className="text-nyx-500 hover:bg-nyx-700 hover:text-nyx-200 flex h-7 w-7 items-center justify-center rounded"
        >
          <CheckCircle
            size={14}
            className={routine.active ? 'text-gaia-500' : ''}
          />
        </button>
        <button
          onClick={onEdit}
          className="text-nyx-500 hover:bg-nyx-700 hover:text-nyx-200 flex h-7 w-7 items-center justify-center rounded"
        >
          <Pencil size={14} />
        </button>
        <button
          onClick={onDelete}
          className="text-nyx-500 hover:bg-nyx-700 hover:text-tartarus-500 flex h-7 w-7 items-center justify-center rounded"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

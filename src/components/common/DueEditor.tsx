import { useState } from 'react';
import { Flag } from 'lucide-react';
import clsx from 'clsx';
import { TextInput, TimeToggle } from './ui';
import { isOverdue } from '../../lib/dateUtils';
import type { Status } from '../../lib/types';

interface DueEditorProps {
  value?: string | null;
  status?: Status | null;
  onChange: (next: string | null) => void;
  disabled?: boolean;
}

function getLocalValues(raw?: string | null) {
  if (!raw) return { date: '', time: '' };
  const d = new Date(raw);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
}

// The bordered date(+time) pill from TaskDetailModal's Due field, extracted
// into a reusable component -- one Eros/Tartarus-tinted pill (color follows
// isOverdue, same as DueBadge), inline date input, optional inline time
// input toggled by the same TimeToggle used on Target.
export default function DueEditor({
  value,
  status,
  onChange,
  disabled,
}: DueEditorProps) {
  const values = getLocalValues(value);
  const [showTime, setShowTime] = useState(() => {
    if (!value) return false;
    const timePart = value.split('T')[1];
    return Boolean(timePart) && !timePart.startsWith('00:00:00');
  });

  function commit(dateStr: string, timeStr: string, isTimeActive: boolean) {
    if (!dateStr) {
      onChange(null);
      return;
    }
    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    if (isTimeActive && timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      localDate.setHours(hours, minutes, 0, 0);
    }
    onChange(localDate.toISOString());
  }

  const overdue = isOverdue(value, status);

  return (
    <div
      className={clsx(
        'inline-flex h-8.5 w-fit items-center gap-1.5 rounded-md border px-2.5 font-mono text-caption',
        overdue
          ? 'border-tartarus-500 bg-tartarus-500/10 text-tartarus-400'
          : 'border-eros-500 bg-eros-500/10 text-eros-400'
      )}
    >
      {/* text-body matches the default input's own size (TextInput,
          Forge) -- both date and time read at that same size, only
          their box widths differ (date wider, time narrower). Icon
          bumped to 15px to match that size, same as the search input's
          icon in Forge. */}
      <Flag size={15} className="shrink-0" />
      <TextInput
        type="date"
        value={values.date}
        disabled={disabled}
        onChange={(e) => commit(e.target.value, values.time, showTime)}
        // w-[11ch]: 10ch clipped the last digit at text-body size (the
        // native date control reserves a little internal chrome even
        // with the calendar icon hidden) -- 12ch fit clean but left the
        // middot visibly off-center. 11ch is the balance.
        className={clsx(
          'due-input w-[11ch]! shrink-0 border-0! bg-transparent! p-0! text-center text-body!',
          overdue ? 'text-tartarus-400!' : 'text-eros-400!'
        )}
      />
      {showTime && values.date && (
        <>
          <span className="opacity-50">·</span>
          <TextInput
            type="time"
            value={values.time || '12:00'}
            disabled={disabled}
            onChange={(e) => commit(values.date, e.target.value, true)}
            className={clsx(
              'due-input w-13! shrink-0 border-0! bg-transparent! p-0! text-center text-body!',
              overdue ? 'text-tartarus-400!' : 'text-eros-400!'
            )}
          />
        </>
      )}
      {values.date && (
        <TimeToggle
          active={showTime}
          disabled={disabled}
          onClick={() => {
            const next = !showTime;
            setShowTime(next);
            commit(values.date, next ? values.time || '12:00' : '00:00', next);
          }}
        />
      )}
    </div>
  );
}

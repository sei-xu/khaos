import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from 'react';
import {
  X,
  MessageCircle,
  CircleDashed,
  Play,
  Eye,
  Check,
  Pause,
  Ban,
  Hourglass,
  Flame,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
  Target,
  Flag,
  DraftingCompass,
  Plus,
  Clock,
  CalendarClock,
  Star,
  type LucideIcon,
} from 'lucide-react';
import clsx from 'clsx';
import { STATUS_META, PRIORITY_META, PRIORITIES } from '../../lib/constants';
import { formatDueCompact, isOverdue, minutesToHuman } from '../../lib/dateUtils';
import { parseRange } from '../../lib/range';
import { getFieldMeta } from '../../lib/fieldsConfig';
import type { Status, Priority } from '../../lib/types';
import type { TaskProgress } from '../../lib/taskProgress';

const STATUS_ICONS: Record<string, LucideIcon> = {
  MessageCircle,
  CircleDashed,
  Play,
  Eye,
  Check,
  Pause,
  Ban,
  Hourglass,
};
const PRIORITY_ICONS: Record<string, LucideIcon> = {
  Flame,
  ChevronsUp,
  ChevronUp,
  ChevronDown,
};

interface StatusIconProps {
  status?: Status | null;
  size?: number;
}

export function StatusIcon({ status, size = 18 }: StatusIconProps) {
  const meta = (status && STATUS_META[status]) || STATUS_META.planning;
  const Icon = STATUS_ICONS[meta.icon] || CircleDashed;
  return (
    <span
      title={meta.label}
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        color: meta.iconColor,
      }}
    >
      <Icon size={Math.round(size * 0.6)} />
    </span>
  );
}

interface StatusBadgeProps {
  status?: Status | null;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const meta = (status && STATUS_META[status]) || STATUS_META.planning;
  const iconSize = size === 'sm' ? 18 : 24;

  return (
    <span
      title={meta.label}
      className="inline-flex items-center gap-0.5 rounded-md font-mono font-medium tracking-wider uppercase"
      style={{
        fontSize: size === 'sm' ? 11 : 13,
        marginRight: size === 'sm' ? 4 : 6,
        backgroundColor: meta.circleBg,
      }}
    >
      <StatusIcon status={status} size={iconSize} />
      <span className="pr-1" style={{ color: meta.iconColor }}>
        {meta.acronym}
      </span>
    </span>
  );
}

interface PriorityBadgeProps {
  priority?: Priority | null;
  size?: 'sm' | 'md';
}

export function PriorityBadge({
  priority = 'medium',
  size = 'sm',
}: PriorityBadgeProps) {
  if (!priority) return null;
  const meta = PRIORITY_META[priority] || PRIORITY_META.medium;
  const Icon = PRIORITY_ICONS[meta.icon] || ChevronUp;
  const px = size === 'sm' ? 24 : 28;
  return (
    <span
      title={meta.label}
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${priority === 'urgent' ? 'animate-bounce' : ''}`}
      style={{
        width: px,
        height: px,
        color: meta.iconColor,
      }}
    >
      <Icon size={Math.round(px * 0.55)} />
    </span>
  );
}

interface StatusPickerProps {
  value?: Status | null;
  onChange: (status: Status) => void;
}

// Two fixed rows instead of natural width-based wrapping: line 1 is the
// active flow (planning through done), line 2 is everything "stopped"
// (in review, paused, cancelled, waiting) — a stable grouping regardless
// of container width, not just wherever wrapping happens to land.
const STATUS_ROWS: Status[][] = [
  ['planning', 'todo', 'in_progress', 'done'],
  ['in_review', 'paused', 'cancelled', 'waiting'],
];

// Radio-style status selector, styled straight off StatusBadge — same
// icon-in-circle + acronym, same circleBg. No visible "Status" caption above
// it; the icon + acronym already reads as the label everywhere else in the
// app. Unselected options dim rather than disappear, so the full set stays
// scannable at a glance.
export function StatusPicker({ value, onChange }: StatusPickerProps) {
  return (
    <div
      className="flex flex-col gap-1"
      role="radiogroup"
      aria-label="Status"
    >
      {STATUS_ROWS.map((row, i) => (
        <div key={i} className="flex flex-wrap gap-1">
          {row.map((s) => {
            const meta = STATUS_META[s];
            const active = s === value;
            return (
              <button
                key={s}
                type="button"
                role="radio"
                aria-checked={active}
                title={meta.label}
                onClick={() => onChange(s)}
                style={{
                  backgroundColor: meta.circleBg,
                  boxShadow: active ? `0 0 0 1.5px ${meta.iconColor}` : 'none',
                }}
                className={clsx(
                  'inline-flex items-center gap-1 rounded-full py-0.5 pr-2 pl-0.5 transition-all',
                  active ? 'opacity-100' : 'opacity-45 hover:opacity-75'
                )}
              >
                <StatusIcon status={s} size={18} />
                <span
                  className="font-mono text-label font-semibold tracking-wider uppercase"
                  style={{ color: meta.iconColor }}
                >
                  {meta.acronym}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

interface PriorityPickerProps {
  value?: Priority | null;
  onChange: (priority: Priority) => void;
}

// Same idea for Priority — icon-only circles matching PriorityBadge's own
// look (no background chip, that's the point), minus its "urgent" bounce,
// which belongs to a single live badge, not a menu of options.
export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  return (
    <div
      className="flex items-center gap-1.5"
      role="radiogroup"
      aria-label="Priority"
    >
      {PRIORITIES.map((p) => {
        const meta = PRIORITY_META[p];
        const Icon = PRIORITY_ICONS[meta.icon] || ChevronUp;
        const active = p === (value ?? 'medium');
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            title={meta.label}
            onClick={() => onChange(p)}
            style={{
              color: meta.iconColor,
              boxShadow: active ? `0 0 0 1.5px ${meta.iconColor}` : 'none',
            }}
            className={clsx(
              'inline-flex h-7 w-7 items-center justify-center rounded-full transition-all',
              active ? 'opacity-100' : 'opacity-40 hover:opacity-70'
            )}
          >
            <Icon size={15} />
          </button>
        );
      })}
    </div>
  );
}

interface IconAddButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon?: ReactNode;
}

// Small square plus-sign button, filled violet with a dark icon — same
// color language as the checked time-toggle switches. The one "add this
// thing" affordance shared by Sequence's Previous/Next columns and Tags,
// so every add trigger next to a section label reads the same way. Also
// reused for "clear this field" (pass icon={<X .../>}) so both actions
// share one visual language next to a field label.
export function IconAddButton({
  className,
  label,
  icon,
  ...props
}: IconAddButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        'bg-violet-400 text-ink-900 hover:bg-violet-300 active:bg-violet-500 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded transition-colors',
        className
      )}
      {...props}
    >
      {icon ?? <Plus size={10} />}
    </button>
  );
}

interface TagProps {
  children: ReactNode;
  onRemove?: () => void;
}

export function Tag({ children, onRemove }: TagProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pontus-500/10 px-2 py-0.5 text-caption font-medium text-pontus-400">
      {children}
      {onRemove && (
        <button
          onClick={onRemove}
          className="rounded-full hover:bg-pontus-500/20"
          aria-label="Remove tag"
        >
          <X size={11} />
        </button>
      )}
    </span>
  );
}

interface TagSuggestionProps {
  children: ReactNode;
  onClick: () => void;
}

// Dashed outline, muted — visually distinct from an applied Tag pill so a
// suggestion never looks like it's already attached. Always rendered next
// to the current tags (not hidden behind opening a picker) — one click to
// add.
export function TagSuggestion({ children, onClick }: TagSuggestionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="border-ink-600 text-ink-500 hover:border-ink-500 hover:text-ink-300 inline-flex items-center gap-0.5 rounded-full border border-dashed px-2 py-0.5 text-xs"
    >
      <Plus size={10} />
      {children}
    </button>
  );
}

interface TimeToggleProps {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

// Small "add/remove time" button, shared by every field that lets a date
// grow an optional time-of-day (Due, Target's start/end).
export function TimeToggle({
  active,
  disabled,
  onClick,
  className,
}: TimeToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={active ? 'Remove time' : 'Add time'}
      className={clsx(
        'flex shrink-0 items-center gap-0.5 rounded border px-1 text-[10px] transition-colors',
        active
          ? 'border-copper-500 text-copper-400 bg-copper-500/10'
          : 'border-ink-700 text-ink-500 hover:text-ink-300',
        className
      )}
    >
      <Clock size={10} />
    </button>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
}

export function Button({
  variant = 'default',
  size = 'md',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
        size === 'sm' ? 'px-2 py-1.5 text-caption' : 'px-4 py-2 text-body',
        variant === 'default' &&
          'bg-eros-500 text-nyx-900 hover:bg-eros-400',
        variant === 'secondary' && 'bg-nyx-700 text-nyx-100 hover:bg-nyx-600',
        variant === 'ghost' &&
          'text-nyx-300 hover:bg-nyx-800 hover:text-nyx-100 bg-transparent',
        variant === 'danger' &&
          'text-tartarus-500 hover:bg-tartarus-500/10 bg-transparent',
        className
      )}
      {...props}
    />
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
}

export function IconButton({
  className,
  label,
  children,
  ...props
}: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        'text-nyx-400 hover:bg-nyx-700 hover:text-nyx-100 inline-flex h-8 w-8 items-center justify-center rounded transition-colors',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...props }: SelectProps) {
  return (
    <select
      className={clsx(
        // Same px-3/py-2 as TextInput -- they used to differ (px-2/py-1.5
        // here vs px-3/py-2 there), which made the two controls render at
        // different heights side by side.
        'border-nyx-600 bg-nyx-800 text-nyx-100 rounded border px-3 py-2 text-body',
        'focus:border-eros-400 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    >
      {children}
    </select>
  );
}

type TextInputProps = InputHTMLAttributes<HTMLInputElement>;

export function TextInput({ className, ...props }: TextInputProps) {
  return (
    <input
      className={clsx(
        'border-nyx-600 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 w-full rounded border px-3 py-2 text-body',
        'focus:border-eros-400 focus:outline-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className
      )}
      {...props}
    />
  );
}

interface ModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit?: () => void;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

export function Modal({
  open,
  onClose,
  onSubmit,
  title,
  children,
  footer,
  width = 'max-w-lg',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const onSubmitRef = useRef(onSubmit);
  useEffect(() => {
    onCloseRef.current = onClose;
    onSubmitRef.current = onSubmit;
  });

  useEffect(() => {
    if (!open) return;
    // Focus the dialog itself only on open — not on every render.
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        if (onSubmitRef.current) {
          e.preventDefault();
          onSubmitRef.current();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]); // deliberately excludes onClose/onSubmit — handled via refs above

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 pt-[8vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className={clsx(
          'border-nyx-700 bg-nyx-800 shadow-panel w-full rounded-lg border focus:outline-none',
          width
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-nyx-700 flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-display text-nyx-100 min-w-0 flex-1 text-display">
            {title}
          </h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="border-nyx-700 flex justify-end gap-2 border-t px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  hint?: string;
}

export function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div className="border-nyx-700 flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-6 py-14 text-center">
      {Icon && <Icon size={28} className="text-nyx-600" />}
      <p className="text-nyx-300 font-medium">{title}</p>
      {hint && <p className="text-nyx-500 max-w-xs text-body">{hint}</p>}
    </div>
  );
}

interface DueBadgeProps {
  due?: string | null;
  status?: Status | null;
}

// Plain icon + text, deliberately no border or background — that absence of
// chrome is what keeps the copper-colored default from reading as a
// clickable Add button, which owns the bordered-pill look everywhere else.
export function DueBadge({ due, status }: DueBadgeProps) {
  if (!due) return null;
  const parts = formatDueCompact(due);
  if (!parts) return null;
  const overdue = isOverdue(due, status);

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 font-mono text-caption tracking-tight',
        overdue ? 'text-tartarus-500 animate-pulse' : 'text-eros-400'
      )}
    >
      <Flag size={11} className="shrink-0" />
      <span>
        <span className="font-bold">{parts.day}</span>
        <span>{parts.month}</span>
      </span>
    </span>
  );
}

interface TargetBadgeProps {
  target?: string | null;
}

// Compact display of the `target` planning window — start (bold day +
// month, same convention as DueBadge) through end, or an arrow with no
// second date when the target is open-ended.
export function TargetBadge({ target }: TargetBadgeProps) {
  if (!target) return null;
  const { start, end } = parseRange(target);
  if (!start) return null;
  const startParts = formatDueCompact(start);
  const endParts = end ? formatDueCompact(end) : null;
  if (!startParts) return null;

  return (
    <span className="border-nyx-600 text-nyx-400 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[11px] tracking-tight">
      <Target size={11} className="shrink-0" />
      <span>
        <span className="font-bold">{startParts.day}</span>
        {startParts.month}
      </span>
      <span className="text-nyx-600">→</span>
      {endParts && (
        <span>
          <span className="font-bold">{endParts.day}</span>
          {endParts.month}
        </span>
      )}
    </span>
  );
}

// Indicates the task already has a future 'scheduled' event tied to it —
// prevents scheduling it twice. Plain icon, no text, same chrome-less
// convention as DueBadge so it doesn't compete visually with the pill badges.
export function ScheduledBadge({ scheduled }: { scheduled?: boolean }) {
  if (!scheduled) return null;
  return (
    <span
      title="Já agendada"
      className="text-sage-500 inline-flex shrink-0 items-center"
    >
      <CalendarClock size={12} />
    </span>
  );
}

// Toggle button for marking a task "for today" — filled/copper when marked,
// outline/dim otherwise. Click always toggles; stopPropagation so it works
// inside the TaskRow's onOpen button without also opening the modal.
export function TodayToggle({
  marked,
  onToggle,
}: {
  marked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      title={marked ? 'Marcada para hoje' : 'Marcar para hoje'}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      className={clsx(
        'inline-flex shrink-0 items-center transition-colors',
        marked ? 'text-eros-400' : 'text-nyx-700 hover:text-nyx-400'
      )}
    >
      <Star size={12} fill={marked ? 'currentColor' : 'none'} />
    </button>
  );
}

interface FieldBadgeProps {
  fieldName?: string | null;
  size?: 'xs' | 'sm' | 'md';
}

// The one place field icon/color is resolved into a visual. Three sizes for
// three contexts: 'xs' inline next to a project name in dense lists (no
// circle, just a colored glyph), 'sm' a standalone icon-in-circle (project
// cards), 'md' a full pill with the field name spelled out (project detail
// header). Field names not in FIELDS_CONFIG fall back silently via
// getFieldMeta rather than rendering nothing or throwing.
export function FieldBadge({ fieldName, size = 'sm' }: FieldBadgeProps) {
  if (!fieldName) return null;
  const meta = getFieldMeta(fieldName);
  const Icon = meta.icon;

  if (size === 'xs') {
    return (
      <span
        title={fieldName}
        className={clsx('inline-flex shrink-0', meta.classes.text)}
      >
        <Icon size={11} />
      </span>
    );
  }

  if (size === 'sm') {
    return (
      <span
        title={fieldName}
        className={clsx(
          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border',
          meta.classes.border,
          meta.classes.bg,
          meta.classes.text
        )}
      >
        <Icon size={13} />
      </span>
    );
  }

  return (
    <span
      title={fieldName}
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-caption font-medium tracking-wide uppercase',
        meta.classes.border,
        meta.classes.bg,
        meta.classes.text
      )}
      style={{ fontVariantCaps: 'small-caps' }}
    >
      <Icon size={13} />
      {fieldName}
    </span>
  );
}

interface ProjectChipProps {
  name?: string | null;
  fieldName?: string | null;
  className?: string;
}

// Canonical way to reference a project inline — next to a task row, in
// search results, in breadcrumbs. Anywhere a project shows up as *context*
// for something else (not as the primary subject, which is ProjectCard),
// it should render through this component so it always looks the same:
// field glyph + name, muted, no status/priority (those belong to the task
// or to the full ProjectCard, not to a passing reference).
export function ProjectChip({ name, fieldName, className }: ProjectChipProps) {
  if (!name) return null;
  return (
    <span
      className={clsx(
        'text-nyx-500 inline-flex min-w-0 items-center gap-1 text-caption',
        className
      )}
    >
      <FieldBadge fieldName={fieldName} size="xs" />
      <span className="truncate">{name}</span>
    </span>
  );
}

const PROGRESS_BAR_LENGTH = 8;
const PROGRESS_LEVEL_COLOR: Record<TaskProgress['level'], string> = {
  ok: 'text-gaia-500',
  warn: 'text-eros-500',
  over: 'text-tartarus-500',
};

interface TaskProgressBarProps {
  progress: TaskProgress;
  className?: string;
  // 'compact' (default): bar + numbers only, no icon — task rows, kanban
  // cards, calendar, chat mentions, anywhere already busy with other icons.
  // 'full': adds the drafting-compass identity icon and spells out
  // "logged / estimated" — the task detail modal only, where the field
  // stands alone with no surrounding context to lean on.
  size?: 'compact' | 'full';
}

// Estimated-vs-logged meter — the one Estimate badge, in two densities.
// sage/copper/rust for under/near/over the estimate, kept separate from any
// event-type accent color even where the hex happens to match.
export function TaskProgressBar({
  progress,
  className,
  size = 'compact',
}: TaskProgressBarProps) {
  const filled = Math.min(
    PROGRESS_BAR_LENGTH,
    Math.round((progress.pct / 100) * PROGRESS_BAR_LENGTH)
  );
  const empty = PROGRESS_BAR_LENGTH - filled;
  const full = size === 'full';

  return (
    <div
      className={clsx(
        'flex flex-wrap items-center gap-x-1.5 gap-y-0 font-mono leading-tight',
        full ? 'text-body' : 'text-label',
        className
      )}
    >
      {full && (
        <DraftingCompass size={15} className="text-nyx-400 shrink-0" />
      )}
      <span className="shrink-0 tracking-[-1px]">
        <span className={PROGRESS_LEVEL_COLOR[progress.level]}>
          {'▰'.repeat(filled)}
        </span>
        <span className="text-nyx-700">{'▱'.repeat(empty)}</span>
      </span>
      <span className="text-nyx-400 shrink-0 whitespace-nowrap">
        {full
          ? `${minutesToHuman(progress.loggedMinutes)} logged / ${minutesToHuman(progress.estimateMinutes)} estimated`
          : `${minutesToHuman(progress.loggedMinutes)} / ${minutesToHuman(progress.estimateMinutes)}`}
      </span>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useSyncActiveEntity } from '../../lib/activeEntityContext';
import clsx from 'clsx';
import {
  Plus,
  Trash2,
  Play,
  Square,
  X,
  CornerUpLeft,
  CornerDownRight,
  Flag,
  Target,
  DraftingCompass,
  Bot,
  Layers,
} from 'lucide-react';
import {
  Modal,
  TextInput,
  Button,
  FieldBadge,
  ProjectChip,
  Tag,
  TagSuggestion,
  IconAddButton,
  TaskProgressBar,
  StatusPicker,
  PriorityPicker,
  StatusBadge,
  PriorityBadge,
  TimeToggle,
} from '../common/ui';
import TargetEditor from '../common/TargetEditor';
import {
  minutesToHuman,
  formatDue,
  formatDueCompact,
  parseMomentTime,
  isOverdue,
} from '../../lib/dateUtils';
import { parseRange, rangeDurationMinutes } from '../../lib/range';
import { computeTaskProgress } from '../../lib/taskProgress';
import {
  useTaskMutations,
  useTaskItems,
  useTaskItemMutations,
  useSections,
  useProjects,
  useFields,
  useTasks,
  useTasksSequence,
} from '../../hooks/useHierarchy';
import {
  useTaskLogs,
  useForegroundTimer,
  useBackgroundTimers,
  useTimerMutations,
} from '../../hooks/useTimeTracking';
import { useTags, useTagLinks, useTagMutations } from '../../hooks/useTags';
import { useNotes, useNoteMutations } from '../../hooks/useMoments';
import { useTaskSequence, useSequenceMutations } from '../../hooks/useSequence';
import { wouldCreateCycle } from '../../lib/sequenceGraph';
import type {
  Id,
  Moment,
  MomentType,
  Priority,
  Status,
  Task,
  WorkTag,
} from '../../lib/types';

const MOMENT_TYPE_LABELS: Partial<Record<MomentType, string>> = {
  created: 'Created',
  due: 'Due date',
  estimate: 'Estimate',
  status: 'Status',
  started: 'Started',
  stopped: 'Stopped',
  scheduled: 'Scheduled',
  target: 'Target',
  priority: 'Priority',
};

function describeMoment(moment: Moment): string {
  const label = MOMENT_TYPE_LABELS[moment.moment_type] ?? moment.moment_type;
  if (moment.previous_value && moment.value) {
    return `${label}: ${moment.previous_value} → ${moment.value}`;
  }
  if (moment.value) return `${label}: ${moment.value}`;
  return label;
}

// Icon for the moment types that don't get the chip treatment below (due,
// target, estimate, status, priority all render via MomentChangeChip
// instead, with their own icon inline). Scheduled gets a plain dot rather
// than a shape — created/note stay iconless.
function MomentIcon({ moment }: { moment: Moment }) {
  switch (moment.moment_type) {
    case 'started':
      return (
        <Play
          size={12}
          fill="currentColor"
          className="text-eros-500 mt-0.5 shrink-0"
        />
      );
    case 'stopped':
      return (
        <Square
          size={12}
          fill="currentColor"
          className="text-nyx-400 mt-0.5 shrink-0"
        />
      );
    case 'scheduled':
      return (
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-hypnos-400" />
      );
    default:
      return null;
  }
}

// Moment types with a real before/after value get the chip treatment
// below instead of plain text — everything else (created, started,
// stopped, scheduled, note) keeps the older icon + label rendering.
const CHIP_MOMENT_TYPES = new Set<MomentType>([
  'due',
  'target',
  'estimate',
  'status',
  'priority',
]);

function formatDueMomentValue(raw: string | null): ReactNode {
  if (!raw) return 'ø';
  const parts = formatDueCompact(raw);
  if (!parts) return raw;
  return (
    <>
      <b className="font-bold">{parts.day}</b>
      {parts.month}
    </>
  );
}

function formatTargetMomentValue(raw: string | null): ReactNode {
  if (!raw) return 'ø';
  const { start, end } = parseRange(raw);
  if (!start) return 'ø';
  const startParts = formatDueCompact(start);
  if (!startParts) return raw;
  const endParts = end ? formatDueCompact(end) : null;
  return (
    <>
      <b className="font-bold">{startParts.day}</b>
      {startParts.month}
      {endParts && (
        <>
          {' '}
          <span className="text-nyx-600">→</span>{' '}
          <b className="font-bold">{endParts.day}</b>
          {endParts.month}
        </>
      )}
    </>
  );
}

interface MomentChipHalfProps {
  icon?: ReactNode;
  muted?: boolean;
  children: ReactNode;
}

// "from" is the exact same element as "to" — same icon, same color —
// just faded and crossed out, not recolored to a generic grey.
function MomentChipHalf({ icon, muted, children }: MomentChipHalfProps) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1', muted && 'opacity-50')}
    >
      {icon}
      <span
        className={clsx(
          'font-mono',
          muted ? 'text-nyx-600 line-through' : 'font-semibold'
        )}
      >
        {children}
      </span>
    </span>
  );
}

// Replicates the assistant chat's ChangeChip pattern for the moments log:
// icon + value on both sides of the arrow, "from" faded and struck through,
// "ø" for a null value instead of literal empty text.
function MomentChangeChip({ moment }: { moment: Moment }) {
  const { moment_type: type, previous_value: prev, value } = moment;

  if (type === 'due' || type === 'target') {
    const Icon = type === 'due' ? Flag : Target;
    const accent = type === 'due' ? 'text-eros-400' : 'text-nyx-400';
    const format =
      type === 'due' ? formatDueMomentValue : formatTargetMomentValue;
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-caption">
        <MomentChipHalf
          icon={<Icon size={11} className={clsx('shrink-0', accent)} />}
          muted
        >
          <span className={accent}>{format(prev)}</span>
        </MomentChipHalf>
        <span className="text-nyx-600">→</span>
        <MomentChipHalf
          icon={<Icon size={11} className={clsx('shrink-0', accent)} />}
        >
          <span className={accent}>{format(value)}</span>
        </MomentChipHalf>
      </span>
    );
  }

  if (type === 'estimate') {
    const format = (raw: string | null) =>
      raw ? minutesToHuman(Number(raw)) : 'ø';
    return (
      <span className="inline-flex flex-wrap items-center gap-1.5 text-caption">
        <MomentChipHalf
          icon={<DraftingCompass size={11} className="text-nyx-400 shrink-0" />}
          muted
        >
          {format(prev)}
        </MomentChipHalf>
        <span className="text-nyx-600">→</span>
        <MomentChipHalf
          icon={<DraftingCompass size={11} className="text-nyx-400 shrink-0" />}
        >
          {format(value)}
        </MomentChipHalf>
      </span>
    );
  }

  // status / priority — nests the real badges rather than reformatting
  // the enum text by hand.
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      {prev ? (
        <span className="opacity-50">
          {type === 'status' ? (
            <StatusBadge status={prev as Status} />
          ) : (
            <PriorityBadge priority={prev as Priority} />
          )}
        </span>
      ) : (
        <span className="text-nyx-600 text-caption">ø</span>
      )}
      <span className="text-nyx-600 text-caption">→</span>
      {type === 'status' ? (
        <StatusBadge status={value as Status} />
      ) : (
        <PriorityBadge priority={value as Priority} />
      )}
    </span>
  );
}

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
  action?: ReactNode;
  // 'end' (default): action pinned to the opposite edge from the title.
  // 'inline': action sits right next to the title, like Due's label+toggle
  // pairing — used where the action is tightly coupled to the title itself
  // (Tags' add button) rather than a separate far-corner control.
  actionPlacement?: 'end' | 'inline';
}

function Section({
  title,
  children,
  action,
  actionPlacement = 'end',
}: SectionProps) {
  return (
    <div className="border-nyx-700 border-t pt-3.5 first:border-0 first:pt-0">
      <div
        className={clsx(
          'mb-2 flex items-center',
          actionPlacement === 'inline' ? 'gap-2' : 'justify-between'
        )}
      >
        <h3 className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </div>
  );
}

interface SequenceChipProps {
  task: Task;
  direction: 'before' | 'after';
  projectName?: string | null;
  projectField?: string | null;
  onOpen?: (task: Task) => void;
  onRemove: () => void;
}

// A short, full-width row (no pill background) — direction icon + name on
// the left, the linked task's project mention and remove button grouped
// on the right.
function SequenceChip({
  task,
  direction,
  projectName,
  projectField,
  onOpen,
  onRemove,
}: SequenceChipProps) {
  const DirIcon = direction === 'before' ? CornerUpLeft : CornerDownRight;
  return (
    <div className="flex w-full items-center justify-between gap-2 py-0.5">
      <button
        type="button"
        onClick={() => onOpen?.(task)}
        disabled={!onOpen}
        className={clsx(
          'text-nyx-200 flex min-w-0 items-center gap-1 text-left text-caption',
          onOpen ? 'hover:text-eros-400' : 'cursor-default'
        )}
      >
        <DirIcon size={11} className="text-nyx-500 shrink-0" />
        <span className="truncate">{task.name}</span>
      </button>
      <div className="flex shrink-0 items-center gap-2">
        <ProjectChip name={projectName} fieldName={projectField} />
        <button
          type="button"
          onClick={onRemove}
          className="text-nyx-500 hover:text-tartarus-500 shrink-0"
          aria-label="Remover da sequência"
        >
          <X size={11} />
        </button>
      </div>
    </div>
  );
}

// Filled/outlined dots instead of a "(1/3)" parenthetical in the section
// title — a different shape language than Estimate's glyph bar so the two
// widgets don't read as duplicates.
function ItemProgressDots({ done, total }: { done: number; total: number }) {
  if (!total) return null;
  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${done} of ${total} done`}
    >
      <span className="inline-flex items-center gap-0.5">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={clsx(
              'h-1.5 w-1.5 rounded-full',
              i < done ? 'bg-gaia-500' : 'border-nyx-600 border'
            )}
          />
        ))}
      </span>
      <span className="text-nyx-600 font-mono text-[10px]">
        {done}/{total}
      </span>
    </span>
  );
}

// Local draft + debounced commit — lets text fields feel instant while
// typing without firing a mutation on every keystroke. Flushes immediately
// on blur so nothing is lost when the user tabs away or closes the modal.
function useDebouncedField<T>(
  value: T,
  commit: (next: T) => void,
  delay = 500
) {
  const [draft, setDraft] = useState(value);
  const draftRef = useRef(value);
  const dirtyRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!dirtyRef.current) {
      setDraft(value);
      draftRef.current = value;
    }
  }, [value]);

  function set(next: T) {
    setDraft(next);
    draftRef.current = next;
    dirtyRef.current = true;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      dirtyRef.current = false;
      commit(next);
    }, delay);
  }

  function flush() {
    clearTimeout(timerRef.current);
    if (dirtyRef.current) {
      dirtyRef.current = false;
      commit(draftRef.current);
    }
  }

  return [draft, set, flush] as const;
}

interface SeqPicker {
  kind: 'before' | 'after';
  search: string;
}

interface TaskDetailModalProps {
  taskId: Id;
  task: Task;
  onClose: () => void;
  onOpenTask: (task: Task) => void;
}

export default function TaskDetailModal({
  taskId,
  task,
  onClose,
  onOpenTask,
}: TaskDetailModalProps) {
  const { update, remove } = useTaskMutations();
  useSyncActiveEntity('task', task.id, task.name);
  const { data: sections = [] } = useSections();
  const { data: projects = [] } = useProjects();
  const { data: fields = [] } = useFields();
  const { data: items = [] } = useTaskItems(taskId);
  const itemMutations = useTaskItemMutations(taskId);
  const { data: logs = [] } = useTaskLogs(taskId);
  const { data: foregroundLog } = useForegroundTimer();
  const { data: backgroundLogs = [] } = useBackgroundTimers();
  const timer = useTimerMutations();
  const { data: allTags = [] } = useTags();
  const { data: tagLinks = [] } = useTagLinks();
  const tagMutations = useTagMutations();
  const { data: moments = [] } = useNotes({ task_id: taskId });
  const noteMutations = useNoteMutations({ task_id: taskId });

  const { data: allTasks = [] } = useTasks();
  const { data: seqEdges = [] } = useTasksSequence();
  const tasksById = useMemo(
    () => new Map(allTasks.map((t) => [t.id, t])),
    [allTasks]
  );
  const { before, after } = useTaskSequence(task.id, tasksById);
  const sequenceMutations = useSequenceMutations();
  const [seqPicker, setSeqPicker] = useState<SeqPicker | null>(null);
  const [seqError, setSeqError] = useState<string | null>(null);

  const [newItem, setNewItem] = useState('');
  const [editingItemId, setEditingItemId] = useState<Id | null>(null);
  const [editingItemDraft, setEditingItemDraft] = useState('');

  const [showDueTime, setShowDueTime] = useState(() => {
    if (!task.due) return false;
    const timePart = task.due.split('T')[1];
    return Boolean(timePart) && !timePart.startsWith('00:00:00');
  });

  const section = sections.find((s) => s.id === task.section_id);
  const currentProject = projects.find((p) => p.id === section?.project_id);
  const fieldsById = useMemo(
    () => new Map(fields.map((f) => [f.id, f])),
    [fields]
  );
  const currentFieldName = currentProject?.field_id
    ? (fieldsById.get(currentProject.field_id)?.name ?? null)
    : null;
  const isActive = foregroundLog?.task_id === task.id;
  const otherTimerRunning = foregroundLog && foregroundLog.task_id !== task.id;
  const backgroundLog = backgroundLogs.find((log) => log.task_id === task.id);

  // Resolves a linked task's project — used so Sequence chips can mention
  // which project each previous/next task belongs to.
  function projectInfoFor(t: Task) {
    const sec = sections.find((s) => s.id === t.section_id);
    const proj = projects.find((p) => p.id === sec?.project_id);
    if (!proj) return { name: null, field: null };
    const field = proj.field_id
      ? (fieldsById.get(proj.field_id)?.name ?? null)
      : null;
    return { name: proj.name, field };
  }

  const [nameDraft, setNameDraft, flushName] = useDebouncedField(
    task.name,
    (v) => patch({ name: v })
  );
  const [estimateDraft, setEstimateDraft, flushEstimate] = useDebouncedField(
    task.estimate != null ? String(task.estimate) : '',
    (v) => patch({ estimate: v ? Number(v) : null })
  );

  const taskTagLinks = useMemo(
    () => tagLinks.filter((l) => l.task_id === task.id),
    [tagLinks, task.id]
  );
  const taskTags = taskTagLinks
    .map((l) => allTags.find((t) => t.id === l.work_tag_id))
    .filter((t): t is WorkTag => Boolean(t));
  const availableTags = allTags.filter(
    (t) => !taskTags.some((tt) => tt.id === t.id)
  );

  const totalMinutes = logs.reduce(
    (sum, log) => sum + rangeDurationMinutes(log.duration),
    0
  );
  const progress = computeTaskProgress(task, logs);

  const linkedSequenceIds = useMemo(
    () =>
      new Set([task.id, ...before.map((t) => t.id), ...after.map((t) => t.id)]),
    [task.id, before, after]
  );

  const candidateTasks = seqPicker
    ? allTasks
        .filter((t) => !linkedSequenceIds.has(t.id))
        .filter((t) =>
          seqPicker.search.trim()
            ? t.name
                .toLowerCase()
                .includes(seqPicker.search.trim().toLowerCase())
            : true
        )
        .slice(0, 20)
    : [];

  const dueValues = useMemo(() => {
    if (!task.due) return { date: '', time: '' };
    const d = new Date(task.due);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return {
      date: `${year}-${month}-${day}`,
      time: `${hours}:${minutes}`,
    };
  }, [task.due]);

  function handleDueChange(
    dateStr: string,
    timeStr: string,
    forceTimeActive?: boolean
  ) {
    if (!dateStr) {
      patch({ due: null });
      return;
    }

    const [year, month, day] = dateStr.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);

    const isTimeActive =
      forceTimeActive !== undefined ? forceTimeActive : showDueTime;

    if (isTimeActive && timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      localDate.setHours(hours, minutes, 0, 0);
    } else {
      localDate.setHours(0, 0, 0, 0);
    }

    patch({ due: localDate.toISOString() });
  }

  function handleAddSequence(otherTask: Task) {
    if (!seqPicker) return;
    const previousId = seqPicker.kind === 'before' ? otherTask.id : task.id;
    const nextId = seqPicker.kind === 'before' ? task.id : otherTask.id;

    if (wouldCreateCycle(seqEdges, previousId, nextId)) {
      setSeqError('Isso criaria uma sequência circular.');
      return;
    }
    setSeqError(null);
    sequenceMutations.add.mutate({ previousId, nextId });
    setSeqPicker(null);
  }

  function patch(fields: {
    name?: string;
    section_id?: string;
    status?: Status;
    priority?: Priority;
    estimate?: number | null;
    due?: string | null;
    target?: string | null;
  }) {
    update.mutate({ id: task.id, patch: fields });
  }

  function addItem(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim()) return;
    itemMutations.create.mutate(
      {
        task_id: task.id,
        description: newItem.trim(),
        done: false,
      },
      { onSuccess: () => setNewItem('') },
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        <TextInput
          value={nameDraft}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={flushName}
          className="focus:bg-nyx-900! w-full border-0! bg-transparent! px-0! py-0! text-display! font-medium!"
        />
      }
      width="max-w-2xl"
    >
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
          {currentFieldName && (
            <span className="text-[10px] font-bold tracking-wide text-pontus-400 uppercase">
              {currentFieldName}
            </span>
          )}
          {/* generous gap so the project chevron and the › separator don't
              read as a cluttered row of arrows */}
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-nyx-300 hover:text-nyx-100 inline-flex min-w-0 items-center gap-1 text-body font-bold">
              <FieldBadge fieldName={currentFieldName} size="xs" />
              <select
                value={section?.project_id ?? ''}
                onChange={(e) => {
                  const projectId = e.target.value;
                  const firstSection = sections.find(
                    (s) => s.project_id === projectId
                  );
                  if (firstSection) patch({ section_id: firstSection.id });
                }}
                className="focus-visible:ring-eros-400 max-w-32 cursor-pointer truncate border-0 bg-transparent p-0 text-body font-bold focus:outline-none focus-visible:ring-1"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </span>
            <span className="text-nyx-600 text-caption">›</span>
            <span className="text-nyx-500 hover:text-nyx-300 inline-flex min-w-0 items-center gap-1 text-caption">
              <Layers size={10} className="shrink-0" />
              <select
                value={task.section_id ?? ''}
                onChange={(e) => patch({ section_id: e.target.value })}
                className="focus-visible:ring-eros-400 max-w-32 cursor-pointer truncate border-0 bg-transparent p-0 text-caption focus:outline-none focus-visible:ring-1"
              >
                {sections
                  .filter((s) => s.project_id === section?.project_id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </span>
          </div>
        </div>

        {/* Status | Priority — even split, each with its own eyebrow label.
            Stacks to one column below sm; stacked fields get a divider since
            they no longer share a row to separate them visually. */}
        <div className="[&>*+*]:border-nyx-700 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:items-start sm:gap-5 [&>*+*]:mt-1 [&>*+*]:border-t [&>*+*]:pt-3.5 sm:[&>*+*]:mt-0 sm:[&>*+*]:border-t-0 sm:[&>*+*]:pt-0">
          <div className="min-w-0">
            <label className="text-nyx-500 mb-1 block text-caption font-semibold tracking-wide uppercase">
              Status
            </label>
            <StatusPicker
              value={task.status}
              onChange={(status) => patch({ status })}
            />
          </div>
          <div className="min-w-0">
            <label className="text-nyx-500 mb-1 block text-caption font-semibold tracking-wide uppercase">
              Priority
            </label>
            <PriorityPicker
              value={task.priority}
              onChange={(priority) => patch({ priority })}
            />
          </div>
        </div>

        {/* Due | Estimate — 1/2 each, same stack+divider treatment as
            Status/Priority below sm */}
        <div className="[&>*+*]:border-nyx-700 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-5 [&>*+*]:mt-1 [&>*+*]:border-t [&>*+*]:pt-3.5 sm:[&>*+*]:mt-0 sm:[&>*+*]:border-t-0 sm:[&>*+*]:pt-0">
          <div className="min-w-0">
            <div className="mb-1 flex min-h-5 items-center justify-between gap-2">
              <label className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
                Due
              </label>
              {dueValues.date && (
                <TimeToggle
                  active={showDueTime}
                  onClick={() => {
                    const nextState = !showDueTime;
                    setShowDueTime(nextState);
                    if (!nextState) {
                      handleDueChange(dueValues.date, '00:00', false);
                    }
                  }}
                />
              )}
            </div>
            <div
              className={clsx(
                'inline-flex h-8.5 w-fit items-center gap-1.5 rounded-md border px-2.5 font-mono text-caption',
                isOverdue(task.due, task.status)
                  ? 'border-tartarus-500 bg-tartarus-500/10 text-tartarus-400'
                  : 'border-eros-500 bg-eros-500/10 text-eros-400'
              )}
            >
              <Flag size={14} className="shrink-0" />
              <TextInput
                type="date"
                value={dueValues.date}
                onChange={(e) => {
                  handleDueChange(e.target.value, dueValues.time);
                }}
                className="w-[10ch]! shrink-0 border-0! bg-transparent! p-0! text-center text-caption! text-inherit!"
              />
              {showDueTime && dueValues.date && (
                <>
                  <span className="opacity-50">·</span>
                  <TextInput
                    type="time"
                    value={dueValues.time || '12:00'}
                    onChange={(e) => {
                      handleDueChange(dueValues.date, e.target.value, true);
                    }}
                    className="w-14! shrink-0 border-0! bg-transparent! p-0! text-center text-caption! text-inherit!"
                  />
                </>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <label className="text-nyx-500 mb-1 block text-caption font-semibold tracking-wide uppercase">
              Estimate
            </label>
            {progress && <TaskProgressBar progress={progress} size="full" />}
            <div className="text-nyx-400 mt-1 flex items-center gap-1 font-mono text-caption">
              {minutesToHuman(totalMinutes)} logged /
              <input
                type="number"
                min="0"
                value={estimateDraft}
                onChange={(e) => setEstimateDraft(e.target.value)}
                onBlur={flushEstimate}
                className="text-nyx-100 border-nyx-600 focus:border-eros-400 w-8 border-b bg-transparent text-center outline-none"
              />
              m
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <label className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
              Target
            </label>
            {Boolean(task.target) && (
              <IconAddButton
                label="Clear target"
                icon={<X size={10} />}
                onClick={() => patch({ target: null })}
              />
            )}
          </div>
          <TargetEditor
            value={task.target as string | null}
            due={task.due}
            onChange={(v) => patch({ target: v })}
            hideClear
          />
        </div>

        {/* no top-level "Sequence" title — "Previous"/"Next" carry the
            same eyebrow style as every other field label instead */}
        <div className="border-nyx-700 border-t pt-3.5">
          <div className="space-y-3">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
                    Previous tasks
                  </span>
                  <IconAddButton
                    label="Add previous task"
                    onClick={() => {
                      setSeqError(null);
                      setSeqPicker({ kind: 'before', search: '' });
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  {before.map((t) => {
                    const proj = projectInfoFor(t);
                    return (
                      <SequenceChip
                        key={t.id}
                        task={t}
                        direction="before"
                        projectName={proj.name}
                        projectField={proj.field}
                        onOpen={onOpenTask}
                        onRemove={() =>
                          sequenceMutations.remove.mutate({
                            previousId: t.id,
                            nextId: task.id,
                          })
                        }
                      />
                    );
                  })}
                  {!before.length && (
                    <p className="text-nyx-600 text-caption">None</p>
                  )}
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
                    Next tasks
                  </span>
                  <IconAddButton
                    label="Add next task"
                    onClick={() => {
                      setSeqError(null);
                      setSeqPicker({ kind: 'after', search: '' });
                    }}
                  />
                </div>
                <div className="flex flex-col">
                  {after.map((t) => {
                    const proj = projectInfoFor(t);
                    return (
                      <SequenceChip
                        key={t.id}
                        task={t}
                        direction="after"
                        projectName={proj.name}
                        projectField={proj.field}
                        onOpen={onOpenTask}
                        onRemove={() =>
                          sequenceMutations.remove.mutate({
                            previousId: task.id,
                            nextId: t.id,
                          })
                        }
                      />
                    );
                  })}
                  {!after.length && (
                    <p className="text-nyx-600 text-caption">None</p>
                  )}
                </div>
              </div>
            </div>

            {seqPicker && (
              <div className="border-nyx-700 bg-nyx-900 rounded-md border p-2.5">
                <input
                  autoFocus
                  value={seqPicker.search}
                  onChange={(e) =>
                    setSeqPicker({ ...seqPicker, search: e.target.value })
                  }
                  placeholder="Buscar tarefa…"
                  className="border-nyx-600 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 mb-2 w-full rounded border px-2.5 py-1.5 text-caption focus:outline-hidden"
                />
                {seqError && (
                  <p className="text-tartarus-500 mb-1.5 text-caption">{seqError}</p>
                )}
                <div className="max-h-40 space-y-0.5 overflow-y-auto">
                  {candidateTasks.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => handleAddSequence(t)}
                      className="text-nyx-300 hover:bg-nyx-800 w-full truncate rounded px-2 py-1 text-left text-caption"
                    >
                      {t.name}
                    </button>
                  ))}
                  {!candidateTasks.length && (
                    <p className="text-nyx-600 px-2 py-1 text-caption">
                      Nada encontrado
                    </p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setSeqPicker(null);
                    setSeqError(null);
                  }}
                  className="text-nyx-500 hover:text-nyx-300 mt-2 text-caption"
                >
                  Fechar
                </button>
              </div>
            )}
          </div>
        </div>

        <Section title="Tags">
          <div className="flex flex-wrap gap-1.5">
            {taskTags.map((tag) => (
              <Tag
                key={tag.id}
                onRemove={() =>
                  tagMutations.detach.mutate({
                    tagId: tag.id,
                    entityRef: { task_id: task.id },
                  })
                }
              >
                {tag.name}
              </Tag>
            ))}
            {!taskTags.length && (
              <p className="text-nyx-600 text-caption">No tags yet</p>
            )}
          </div>
          {/* suggestions stay visible at all times — one click to add,
              no picker toggle to open first */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {availableTags.map((tag) => (
              <TagSuggestion
                key={tag.id}
                onClick={() =>
                  tagMutations.attach.mutate({
                    tagId: tag.id,
                    entityRef: { task_id: task.id },
                  })
                }
              >
                {tag.name}
              </TagSuggestion>
            ))}
            {!availableTags.length && (
              <p className="text-nyx-600 text-caption">
                No more tags — create one on the Tags page
              </p>
            )}
          </div>
        </Section>

        <Section
          title="Task items"
          actionPlacement="inline"
          action={
            <ItemProgressDots
              done={items.filter((i) => i.done).length}
              total={items.length}
            />
          }
        >
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                className="group hover:bg-nyx-900 flex items-center gap-2 rounded py-0.5 pr-1.5"
              >
                <input
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) =>
                    itemMutations.update.mutate({
                      id: item.id,
                      patch: { done: e.target.checked },
                    })
                  }
                  className="border-nyx-600 checked:border-gaia-500 checked:bg-gaia-500 h-3.5 w-3.5 shrink-0 appearance-none rounded-full border-[1.5px]"
                />
                {editingItemId === item.id ? (
                  <input
                    autoFocus
                    value={editingItemDraft}
                    onChange={(e) => setEditingItemDraft(e.target.value)}
                    onBlur={() => {
                      const trimmed = editingItemDraft.trim();
                      if (trimmed && trimmed !== item.description) {
                        itemMutations.update.mutate({
                          id: item.id,
                          patch: { description: trimmed },
                        });
                      }
                      setEditingItemId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') {
                        setEditingItemId(null);
                        e.currentTarget.blur();
                      }
                    }}
                    className="text-nyx-200 flex-1 bg-transparent py-0.5 text-body focus:outline-none"
                  />
                ) : (
                  <span
                    className={clsxDone(item.done)}
                    onDoubleClick={() => {
                      setEditingItemId(item.id);
                      setEditingItemDraft(item.description);
                    }}
                  >
                    {item.description}
                  </span>
                )}
                <button
                  onClick={() => itemMutations.remove.mutate(item.id)}
                  className="ml-auto opacity-0 group-hover:opacity-100"
                >
                  <X size={13} className="text-nyx-500 hover:text-tartarus-500" />
                </button>
              </div>
            ))}
          </div>
          <form onSubmit={addItem} className="mt-1.5 flex items-center gap-1.5">
            <Plus size={14} className="text-nyx-500" />
            <input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Add a task item…"
              className="text-nyx-200 placeholder:text-nyx-600 flex-1 bg-transparent py-1 text-body focus:outline-none"
            />
          </form>
        </Section>

        {/* Time logged and Moments side by side — one shared divider
            instead of each section carrying its own */}
        <div className="border-nyx-700 grid grid-cols-1 gap-4 border-t pt-3.5 sm:grid-cols-2">
          <div className="min-w-0">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-nyx-500 text-caption font-semibold tracking-wide uppercase">
                Time logged{' '}
                <span className="text-nyx-400 font-mono font-medium normal-case">
                  {minutesToHuman(totalMinutes)}
                </span>
              </h3>
              <div className="flex items-center gap-1.5">
                {isActive ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => timer.stop.mutate()}
                  >
                    <Square size={12} fill="currentColor" /> Stop
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={Boolean(otherTimerRunning)}
                    title={
                      otherTimerRunning
                        ? 'Stop the other running timer first'
                        : undefined
                    }
                    onClick={() => timer.start.mutate({ taskId: task.id })}
                  >
                    <Play size={12} fill="currentColor" /> Start
                  </Button>
                )}
                {backgroundLog ? (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => timer.stopLog.mutate(backgroundLog.id)}
                  >
                    <Square size={12} fill="currentColor" /> Stop background
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() =>
                      timer.start.mutate({ taskId: task.id, background: true })
                    }
                  >
                    <Play size={12} fill="currentColor" /> Start in background
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-1">
              {logs.slice(0, 8).map((log) => {
                const { start, end } = parseRange(log.duration);
                return (
                  <div
                    key={log.id}
                    className="text-nyx-400 flex items-center justify-between text-caption"
                  >
                    <span>
                      {start ? formatDue(start) : '—'}{' '}
                      {end ? `→ ${formatDue(end)}` : '(running)'}
                      {log.background && !end ? ' · background' : ''}
                    </span>
                    <span className="tabular font-mono text-[10px]">
                      {minutesToHuman(rangeDurationMinutes(log.duration))}
                    </span>
                  </div>
                );
              })}
              {!logs.length && (
                <p className="text-nyx-600 text-caption">No time logged yet</p>
              )}
            </div>
          </div>

          <div className="min-w-0">
            <h3 className="text-nyx-500 mb-2 text-caption font-semibold tracking-wide uppercase">
              Moments
            </h3>
            <div className="space-y-2">
              {moments.map((moment) => {
                const isChip = CHIP_MOMENT_TYPES.has(moment.moment_type);
                return (
                  <div
                    key={moment.id}
                    className="group flex items-start gap-1.5"
                  >
                    {!isChip && <MomentIcon moment={moment} />}
                    <div className="min-w-0 flex-1">
                      {isChip ? (
                        <MomentChangeChip moment={moment} />
                      ) : (
                        moment.moment_type !== 'note' && (
                          <p className="text-nyx-400 text-caption font-medium">
                            {describeMoment(moment)}
                          </p>
                        )
                      )}
                      {moment.moment_note && (
                        <p className="flex items-start gap-1 whitespace-pre-wrap">
                          {moment.authored_by !== 'user' && (
                            <Bot
                              size={12}
                              className="text-nyx-500 mt-0.5 shrink-0"
                              aria-label={`Note ${moment.authored_by === 'assistant' ? 'written by the assistant' : 'auto-generated'}`}
                            />
                          )}
                          <span>{moment.moment_note}</span>
                        </p>
                      )}
                      <p className="text-nyx-600 mt-0.5 font-mono text-[10px]">
                        {formatDue(parseMomentTime(moment.created_at))}
                      </p>
                    </div>
                    <button
                      onClick={() => noteMutations.remove.mutate(moment.id)}
                      className="opacity-0 group-hover:opacity-100"
                    >
                      <X
                        size={12}
                        className="text-nyx-500 hover:text-tartarus-500"
                      />
                    </button>
                  </div>
                );
              })}
              {!moments.length && (
                <p className="text-nyx-600 text-caption">No moments yet</p>
              )}
            </div>
          </div>
        </div>

        <div className="border-nyx-700 flex justify-end border-t pt-3.5">
          <button
            onClick={() => remove.mutate(task.id, { onSuccess: onClose })}
            className="text-nyx-500 hover:text-nyx-300 flex items-center gap-1 text-caption"
          >
            <Trash2 size={13} /> Delete
          </button>
        </div>
      </div>
    </Modal>
  );
}

function clsxDone(done: boolean): string {
  return done
    ? 'flex-1 text-caption text-nyx-600 line-through'
    : 'flex-1 text-caption text-nyx-200';
}

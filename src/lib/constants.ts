// src/lib/constants.ts
// Mirrors the Postgres enums in the database exactly.
import type { EventType, MomentType, Priority, Status } from './types';

// public.status
export const STATUSES: Status[] = [
  'planning',
  'todo',
  'in_progress',
  'in_review',
  'done',
  'paused',
  'cancelled',
  'waiting',
];

// public.priority
export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];

// public.event_types
export const EVENT_TYPES: EventType[] = ['scheduled', 'fixed', 'routine'];

// public.entity_types (used by work_tag_entities / moment_tag_entities)
export const ENTITY_TYPES = ['project', 'section', 'task'] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

// public.moment_types
export const MOMENT_TYPES: MomentType[] = [
  'created',
  'due',
  'estimate',
  'status',
  'started',
  'stopped',
  'scheduled',
  'target',
  'note',
  'priority',
];

// Each status has:
//   label     — full human name, shown as tooltip on hover
//   acronym   — 4-letter uppercase code displayed in the badge
//   icon      — lucide icon name (imported and mapped in StatusBadge)
//   iconColor — icon + acronym color
//   circleBg  — background of the icon circle
//   dot       — Tailwind class for the small sidebar dot (kept for AppShell)
interface StatusMeta {
  label: string;
  acronym: string;
  icon: string;
  iconColor: string;
  circleBg: string;
  dot: string;
}

export const STATUS_META: Record<Status, StatusMeta> = {
  planning: {
    label: 'Planning',
    acronym: 'PLAN',
    icon: 'MessageCircle',
    iconColor: '#A6612C',
    circleBg: '#2a1a0b',
    dot: 'bg-eros-600',
  },
  todo: {
    label: 'To do',
    acronym: 'TODO',
    icon: 'CircleDashed',
    iconColor: '#C0793D',
    circleBg: '#321f0d',
    dot: 'bg-eros-500',
  },
  in_progress: {
    label: 'In progress',
    acronym: 'PROG',
    icon: 'Play',
    iconColor: '#D08F4E',
    circleBg: '#3a2610',
    dot: 'bg-eros-400',
  },
  in_review: {
    label: 'In review',
    acronym: 'REVW',
    icon: 'Eye',
    iconColor: '#4D928E',
    circleBg: '#10302e',
    dot: 'bg-pontus-400',
  },
  done: {
    label: 'Done',
    acronym: 'DONE',
    icon: 'Check',
    iconColor: '#5B8C5A',
    circleBg: '#172617',
    dot: 'bg-gaia-500',
  },
  paused: {
    label: 'Paused',
    acronym: 'PAUS',
    icon: 'Pause',
    iconColor: '#7A8599',
    circleBg: '#2b3340',
    dot: 'bg-nyx-500',
  },
  cancelled: {
    label: 'Cancelled',
    acronym: 'CANC',
    icon: 'Ban',
    iconColor: '#3D4759',
    circleBg: '#1f2530',
    dot: 'bg-nyx-600',
  },
  waiting: {
    label: 'Waiting on previous',
    acronym: 'WAIT',
    icon: 'Hourglass',
    iconColor: '#9478B8',
    circleBg: '#241c31',
    dot: 'bg-hypnos-400',
  },
};

interface PriorityMeta {
  label: string;
  icon: string;
  iconColor: string;
  circleBg: string;
}

export const PRIORITY_META: Record<Priority, PriorityMeta> = {
  urgent: {
    label: 'Urgent',
    icon: 'Flame',
    iconColor: '#f97316',
    circleBg: '#3a1a04',
  },
  high: {
    label: 'High',
    icon: 'ChevronsUp',
    iconColor: '#f87171',
    circleBg: '#2C1F1F',
  },
  medium: {
    label: 'Medium',
    icon: 'ChevronUp',
    iconColor: '#60a5fa',
    circleBg: '#0a1a2a',
  },
  low: {
    label: 'Low',
    icon: 'ChevronDown',
    iconColor: '#6b7280',
    circleBg: '#1a1f1a',
  },
};

interface EventTypeMeta {
  label: string;
  text: string;
  bg: string;
  border: string;
  // Border-style carries the fixed/scheduled/routine distinction now, not a
  // per-type icon — solid means firm/immovable, dotted means not firm
  // (flexible plan or recurring), and color tells those two apart.
  borderStyle: string;
}

export const EVENT_TYPE_META: Record<EventType, EventTypeMeta> = {
  fixed: {
    label: 'Fixed',
    text: 'text-pontus-400',
    bg: 'bg-pontus-500/10',
    border: 'border-pontus-400',
    borderStyle: 'border-solid',
  },
  scheduled: {
    label: 'Plan',
    text: 'text-hypnos-400',
    bg: 'bg-hypnos-500/10',
    border: 'border-hypnos-400',
    borderStyle: 'border-dotted',
  },
  routine: {
    label: 'Routine',
    text: 'text-pontus-400',
    bg: 'bg-pontus-500/10',
    border: 'border-pontus-400',
    borderStyle: 'border-dotted',
  },
};

// Active/open statuses — excludes done, cancelled
export const OPEN_STATUSES: Status[] = [
  'planning',
  'todo',
  'in_progress',
  'in_review',
  'paused',
  'waiting',
];

export const FREQUENCY_OPTIONS = [
  { value: 'daily', label: 'Every day' },
  { value: 'every_2_days', label: 'Every 2 days' },
  { value: '2x_week', label: '2× per week' },
  { value: '3x_week', label: '3× per week' },
  { value: '4x_week', label: '4× per week' },
  { value: '5x_week', label: '5× per week' },
  { value: '1x_week', label: 'Once a week' },
  { value: '2x_month', label: 'Twice a month' },
  { value: '1x_month', label: 'Once a month' },
];

export const TIME_OPTIONS = [
  { value: 'anytime', label: 'Any time' },
  { value: 'morning', label: 'Morning (06–12)' },
  { value: 'afternoon', label: 'Afternoon (12–18)' },
  { value: 'evening', label: 'Evening (18–21)' },
  { value: 'night', label: 'Night (21–23)' },
];

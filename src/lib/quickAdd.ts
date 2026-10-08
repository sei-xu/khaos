// Lightweight, deliberately simple natural-language parsing for the quick-add
// bar. Not a full NLP engine — covers the patterns that are actually fast to
// type: "tomorrow 3pm", "next friday", "in 2 days", "#project", "!high".
// Anything it can't confidently parse is left in the task name untouched.

import type { Id, Priority, Project } from './types';

const DAY_NAMES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

const PRIORITY_ALIASES: Record<string, Priority> = {
  u: 'urgent',
  urgent: 'urgent',
  h: 'high',
  high: 'high',
  m: 'medium',
  med: 'medium',
  medium: 'medium',
  l: 'low',
  low: 'low',
};

// A due date with no explicit time means "by end of that day" everywhere
// else in the app (DueEditor, TaskDetailModal's Due field both store 23:59
// for an untimed due) -- so when the quick-add text didn't name a time,
// this stores 23:59 too instead of a 9am default that nothing else uses.
function applyTimeOfDay(date: Date, timeStr: string | undefined): Date {
  const m = timeStr?.match(/(\d{1,2})(?::(\d{2}))?\s?(am|pm)?/i);
  if (!m) {
    date.setHours(23, 59, 0, 0);
    return date;
  }
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  date.setHours(hour, minute, 0, 0);
  return date;
}

function nextWeekday(from: Date, targetDay: number): Date {
  const d = new Date(from);
  const diff = (targetDay - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d;
}

export interface ParsedQuickAdd {
  name: string;
  priority: Priority | null;
  projectId: Id | null;
  dueDate: Date | null;
}

export function parseQuickAdd(
  rawInput: string,
  projects: Project[] = []
): ParsedQuickAdd {
  let text = rawInput;
  let priority: Priority | null = null;
  let projectId: Id | null = null;
  let dueDate: Date | null = null;

  const timePattern = '(?:\\d{1,2}(?::\\d{2})?\\s?(?:am|pm)?)';

  // --- priority: !high, !urgent, !u, etc ---
  text = text.replace(/!(\w+)\b/i, (match, word) => {
    const key = word.toLowerCase();
    if (PRIORITY_ALIASES[key]) {
      priority = PRIORITY_ALIASES[key];
      return '';
    }
    return match;
  });

  // --- project tag: #projectname (matched fuzzily against loaded projects) ---
  text = text.replace(/#([\w-]+)/, (match, word) => {
    const needle = word.toLowerCase().replace(/[-_]/g, ' ');
    const found = projects.find(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        needle.includes(p.name.toLowerCase())
    );
    if (found) {
      projectId = found.id;
      return '';
    }
    return match;
  });

  // --- "in N day(s)" / "in N week(s)" ---
  let m = text.match(
    new RegExp(
      `\\bin (\\d+) (day|days|week|weeks)\\b(?:\\s+at\\s+(${timePattern}))?`,
      'i'
    )
  );
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = m[2].startsWith('week') ? 7 : 1;
    const d = new Date();
    d.setDate(d.getDate() + n * unit);
    dueDate = applyTimeOfDay(d, m[3]);
    text = text.replace(m[0], '');
  }

  // --- "next <weekday>" ---
  if (!dueDate) {
    m = text.match(
      new RegExp(
        `\\bnext (${DAY_NAMES.join('|')})\\b(?:\\s+at\\s+(${timePattern}))?`,
        'i'
      )
    );
    if (m) {
      const dayIdx = DAY_NAMES.indexOf(m[1].toLowerCase());
      const base = nextWeekday(new Date(), dayIdx);
      base.setDate(base.getDate() + 7); // "next" skips the immediate occurrence
      dueDate = applyTimeOfDay(base, m[2]);
      text = text.replace(m[0], '');
    }
  }

  // --- bare "<weekday>" (this coming week) ---
  if (!dueDate) {
    m = text.match(
      new RegExp(
        `\\b(${DAY_NAMES.join('|')})\\b(?:\\s+at\\s+(${timePattern}))?`,
        'i'
      )
    );
    if (m) {
      const dayIdx = DAY_NAMES.indexOf(m[1].toLowerCase());
      const base = nextWeekday(new Date(), dayIdx);
      dueDate = applyTimeOfDay(base, m[2]);
      text = text.replace(m[0], '');
    }
  }

  // --- "today" / "tomorrow" ---
  if (!dueDate) {
    m = text.match(
      new RegExp(`\\b(today|tomorrow)\\b(?:\\s+at\\s+(${timePattern}))?`, 'i')
    );
    if (m) {
      const d = new Date();
      if (m[1].toLowerCase() === 'tomorrow') d.setDate(d.getDate() + 1);
      dueDate = applyTimeOfDay(d, m[2]);
      text = text.replace(m[0], '');
    }
  }

  // --- trailing bare time with no day keyword implies today, e.g. "Call mom 4pm" ---
  if (!dueDate) {
    m = text.match(new RegExp(`\\bat\\s+(${timePattern})\\b`, 'i'));
    if (m) {
      dueDate = applyTimeOfDay(new Date(), m[1]);
      text = text.replace(m[0], '');
    }
  }

  const name = text.replace(/\s{2,}/g, ' ').trim();

  return { name, priority, projectId, dueDate };
}

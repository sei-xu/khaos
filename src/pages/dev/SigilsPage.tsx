import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Chamber, Section, Swatch } from './vaultUI';
import {
  StatusBadge,
  PriorityBadge,
  StatusPicker,
  PriorityPicker,
  FieldBadge,
  ProjectChip,
  DueBadge,
  TargetBadge,
  ScheduledBadge,
  TaskProgressBar,
  Tag,
  TagSuggestion,
  MomentTagChip,
} from '../../components/common/ui';
import { ChangeBadge } from '../../components/assistant/ChangeBadge';
import ProjectRow from '../../components/projects/ProjectRow';
import SectionChip from '../../components/projects/SectionChip';
import SectionRow from '../../components/projects/SectionRow';
import TaskRow from '../../components/tasks/TaskRow';
import { InlineEventPreview } from '../../components/assistant/InlineEventPreview';
import RoutineCard from '../../components/routines/RoutineCard';
import DueEditor from '../../components/common/DueEditor';
import TargetEditor from '../../components/common/TargetEditor';
import { minutesToHuman } from '../../lib/dateUtils';
import { STATUSES, PRIORITIES } from '../../lib/constants';
import { FIELDS_CONFIG, FIELD_EMOJI } from '../../lib/fieldsConfig';
import type { Status, Priority, Project, Section as SectionRecord, Task, Event, RoutineWithField } from '../../lib/types';

const SAMPLE_CHANGES = [
  { field: 'status' as const, label: 'Status', from: 'todo', to: 'in_progress' },
  { field: 'priority' as const, label: 'Priority', from: 'medium', to: 'urgent' },
  { field: 'due' as const, label: 'Due', from: null, to: '2026-07-20' },
  { field: 'estimate' as const, label: 'Estimate', from: null, to: '120' },
];

const SAMPLE_PROJECT: Project = {
  id: 'sample',
  name: 'Roadmap Q3',
  status: 'in_progress',
  priority: 'high',
  due: '2026-09-30',
  target: '["2026-07-01 00:00:00+00","2026-09-30 00:00:00+00")',
  field_id: null,
  doc_reference: null,
  deleted_at: null,
};

const SAMPLE_SECTION: SectionRecord = {
  id: 'sample',
  name: 'Design Review',
  status: 'todo',
  priority: 'medium',
  due: '2026-08-15',
  target: null,
  project_id: null,
  doc_reference: null,
  deleted_at: null,
  is_infinite: false,
};

const SAMPLE_TASK: Task = {
  id: 'sample',
  name: 'Redesign the empty states',
  status: 'in_progress',
  priority: 'high',
  due: '2026-08-10',
  estimate: 90,
  target: null,
  section_id: null,
  deleted_at: null,
};

// Every field populated at once -- not a realistic task, a stress test for
// how the row degrades at mobile widths when nothing is empty.
const SAMPLE_PROJECT_FULL: Project = {
  ...SAMPLE_PROJECT,
  id: 'sample-full',
  name: 'A genuinely long project name to stress-test wrapping',
};
const SAMPLE_SECTION_FULL: SectionRecord = {
  ...SAMPLE_SECTION,
  id: 'sample-full',
  name: 'A genuinely long section name to stress-test wrapping',
  target: '["2026-08-01 00:00:00+00","2026-08-10 00:00:00+00")',
};
const SAMPLE_TASK_FULL: Task = {
  ...SAMPLE_TASK,
  id: 'sample-full',
  name: 'A genuinely long task name to stress-test wrapping',
  target: '["2026-08-01 00:00:00+00","2026-08-10 00:00:00+00")',
};

const SAMPLE_EVENT_FIXED: Event = {
  id: 'sample-fixed',
  name: 'Design review',
  event_type: 'fixed',
  duration: '["2026-08-01 14:00:00+00","2026-08-01 15:00:00+00")',
  project_id: null,
  task_id: null,
  field_id: null,
  routine_id: null,
  recurrent: false,
  deleted_at: null,
};
const SAMPLE_EVENT_SCHEDULED: Event = {
  ...SAMPLE_EVENT_FIXED,
  id: 'sample-scheduled',
  name: 'Work on empty states',
  event_type: 'scheduled',
  duration: '["2026-08-02 09:00:00+00","2026-08-02 11:00:00+00")',
};
const SAMPLE_EVENT_ROUTINE: Event = {
  ...SAMPLE_EVENT_FIXED,
  id: 'sample-routine',
  name: 'Weekly planning',
  event_type: 'routine',
  duration: '["2026-08-03 08:00:00+00","2026-08-03 08:30:00+00")',
  recurrent: true,
};

const SAMPLE_ROUTINE: RoutineWithField = {
  id: 'sample',
  name: 'Gym',
  frequency: '3x_week',
  preferred_time: 'morning',
  estimate: 60,
  constraints: 'Can be done anytime the gym is open — no fixed slot needed.',
  active: true,
  field_id: null,
  task_id: null,
  fields: null,
};

export default function SigilsPage() {
  const [status, setStatus] = useState<Status>('in_progress');
  const [priority, setPriority] = useState<Priority>('medium');
  const [dueDraft, setDueDraft] = useState<string | null>('2026-08-01');
  const [targetSimple, setTargetSimple] = useState<string | null>(
    '["2026-08-01 00:00:00+00",)'
  );
  const [targetSimpleTime, setTargetSimpleTime] = useState<string | null>(
    '["2026-08-01 09:00:00+00",)'
  );
  const [targetRange, setTargetRange] = useState<string | null>(
    '["2026-08-01 00:00:00+00","2026-08-15 00:00:00+00")'
  );
  const [targetRangeTime, setTargetRangeTime] = useState<string | null>(
    '["2026-08-01 09:00:00+00","2026-08-15 18:00:00+00")'
  );
  const [estimateDraft, setEstimateDraft] = useState('120');
  const fieldNames = Object.keys(FIELDS_CONFIG);
  const sampleField = fieldNames[0];

  // Seeds the same react-query cache TaskRow's useSequenceCounts reads
  // from, purely so the "full row" stress-test swatch below can show a
  // populated sequence indicator too -- this docs page is the only
  // consumer, real task data is untouched.
  const queryClient = useQueryClient();
  useEffect(() => {
    queryClient.setQueryData(['tasksSequence'], [
      { task_previous: 'sample-full-before-1', task_next: 'sample-full' },
      { task_previous: 'sample-full-before-2', task_next: 'sample-full' },
      { task_previous: 'sample-full', task_next: 'sample-full-after-1' },
    ]);
  }, [queryClient]);

  return (
    <Chamber
      index="V"
      name="The Sigils"
      tagline="Status, priority, fields, dates, tags — marks that carry meaning"
    >
      <div className="mb-10">
        <h2 className="font-serif text-nyx-100 mb-3 text-2xl">
          Part I — The Entities
        </h2>
        <p className="text-nyx-400 mb-8 max-w-prose text-caption leading-relaxed">
          The real rows saved in tables (<code className="text-eros-400">
            fields
          </code>
          , <code className="text-eros-400">projects</code>,{' '}
          <code className="text-eros-400">sections</code>,{' '}
          <code className="text-eros-400">tasks</code>, and the rest), each
          with its own identity — not just a value pulled from a fixed
          vocabulary (that&rsquo;s Part II, below).
        </p>
        <p className="text-nyx-400 mb-8 max-w-prose text-caption leading-relaxed">
          <b className="text-nyx-200">Chip vs. badge, where it matters:</b> a{' '}
          <b>chip</b> stands in for a specific saved record — it has an
          identity, so it can be clicked through to that record or removed
          from where it&rsquo;s attached (<code className="text-eros-400">
            ProjectChip
          </code>
          , <code className="text-eros-400">Tag</code>). A <b>badge</b> just
          renders one field&rsquo;s current value — no identity of its own
          beyond that value, nothing to click through to (
          <code className="text-eros-400">StatusBadge</code>,{' '}
          <code className="text-eros-400">FieldBadge</code>). Field is the
          one entity styled as a badge rather than a chip — it reads as a
          tag-shaped label on other things (a project&rsquo;s field, a
          task&rsquo;s field) more often than as a thing in its own right,
          so it kept the badge shape it already had rather than being
          forced into a chip.
        </p>

        <Section title="Entities with a chip or badge">
          <Swatch label="project — chip + row">
            <ProjectChip name="Roadmap Q3" fieldName={sampleField} />
          </Swatch>
          <Swatch label="section — breadcrumb chip">
            <SectionChip
              name="Design Review"
              projectName="Roadmap Q3"
              projectField={sampleField}
            />
          </Swatch>
          <Swatch label="task — row only">
            <span className="text-nyx-500 text-caption italic">
              see Task row, below
            </span>
          </Swatch>
          <Swatch label="tag (work_tags) — chip">
            <Tag onRemove={() => {}}>design</Tag>
          </Swatch>
          <Swatch label="field — badge">
            <FieldBadge fieldName={sampleField} size="sm" />
          </Swatch>
        </Section>

        <p className="text-nyx-400 mb-3 mt-2 max-w-prose text-caption leading-relaxed">
          <b className="text-nyx-200">
            Entities that still don&rsquo;t have a defined chip or badge
          </b>{' '}
          of their own — shown elsewhere today, but not as a compact,
          reusable mark:
        </p>
        <Section title="Entities without one yet">
          <Swatch label="event">
            <span className="text-nyx-600 border-nyx-700 rounded border border-dashed px-2 py-1 text-caption italic">
              rich card in chat only (InlineEventPreview)
            </span>
          </Swatch>
          <Swatch label="task log (time entry)">
            <span className="text-nyx-600 border-nyx-700 rounded border border-dashed px-2 py-1 text-caption italic">
              folded into TaskProgressBar, no own mark
            </span>
          </Swatch>
          <Swatch label="routine">
            <span className="text-nyx-600 border-nyx-700 rounded border border-dashed px-2 py-1 text-caption italic">
              list row only (RoutinesPage)
            </span>
          </Swatch>
          <Swatch label="task item (checklist item)">
            <span className="text-nyx-600 border-nyx-700 rounded border border-dashed px-2 py-1 text-caption italic">
              checkbox + text row only
            </span>
          </Swatch>
        </Section>

        <p className="text-nyx-200 mb-4 mt-2 max-w-prose text-caption font-semibold tracking-wide uppercase">
          What each entity is, and why it looks the way it does
        </p>
        <dl className="max-w-prose space-y-4 text-caption leading-relaxed">
          <div>
            <dt className="text-nyx-200 font-semibold">Field</dt>
            <dd className="text-nyx-400 mb-3">
              The top-level life-domain a project (and by extension its
              tasks) belongs to — Design, Costura, Programação, etc. It
              carries the strongest, most saturated color signal of any
              entity (all 11, in the table below) because it&rsquo;s the
              highest grouping level in the app; every other color system
              (status, priority) is deliberately more restrained by
              comparison.
            </dd>
            <div className="flex items-center gap-2">
              <span className="text-nyx-600">e.g. a project in Design:</span>
              <ProjectChip name="Roadmap Q3" fieldName="Design" />
            </div>

            <p className="text-nyx-200 mb-2 mt-6 font-semibold tracking-wide uppercase">
              Field, everywhere it needs to render
            </p>
            <p className="text-nyx-400 mb-3 text-caption leading-relaxed">
              Same <code className="text-eros-400">FieldBadge</code> shown
              above works as the chat chip too — no new component needed,
              chat already renders real React (
              <code className="text-eros-400">EntityChip</code> does this for
              task/project/event today). <em>Not yet wired:</em>{' '}
              <code className="text-eros-400">ChatEntityType</code> only
              recognizes <code className="text-eros-400">task</code>/
              <code className="text-eros-400">project</code>/
              <code className="text-eros-400">event</code> tokens — adding{' '}
              <code className="text-eros-400">field</code> is a real follow-up,
              not done here.
            </p>
            <div className="border-nyx-700 overflow-hidden rounded-md border">
              <table className="w-full text-caption">
                <thead>
                  <tr className="border-nyx-700 border-b">
                    <th className="text-nyx-500 px-2 py-1 text-left font-semibold tracking-wide uppercase">
                      Field
                    </th>
                    <th className="text-nyx-500 px-2 py-1 text-left font-semibold tracking-wide uppercase">
                      App / chat
                    </th>
                    <th className="text-nyx-500 px-2 py-1 text-left font-semibold tracking-wide uppercase">
                      Telegram
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {fieldNames.map((name) => (
                    <tr key={name} className="border-nyx-700 border-b last:border-b-0">
                      <td className="text-nyx-500 px-2 py-1.5">{name}</td>
                      <td className="px-2 py-1.5">
                        <FieldBadge fieldName={name} size="md" />
                      </td>
                      <td className="text-nyx-300 px-2 py-1.5 font-mono">
                        {FIELD_EMOJI[name]} {name.toUpperCase()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Project</dt>
            <dd className="text-nyx-400 mb-3">
              The container tasks belong to — the level users actually
              organize around. Both marks below put the icon on the left
              and render the name bold, but never colored on its own —{' '}
              <b className="text-nyx-200">confirmed deliberate:</b> a
              project is always colored by its field, never its own
              separate color. The row also carries the field color as a
              left-edge accent, so it reads as the same entity as the
              chip at a glance even without the icon.
            </dd>
            <Section title="Project chip">
              <Swatch label="icon + name">
                <ProjectChip name="Roadmap Q3" fieldName="Design" />
              </Swatch>
            </Section>
            <Section title="Project row">
              <Swatch label="icon + status + name + priority/target/due + counts">
                <div className="w-[560px]">
                  <ProjectRow
                    project={SAMPLE_PROJECT}
                    fieldName="Design"
                    sectionCount={3}
                    taskCount={12}
                  />
                </div>
              </Swatch>
              <Swatch label="full, mobile (390px, every field populated)">
                <div className="border-nyx-700 w-[390px] rounded-md border p-2">
                  <ProjectRow
                    project={SAMPLE_PROJECT_FULL}
                    fieldName="Design"
                    sectionCount={12}
                    taskCount={148}
                  />
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Section</dt>
            <dd className="text-nyx-400 mb-3">
              A named grouping of tasks inside one project (kanban-column
              shaped). Recently redesigned with collapse/expand and
              up/down reordering. Same chip/row pair as Project, one
              level down — the chip is a breadcrumb (parent project
              first, the same{' '}
              <code className="text-eros-400">ProjectChip</code> from
              above carrying the field color, then the section&rsquo;s
              own plain name), and the row is{' '}
              <code className="text-eros-400">ProjectRow</code>&rsquo;s
              own shape with the name swapped for that same breadcrumb
              and no section/task count, since a section has nothing of
              its own to count.
            </dd>
            <Section title="Section chip">
              <Swatch label="project > name">
                <SectionChip
                  name="Design Review"
                  projectName="Roadmap Q3"
                  projectField="Design"
                />
              </Swatch>
            </Section>
            <Section title="Section row">
              <Swatch label="status + project > name + priority/target/due">
                <div className="w-[560px]">
                  <SectionRow
                    section={SAMPLE_SECTION}
                    projectName="Roadmap Q3"
                    fieldName="Design"
                  />
                </div>
              </Swatch>
              <Swatch label="full, mobile (390px, every field populated)">
                <div className="border-nyx-700 w-[390px] rounded-md border p-2">
                  <SectionRow
                    section={SAMPLE_SECTION_FULL}
                    projectName="Roadmap Q3"
                    fieldName="Design"
                  />
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Task</dt>
            <dd className="text-nyx-400 mb-3">
              The atomic unit of work — the entity everything else in
              this app ultimately organizes around. Already has a real
              row (<code className="text-eros-400">TaskRow</code>), just
              no separate small chip — see &ldquo;Compact vs. expanded
              chips&rdquo; below for why. Column order almost matches
              Project/Section&rsquo;s rows (status, name, priority,
              target, due) but not quite: <code className="text-eros-400">
                TaskRow
              </code>{' '}
              has no field badge inline — the project it belongs to
              renders as a second line (<code className="text-eros-400">
                ProjectChip
              </code>
              ) below the row instead of a leading icon on the same line.
            </dd>
            <Section title="Task row">
              <Swatch label="status + name + priority/target/due, project on its own line">
                <div className="w-[560px]">
                  <TaskRow task={SAMPLE_TASK} onOpen={() => {}} projectName="Roadmap Q3" projectField="Design" />
                </div>
              </Swatch>
              <Swatch label="full, mobile (390px, every field populated)">
                <div className="border-nyx-700 w-[390px] rounded-md border p-2">
                  <TaskRow task={SAMPLE_TASK_FULL} onOpen={() => {}} projectName="Roadmap Q3" projectField="Design" />
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Tag (work_tags)</dt>
            <dd className="text-nyx-400">
              A freeform label a task can carry, many-to-many. Every tag
              renders in the same single Pontus tone regardless of what
              the tag says — text is what differentiates them, not color.
              Reasonable inference: this avoids needing to store or
              assign a color per tag (there could be dozens), unlike
              Field&rsquo;s fixed, small, curated set. Not a pill shape
              like every other badge here — <code className="text-eros-400">rounded-sm</code>
              , a solid (&ldquo;lined&rdquo;) border, and mono type read
              closer to a hashtag label. A second, distinct tag type
              exists on moments/notes — <code className="text-eros-400">
                moment_tags
              </code>{' '}
              is a small curated vocabulary (each row has synonyms), not
              a freeform label, so it renders as{' '}
              <code className="text-eros-400">MomentTagChip</code>: same
              shape, Hypnos instead of Pontus.
            </dd>
            <Section title="Tags">
              <Swatch label="work tag">
                <Tag onRemove={() => {}}>design</Tag>
              </Swatch>
              <Swatch label="moment tag">
                <MomentTagChip onRemove={() => {}}>breakthrough</MomentTagChip>
              </Swatch>
              <Swatch label="suggestion">
                <TagSuggestion onClick={() => {}}>urgent</TagSuggestion>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Event</dt>
            <dd className="text-nyx-400">
              A calendar entry, optionally linked to a task or project.
              The least-marked entity in the app today — no compact chip,
              no expanded row, only a rich card in chat and the full
              modal — no expanded row of its own, since it&rsquo;s already
              always read alongside the calendar it lives on.
            </dd>
            <Section title="Event, in chat">
              <Swatch label="fixed">
                <div className="w-72">
                  <InlineEventPreview event={SAMPLE_EVENT_FIXED} projectName="Roadmap Q3" projectField="Design" />
                </div>
              </Swatch>
              <Swatch label="scheduled">
                <div className="w-72">
                  <InlineEventPreview
                    event={SAMPLE_EVENT_SCHEDULED}
                    taskName="Redesign the empty states"
                    projectName="Roadmap Q3"
                    projectField="Design"
                    progress={{ loggedMinutes: 90, estimateMinutes: 120, pct: 75, level: 'ok' }}
                  />
                </div>
              </Swatch>
              <Swatch label="routine">
                <div className="w-72">
                  <InlineEventPreview event={SAMPLE_EVENT_ROUTINE} projectName="Roadmap Q3" projectField="Design" />
                </div>
              </Swatch>
            </Section>
            <p className="text-nyx-400 mb-3 max-w-prose text-caption leading-relaxed">
              The calendar renders the same event with the exact same{' '}
              <code className="text-eros-400">EVENT_TYPE_META</code> lookup
              (bg/text/border/borderStyle) — same classes shown below,
              copied from <code className="text-eros-400">
                CalendarView.tsx
              </code>
              . The one deliberate difference: a <code className="text-eros-400">
                border-l-2
              </code>{' '}
              accent on the calendar block vs. <code className="text-eros-400">
                border-l-4
              </code>{' '}
              on the chat card — calendar blocks are dense, small,
              often 30 minutes tall, so a thinner accent fits; the chat
              card has room for a bolder one. Confirmed deliberate, not
              drift.
            </p>
            <Section title="Event, on the calendar">
              <Swatch label="fixed">
                <div className="border-pontus-400 bg-pontus-500/10 text-pontus-400 flex w-48 flex-col overflow-hidden rounded border-l-2 border-solid px-1.5 py-0.5 text-left text-[11px] leading-tight">
                  <span className="shrink-0 truncate font-medium">Design review</span>
                  <ProjectChip name="Roadmap Q3" fieldName="Design" className="mt-0.5 shrink-0" />
                </div>
              </Swatch>
              <Swatch label="scheduled">
                <div className="border-hypnos-400 bg-hypnos-500/10 text-hypnos-400 flex w-48 flex-col overflow-hidden rounded border-l-2 border-dotted px-1.5 py-0.5 text-left text-[11px] leading-tight">
                  <span className="shrink-0 truncate font-medium">Work on empty states</span>
                  <ProjectChip name="Roadmap Q3" fieldName="Design" className="mt-0.5 shrink-0" />
                </div>
              </Swatch>
              <Swatch label="routine">
                <div className="border-pontus-400 bg-pontus-500/10 text-pontus-400 flex w-48 flex-col overflow-hidden rounded border-l-2 border-dotted px-1.5 py-0.5 text-left text-[11px] leading-tight">
                  <span className="shrink-0 truncate font-medium">Weekly planning</span>
                  <ProjectChip name="Roadmap Q3" fieldName="Design" className="mt-0.5 shrink-0" />
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Task log (time entry)</dt>
            <dd className="text-nyx-400 mb-3">
              One logged span of time against a task. Never shown
              individually as a chip or badge — always folded into{' '}
              <code className="text-eros-400">TaskProgressBar</code>&rsquo;s
              aggregate. Reasonable inference: a single time entry isn&rsquo;t
              a meaningful unit to a user on its own, only the running
              total is. It does have one real per-entry visual, though —
              the calendar&rsquo;s logged-time rail (a thin bar next to
              each event block, plus a floating label), shown when
              &ldquo;show logged time&rdquo; is toggled on.
            </dd>
            <Section title="Task log, on the calendar">
              <Swatch label="rail + label">
                <div className="relative h-16 w-40">
                  <div className="bg-nyx-100 absolute top-2 right-1 h-10 w-1 rounded-sm" />
                  <div className="bg-nyx-900/95 text-nyx-400 absolute top-1 right-1.5 max-w-[85%] rounded px-1 py-0.5 text-right font-mono text-[9px] leading-tight">
                    <span className="text-nyx-200 block truncate">
                      Redesign empty states
                    </span>
                    9:00–10:30
                  </div>
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Routine</dt>
            <dd className="text-nyx-400 mb-3">
              A recurring task template (frequency + preferred time).
              Confirmed: no prior chip/mockup exists for it — only{' '}
              <code className="text-eros-400">RoutineCard</code>, the real
              list row from <code className="text-eros-400">
                RoutinesPage
              </code>{' '}
              (extracted into its own component so it could be demoed
              here directly, instead of a lookalike). Same reasoning as
              Section: read only in its own list today, no compact chip
              or chat mention.
            </dd>
            <Section title="Routine row">
              <Swatch label="name + frequency + time + estimate">
                <div className="w-[420px]">
                  <RoutineCard routine={SAMPLE_ROUTINE} />
                </div>
              </Swatch>
            </Section>
          </div>
          <div>
            <dt className="text-nyx-200 font-semibold">Task item (checklist item)</dt>
            <dd className="text-nyx-400">
              One row of a task&rsquo;s checklist. Confirmed: does not need
              a mark of its own — it&rsquo;s never referenced from outside
              the task that owns it, unlike every other entity here.
            </dd>
          </div>
        </dl>
      </div>

      <div className="border-nyx-700 mb-10 border-t pt-10">
        <h2 className="font-serif text-nyx-100 mb-3 text-2xl">
          Part II — The Dominions
        </h2>
        <p className="text-nyx-400 mb-8 max-w-prose text-caption leading-relaxed">
          Every deity claims dominion over one field&rsquo;s values — Eros
          rules the calls-to-act statuses, Tartarus rules urgency, Gaia
          rules what&rsquo;s finished well. Not things with their own
          identity (that&rsquo;s Part I, above) — just the current value of
          one column, pulled from a fixed vocabulary.
        </p>

        <Section title="Status" nowrap>
          {STATUSES.map((s) => (
            <Swatch key={s} label={s}>
              <StatusBadge status={s} />
            </Swatch>
          ))}
        </Section>
        <Section title="Status picker">
          <Swatch label="picker">
            <StatusPicker value={status} onChange={setStatus} />
          </Swatch>
        </Section>

        <div className="border-nyx-700 mb-10 max-w-prose border-t pt-6 text-caption leading-relaxed">
          <p className="text-nyx-200 mb-3 font-semibold tracking-wide uppercase">
            How status color reads
          </p>
          <p className="text-nyx-300 mb-3">
            Grouped by what each status asks of <em>you</em>, not by a flat
            per-status color — the dot answers &ldquo;does this need
            me?&rdquo; before the label does.
          </p>
          <p className="text-nyx-400 mb-1.5">
            <span className="text-eros-400 font-semibold">
              Calls you to act
            </span>{' '}
            — planning, todo, in progress share Eros, heat rising with
            proximity (600 → 500 → 400).
          </p>
          <p className="text-nyx-400 mb-1.5">
            <span className="text-pontus-400 font-semibold">
              Waiting, soft
            </span>{' '}
            — in review is Pontus: someone else is still moving.
          </p>
          <p className="text-nyx-400 mb-1.5">
            <span className="text-hypnos-400 font-semibold">
              Waiting, softer
            </span>{' '}
            — waiting-on-previous is Hypnos: asleep until its turn.
          </p>
          <p className="text-nyx-400 mb-1.5">
            <span className="text-nyx-300 font-semibold">Waiting, hard</span>{' '}
            — paused is Nyx 500: a stop you chose, drained of color.
          </p>
          <p className="text-nyx-400">
            <span className="text-gaia-500 font-semibold">Closed, well</span>{' '}
            — done is Gaia.{' '}
            <span className="text-nyx-600 font-semibold">Closed, dead</span>{' '}
            — cancelled is the deepest Nyx, <em>more</em> muted than paused —
            it&rsquo;s not dangerous, it&rsquo;s just gone. Tartarus/danger
            stays reserved for things still actively going wrong.
          </p>
        </div>

        <Section title="Priority" nowrap>
          {PRIORITIES.map((p) => (
            <Swatch key={p} label={p}>
              <PriorityBadge priority={p} />
            </Swatch>
          ))}
          <Swatch label="picker">
            <PriorityPicker value={priority} onChange={setPriority} />
          </Swatch>
        </Section>

        <Section title="Due" nowrap>
          <Swatch label="badge">
            <DueBadge due="2026-08-01" status="todo" />
          </Swatch>
          <Swatch label="badge, overdue">
            <DueBadge due="2026-01-01" status="todo" />
          </Swatch>
          <Swatch label="input">
            <DueEditor value={dueDraft} status="todo" onChange={setDueDraft} />
          </Swatch>
          <Swatch label="input, overdue">
            <DueEditor value="2026-01-01" status="todo" onChange={() => {}} />
          </Swatch>
        </Section>

        <Section title="Target" nowrap>
          <Swatch label="badge, simple">
            <TargetBadge target='["2026-08-01 00:00:00+00",)' />
          </Swatch>
          <Swatch label="badge, simple + time">
            <TargetBadge target='["2026-08-01 09:00:00+00",)' />
          </Swatch>
          <Swatch label="badge, range">
            <TargetBadge target='["2026-07-01 00:00:00+00","2026-07-15 00:00:00+00")' />
          </Swatch>
          <Swatch label="badge, range + time">
            <TargetBadge target='["2026-07-01 09:00:00+00","2026-07-15 18:00:00+00")' />
          </Swatch>
          <Swatch label="scheduled, upcoming">
            {/* Moved from Due -- a scheduled calendar slot is the
                target window actually being acted on, not the due
                deadline. Now shows the real time, not just an icon,
                and reads differently once the slot has passed. */}
            <ScheduledBadge scheduledAt="2026-08-20T14:00:00" />
          </Swatch>
          <Swatch label="scheduled, past">
            <ScheduledBadge scheduledAt="2026-07-20T14:00:00" />
          </Swatch>
        </Section>

        {/* Each input variant on its own line -- packed into one nowrap
            row like the badges above, they were hard to compare at a
            glance and easy to scroll past. */}
        <Section title="Target input, simple">
          <Swatch label="input, simple">
            <TargetEditor value={targetSimple} onChange={setTargetSimple} hideClear />
          </Swatch>
        </Section>
        <Section title="Target input, simple + time">
          <Swatch label="input, simple + time">
            <TargetEditor
              value={targetSimpleTime}
              onChange={setTargetSimpleTime}
              hideClear
            />
          </Swatch>
        </Section>
        <Section title="Target input, range">
          <Swatch label="input, range">
            <TargetEditor value={targetRange} onChange={setTargetRange} hideClear />
          </Swatch>
        </Section>
        <Section title="Target input, range + time">
          <Swatch label="input, range + time">
            <TargetEditor
              value={targetRangeTime}
              onChange={setTargetRangeTime}
              hideClear
            />
          </Swatch>
        </Section>
        <Section title="Target input, past target suggested">
          <Swatch label="input, past target suggested">
            {/* Same dashed-outline language as TagSuggestion -- proposes a
                quick-pick value rather than an already-set one. A past
                target reads as a stale/missed window, so it's offered as a
                one-click "catch up" suggestion rather than auto-applied. */}
            <TagSuggestion onClick={() => setTargetRange('["2026-07-10 00:00:00+00","2026-07-17 00:00:00+00")')}>
              last week
            </TagSuggestion>
          </Swatch>
        </Section>

        <Section title="Estimate" nowrap>
          <Swatch label="badge, compact">
            <TaskProgressBar
              progress={{ loggedMinutes: 90, estimateMinutes: 120, pct: 75, level: 'ok' }}
            />
          </Swatch>
          <Swatch label="badge, over">
            <TaskProgressBar
              progress={{ loggedMinutes: 150, estimateMinutes: 120, pct: 125, level: 'over' }}
            />
          </Swatch>
          <Swatch label="badge, full">
            <TaskProgressBar
              progress={{ loggedMinutes: 90, estimateMinutes: 120, pct: 75, level: 'ok' }}
              size="full"
            />
          </Swatch>
          <Swatch label="input">
            {/* Matches TaskDetailModal's estimate field exactly: logged
                total (read-only) + a bare number input for the minutes,
                no pill chrome -- the progress bar above already carries
                the visual weight, this is just the raw editable value. */}
            <div className="text-nyx-400 flex items-center gap-1 font-mono text-caption">
              {minutesToHuman(90)} logged /
              <input
                type="number"
                min="0"
                value={estimateDraft}
                onChange={(e) => setEstimateDraft(e.target.value)}
                className="text-nyx-100 border-nyx-600 focus:border-eros-400 w-8 border-b bg-transparent text-center outline-none"
              />
              m
            </div>
          </Swatch>
        </Section>

        <Section title="Change badges" nowrap>
          {SAMPLE_CHANGES.map((c) => (
            <Swatch key={c.field} label={c.field}>
              <ChangeBadge change={c} />
            </Swatch>
          ))}
        </Section>

        <p className="text-nyx-500 max-w-prose text-caption leading-relaxed">
          <b className="text-nyx-300">Not yet a mark of its own:</b> sequence
          (previous/next task dependency, currently a bespoke{' '}
          <code className="text-eros-400">SequenceChip</code> local to
          TaskDetailModal after the sequencing redesign) and moments/notes
          (an entity list, not a single value — closer to Part I&rsquo;s
          territory than a column badge).
        </p>
      </div>

      <div className="border-nyx-700 border-t pt-10">
        <h2 className="font-serif text-nyx-100 mb-3 text-2xl">
          Compact vs. expanded chips
        </h2>
        <p className="text-nyx-400 mb-3 max-w-prose text-caption leading-relaxed">
          Not every entity&rsquo;s natural mark is a small pill. Some
          already have a denser, multi-field <b>expanded</b> form that
          plays the same role a compact chip would elsewhere — the{' '}
          <b className="text-nyx-200">task row is an expanded task chip</b>:
          no atomic <code className="text-eros-400">TaskChip</code> exists
          or is obviously needed, because a task without its status/
          priority/due showing usually isn&rsquo;t useful at a glance the
          way a bare project name is.
        </p>
        <p className="text-nyx-400 max-w-prose text-caption leading-relaxed">
          Reading the rest of Part I against that lens: Section&rsquo;s
          header row and Routine&rsquo;s list row are their own expanded
          chips too, same reasoning as the task row.
        </p>
      </div>

    </Chamber>
  );
}

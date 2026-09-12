import { useState } from 'react';
import { Bug, Plus, Search, X } from 'lucide-react';
import { Chamber, Section, Swatch } from './vaultUI';
import { Button, IconButton, Select, TextInput } from '../../components/common/ui';

// The patterns below are copied verbatim from where they actually live
// (TaskDetailModal, CalendarView) -- deliberately not new shared
// components. Consolidating these into real primitives is CMP, parked
// for Round 2; this chamber shows what exists today so CMP has a real
// inventory to build from, not a guess.

export default function ForgePage() {
  const [text, setText] = useState('');
  const [checked, setChecked] = useState(true);
  const [toggled, setToggled] = useState(true);
  const [addActive, setAddActive] = useState(false);

  return (
    <Chamber
      index="IV"
      name="The Forge"
      tagline="Buttons, inputs, selects — tools built for the hand"
    >
      <Section title="Buttons">
        <Swatch label="default">
          <Button>Save</Button>
        </Swatch>
        <Swatch label="secondary">
          <Button variant="secondary">Cancel</Button>
        </Swatch>
        <Swatch label="ghost">
          <Button variant="ghost">Dismiss</Button>
        </Swatch>
        <Swatch label="danger">
          <Button variant="danger">Delete</Button>
        </Swatch>
        <Swatch label="sm">
          <Button size="sm">Small</Button>
        </Swatch>
        <Swatch label="icon button">
          <IconButton label="Close">
            <Bug size={16} />
          </IconButton>
        </Swatch>
        <Swatch label="disabled">
          <Button disabled>Save</Button>
        </Swatch>
      </Section>

      <Section title="Inputs">
        <Swatch label="text input">
          <TextInput
            placeholder="Type something…"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Swatch>
        <Swatch label="select">
          {/* Was px-2/py-1.5 here vs px-3/py-2 on TextInput -- the two
              controls rendered at different heights side by side. Fixed
              to match. */}
          <Select defaultValue="b">
            <option value="a">Option A</option>
            <option value="b">Option B</option>
          </Select>
        </Swatch>
        <Swatch label="checkbox">
          {/* From TaskDetailModal's checklist items. */}
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="border-nyx-600 bg-nyx-800 accent-eros-500 h-4 w-4 rounded"
          />
        </Swatch>
        <Swatch label="text input, disabled">
          <TextInput value="Locked" disabled />
        </Swatch>
        <Swatch label="select, disabled">
          <Select defaultValue="b" disabled>
            <option value="b">Option B</option>
          </Select>
        </Swatch>
        <Swatch label="checkbox, disabled">
          <input
            type="checkbox"
            checked
            disabled
            readOnly
            className="border-nyx-600 bg-nyx-800 accent-eros-500 h-4 w-4 rounded disabled:cursor-not-allowed disabled:opacity-50"
          />
        </Swatch>
        <Swatch label="date">
          {/* From TaskDetailModal's due-date field, un-stripped -- the
              real usage overrides border/bg/padding to sit inline in a
              pill, but the base control is still TextInput. */}
          <div className="w-40">
            <TextInput type="date" defaultValue="2026-08-01" />
          </div>
        </Swatch>
        <Swatch label="number">
          {/* From the Estimate field's minutes input. */}
          <div className="w-20">
            <TextInput type="number" min="0" defaultValue="90" />
          </div>
        </Swatch>
        <Swatch label="password">
          {/* From PasswordGate -- otherwise identical to a text input. */}
          <div className="w-40">
            <TextInput type="password" defaultValue="••••••••" />
          </div>
        </Swatch>
        <Swatch label="textarea">
          {/* From the chat composer -- same field styling as TextInput,
              resize-none. Was rounded-2xl, an outlier next to every
              other input's rounded; matched to rounded instead. */}
          <textarea
            rows={2}
            placeholder="Ask Khaos…"
            className="border-nyx-600 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 w-56 resize-none rounded border px-4 py-2 text-body leading-normal focus:outline-none"
          />
        </Swatch>
        <Swatch label="search (icon + pill)">
          {/* From QuickAddBar -- leading icon, fully rounded, no visible
              chevron/affordance since it's a free-text field, not a picker. */}
          <div className="relative w-56">
            <Search
              size={15}
              className="text-nyx-500 pointer-events-none absolute top-1/2 left-3 -translate-y-1/2"
            />
            <input
              placeholder="Quick add…"
              className="border-nyx-600 bg-nyx-800 text-nyx-100 placeholder:text-nyx-500 focus:border-eros-400 w-full rounded-full border py-2 pr-3 pl-9 text-body focus:outline-none"
            />
          </div>
        </Swatch>
      </Section>

      <Section title="Labels">
        {/* From every field label in TaskDetailModal (Due, Target, Tags,
            Previous/Next tasks, Time logged, Moments) -- all-caps,
            tracking-wide, semibold. Was font-medium/no-caps here before,
            which didn't match a single real usage. */}
        <Swatch label="field label">
          <label className="text-nyx-500 mb-1 block text-caption font-semibold tracking-wide uppercase">
            Estimate
          </label>
        </Swatch>
      </Section>

      <Section title="Divider">
        {/* Not a real component today -- border-nyx-700 on a plain div,
            repeated across TaskDetailModal/AppShell/boards/Modal/
            CommandPalette. border-t and border-b aren't interchangeable
            picks for the same job -- checked real usage: border-t always
            separates stacked sibling sections *within* scrolling content
            (TaskDetailModal's field groups, applied to the top of each
            block after the first -- first:border-0 avoids a stray line
            before the first one). border-b always underlines a *fixed
            header bar* sitting above scrollable content (AppShell's top
            bar, Modal's header, CommandPalette's search row, TaskList's
            column header) -- never used between sibling sections. */}
        <Swatch label="section divider (border-t)">
          <div className="w-56">
            <div className="border-nyx-700 border-t pt-3.5">
              <span className="text-nyx-500 text-caption">Next section…</span>
            </div>
          </div>
        </Swatch>
        <Swatch label="header divider (border-b)">
          <div className="w-56">
            <div className="border-nyx-700 border-b pb-2">
              <span className="text-nyx-300 text-body">Fixed header</span>
            </div>
          </div>
        </Swatch>
      </Section>

      <Section title="Action buttons">
        <Swatch label="add, bordered">
          {/* AddButton pattern from TaskDetailModal -- bordered pill.
              No color exception anymore: active state brightens to
              neutral Nyx instead of lighting up Eros, matching every
              other add control. */}
          <button
            type="button"
            onClick={() => setAddActive((v) => !v)}
            className={`flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-label transition-colors ${
              addActive
                ? 'border-nyx-500 text-nyx-200 bg-nyx-800'
                : 'border-nyx-700 text-nyx-500 hover:text-nyx-300'
            }`}
          >
            <Plus size={10} /> Add time
          </button>
        </Swatch>
        <Swatch label="add, inline">
          {/* From the checklist's "add item" row. */}
          <div className="flex items-center gap-1.5">
            <Plus size={14} className="text-nyx-500" />
            <span className="text-nyx-500 text-caption">Add a checklist item…</span>
          </div>
        </Swatch>
        <Swatch label="add, icon-only">
          {/* IconAddButton, from TaskDetailModal's "Add previous/next
              task" -- icon-only because the adjacent field label
              ("Previous tasks") already says what's being added, with
              no spare width for a second label. Bordered like the other
              add controls, ghost fill, same language as IconButton. */}
          <button
            type="button"
            aria-label="Add previous task"
            title="Add previous task"
            className="border-nyx-700 text-nyx-500 hover:bg-nyx-700 hover:text-nyx-100 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors"
          >
            <Plus size={10} />
          </button>
        </Swatch>
        <Swatch label="remove, icon-only">
          {/* From checklist item rows and chip removal -- bare icon,
              hover reveals danger. Hover class must live on the icon
              itself, not the button -- the icon's own color class wins
              over a parent's hover otherwise. */}
          <button type="button" aria-label="Remove">
            <X size={13} className="text-nyx-500 hover:text-tartarus-500" />
          </button>
        </Swatch>
      </Section>

      <div className="border-nyx-700 mb-10 max-w-prose border-t pt-6 text-caption leading-relaxed">
        <p className="text-nyx-200 mb-3 font-semibold tracking-wide uppercase">
          Why add/remove stay this muted
        </p>
        <p className="text-nyx-400">
          Every add control — bordered, inline, or icon-only — stays
          neutral Nyx always, no exceptions, so Eros keeps meaning one
          thing app-wide: <em>this needs you</em>. Add isn&rsquo;t a call
          to act, it&rsquo;s just always there — coloring it, even for an
          active/toggled state, would dilute the one signal Eros carries.
          Remove earns its danger hover because deleting is the one
          add/remove action with real consequence.
        </p>
      </div>

      <Section title="Toggle">
        {/* Switch (track + sliding thumb) from CalendarView's "show logged
            time"; TimeToggle in Inputs above is the other on/off pattern,
            button-shaped instead. */}
        <Swatch label="switch">
          <button
            type="button"
            onClick={() => setToggled((v) => !v)}
            className="text-nyx-300 flex items-center gap-2 text-caption"
          >
            <span
              className={`relative inline-block h-[17px] w-[30px] shrink-0 rounded-full transition-colors ${
                toggled ? 'bg-eros-500' : 'bg-nyx-700'
              }`}
            >
              <span
                className={`bg-nyx-100 absolute top-0.5 h-[13px] w-[13px] rounded-full transition-all ${
                  toggled ? 'right-0.5' : 'left-0.5'
                }`}
              />
            </span>
            Show logged time
          </button>
        </Swatch>
        <Swatch label="switch, disabled">
          <button type="button" disabled className="text-nyx-300 flex items-center gap-2 text-caption disabled:cursor-not-allowed disabled:opacity-50">
            <span className="bg-eros-500 relative inline-block h-[17px] w-[30px] shrink-0 rounded-full">
              <span className="bg-nyx-100 absolute top-0.5 right-0.5 h-[13px] w-[13px] rounded-full" />
            </span>
            Show logged time
          </button>
        </Swatch>
      </Section>

      <div className="max-w-prose text-caption leading-relaxed">
        <p className="text-nyx-200 mb-3 font-semibold tracking-wide uppercase">
          Why the toggle is Eros
        </p>
        <p className="text-nyx-400">
          Matched to the checkbox&rsquo;s own rule (<code className="text-eros-400">
            accent-eros-500
          </code>{' '}
          on check, plain otherwise): a binary control colors only its
          &ldquo;on&rdquo; state, in Eros, and stays neutral Nyx off.
          Same rule, same color, across every binary control in the app.
        </p>
      </div>
    </Chamber>
  );
}

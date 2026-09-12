// Round 1 — Foundations: live view of the design tokens declared in
// src/index.css. Everything on this page is read from the real CSS
// variables at runtime (Tailwind v4 @theme emits them on :root), so it
// cannot drift from the stylesheet.
//
// Colors moved to The Pantheon (all of them are covered there now), and
// Fonts moved to The Chorus (type-scale chamber) — this section is left
// with just radii and shadows.

// No 'sm' entry: --radius-sm was dropped as a redundant override of
// Tailwind's own identical built-in value (see index.css).
const RADIUS_TOKENS = ['', 'lg'];
const SHADOW_TOKENS = ['card', 'panel'];

function readVar(name: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

function GroupTitle({ children }: { children: string }) {
  return (
    <h2 className="text-nyx-200 font-display mb-4 text-sm tracking-wide uppercase">
      {children}
    </h2>
  );
}

interface UsageRule {
  token: string;
  swatchClass: string;
  value: string;
  rule: string;
  usedIn: string;
  deity: string;
  color: string;
}

// Practice, not theory -- each rule below reflects how the token is
// already used across the real app (checked directly, not guessed), so
// this is a description of existing convention as much as a standard
// to follow going forward. Deity colors borrowed from The Pantheon,
// same logic as The Chorus -- one color per row, ties all three
// chambers into one system instead of three separate palettes.
const RADIUS_RULES: UsageRule[] = [
  {
    token: 'rounded-sm',
    swatchClass: 'rounded-sm',
    value: "Tailwind default, 4px -- no app override",
    rule: 'Small inline accents only -- the smallest step, rarely reached for.',
    usedIn: 'the logged-time indicator bar in CalendarView',
    deity: 'Hypnos',
    color: '#9478b8',
  },
  {
    token: 'rounded',
    swatchClass: 'rounded',
    value: '--radius, 6px',
    rule: 'The default for standard interactive controls and small surfaces.',
    usedIn: 'icon buttons, checkboxes, text inputs, small badges',
    deity: 'Nyx',
    color: '#7a8599',
  },
  {
    token: 'rounded-md',
    swatchClass: 'rounded-md',
    value: "Tailwind default, 6px -- same value as rounded above",
    rule: 'Most buttons and menu items use this explicitly rather than the bare class.',
    usedIn: 'primary/secondary buttons, dropdown menu items, kanban cards',
    deity: 'Pontus',
    color: '#4d928e',
  },
  {
    token: 'rounded-lg',
    swatchClass: 'rounded-lg',
    value: '--radius-lg, 10px',
    rule: 'Larger surfaces that hold other content -- the one radius this app genuinely customized.',
    usedIn: 'modals, dropdown panels, empty states, the command palette',
    deity: 'Gaia',
    color: '#5b8c5a',
  },
  {
    token: 'rounded-full',
    swatchClass: 'rounded-full',
    value: 'Tailwind default, fully circular',
    rule: 'Anything meant to read as circular or capsule-shaped, independent of the scale above.',
    usedIn: 'avatars, status dots, pills/chips, toggle switches, the FAB',
    deity: 'Eros',
    color: '#c0793d',
  },
  {
    token: 'rounded-2xl',
    swatchClass: 'rounded-2xl',
    value: 'Tailwind default, 16px -- no app override',
    rule: 'The softest, most enclosing surfaces -- reserved for things that feel like they’re expanding to hold you, not just holding content.',
    usedIn: 'the mobile chat drawer’s top corners, TargetEditor’s small-screen layout',
    deity: 'Aether',
    color: '#e7e9e6',
  },
];

const SHADOW_RULES: UsageRule[] = [
  {
    token: 'shadow-card',
    swatchClass: 'shadow-card',
    value: '--shadow-card, low elevation',
    rule: 'Individual items sitting flat on the page that still need to feel slightly liftable.',
    usedIn: 'Kanban and Priority board cards',
    deity: 'Pontus',
    color: '#4d928e',
  },
  {
    token: 'shadow-panel',
    swatchClass: 'shadow-panel',
    value: '--shadow-panel, high elevation',
    rule: 'Stronger shadow, reserved for anything genuinely floating above other content.',
    usedIn: 'dropdown menus, the select control, the command palette, the FAB, the mobile chat drawer',
    deity: 'Hypnos',
    color: '#9478b8',
  },
  {
    token: 'border only',
    swatchClass: 'border-nyx-600 border',
    value: 'no shadow token',
    rule: "The common case. Flat content uses a border instead of a shadow -- shadows are reserved for things that genuinely float, a bordered flat surface doesn't need one.",
    usedIn: 'task lists, project cards, section columns',
    deity: 'Nyx',
    color: '#7a8599',
  },
];

function UsageTable({ title, rows }: { title: string; rows: UsageRule[] }) {
  return (
    <div className="mt-8">
      <span className="text-nyx-500 mb-3 block font-mono text-[10px] tracking-wide uppercase">
        {title}
      </span>
      <div className="border-nyx-700 flex flex-col border">
        {rows.map((r) => (
          <div
            key={r.token}
            className="border-nyx-700 flex items-center gap-5 border-t p-4 first:border-t-0"
          >
            <div
              className={`bg-nyx-700 h-14 w-14 shrink-0 ${r.swatchClass}`}
              title={r.deity}
            />
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-baseline gap-2">
                <code className="font-mono text-sm font-semibold" style={{ color: r.color }}>
                  {r.token}
                </code>
                <span className="text-nyx-600 font-mono text-[10px]">
                  {r.value}
                </span>
              </div>
              <p className="text-nyx-300 mb-1.5 text-xs leading-relaxed">
                {r.rule}
              </p>
              <p className="text-nyx-500 text-[11px]">
                <span className="text-nyx-600 font-mono text-[10px] uppercase tracking-wide">
                  Used in:
                </span>{' '}
                {r.usedIn}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FoundationsSection() {
  return (
    <section className="mb-8">
      <GroupTitle>Radii &amp; shadows</GroupTitle>
      <div className="flex flex-wrap items-end gap-6">
        {RADIUS_TOKENS.map((r) => {
          const varName = r ? `--radius-${r}` : '--radius';
          const value = readVar(varName);
          return (
            <div key={varName} className="flex flex-col items-center gap-1.5">
              <div
                className="bg-nyx-700 border-nyx-600 h-16 w-16 border"
                style={{ borderRadius: value || undefined }}
              />
              <span className="text-nyx-500 font-mono text-[10px]">
                {varName}: {value}
              </span>
            </div>
          );
        })}
        {SHADOW_TOKENS.map((s) => {
          const varName = `--shadow-${s}`;
          const value = readVar(varName);
          return (
            <div key={varName} className="flex flex-col items-center gap-1.5">
              <div
                className="bg-nyx-800 h-16 w-24"
                style={{ boxShadow: value || undefined }}
              />
              <span className="text-nyx-500 font-mono text-[10px]">
                {varName}
              </span>
            </div>
          );
        })}
      </div>

      <UsageTable title="When to use which radius" rows={RADIUS_RULES} />
      <UsageTable title="When to use which shadow" rows={SHADOW_RULES} />
    </section>
  );
}

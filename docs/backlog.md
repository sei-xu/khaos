# Backlog snapshot (2026-09-12)

This is a **one-time export** of the items still open in the
"Round 2 — Theurgy" backlog Artifact, taken on 2026-09-12 at the user's
request.

**The Artifact remains the canonical, live backlog.** Ongoing tracking —
new items, status updates, resolutions — happens there, not here. This
file will drift out of date the moment the Artifact is next updated, and
nobody is obligated to keep it in sync. If you're looking for current
status, go to the Artifact; treat this as a point-in-time archive of what
was open on the date above.

| code | title | severity | started |
|---|---|---|---|
| [TKI](#tki--task-items--couldnt-add-from-frontend) | Task items — couldn't add from frontend | 🔴 critical | 2026-08-29 |
| [CSC](#csc--cosmogony-compliance-sweep-post-merge) | Cosmogony compliance sweep (post-merge) | 🟡 standard | 2026-07-23 |
| [COL](#col--components--column-chips) | Components — column chips | 🟡 standard | 2026-07-23 |
| [BRN](#brn--the-emblem-new-chamber--reopened-icon-animation-issue) | The Emblem (new chamber + reopened icon-animation issue) | 🟡 standard | 2026-07-23 |
| [ENT](#ent--components--entity-chips) | Components — entity chips | 🟡 standard | 2026-07-23 |

---

## TKI — Task items — couldn't add from frontend

🔴 critical · started 2026-08-29

User reported: "Não consigo incluir task itens pelo frontend" — adding a
checklist item to a task silently did nothing, no visible error.

Root cause found: `public.task_items.order` is a smallint backed by a
single table-wide `IDENTITY` sequence (`task_items_order_seq`) plus a
table-wide `UNIQUE` constraint (`task_items_order_key`) — enforcing
uniqueness of `order` across *all* tasks combined, not per task. This
already broke once before (migration `20260812000000`): the sequence
fell behind `max(order)`, so every insert collided with a `409 duplicate
key` error. That fix only did a one-time resync, so it was structurally
guaranteed to recur.

On the frontend, `useTaskItemMutations` (`src/hooks/useHierarchy.ts`)
wires `onError` to a bare `console.error` — no toast, no alert — which is
why the failure was invisible to the user.

~~Fix pushed: migration `20260829000000_fix_task_items_order_scope.sql`
drops the global unique constraint and replaces it with a per-task
`(task_id, order)` constraint, then resyncs the sequence. Opened as draft
PR [#66](https://github.com/sei-xu/khaos/pull/66) on branch
`claude/task-items-frontend-inclusion-kqu4tm`.~~ (done)

**Still open:**
- The frontend's silent-error pattern (no toast/alert anywhere in the
  app) is a separate, broader issue — not fixed here, flagged for a
  future pass.
- Applying the migration to the live Supabase instance (this PR only adds
  the migration file).
- Confirming from the real frontend that adding items works again.

---

## CSC — Cosmogony compliance sweep (post-merge)

🟡 standard · started 2026-07-23

Part of "make sure all Cosmogony standards are applied" (Cosmogony =
the app's deity-named design-token system: nyx/eros/pontus/gaia/
tartarus/hypnos, renamed from an earlier ink/copper/teal/sage/rust/
violet naming).

~~Mechanical rename sweep (ink→nyx, copper→eros, teal→pontus, sage→gaia,
rust→tartarus, violet→hypnos) on files main's merge brought in
pre-rename. Pushed as `9c091a7`.~~ (done)

~~Also applied as an ongoing practice, not a one-off: every commit this
round was grepped for rename residue before pushing, and several later
CSC passes caught real drift — Wellspring was missing `rounded-2xl` from
its radius table, and the Emblem page had two swatches that had drifted
from the real values after later changes. Both fixed, pushed as
`69b5005` / `1fb9d24`.~~ (done)

~~**Branch finally merged into main, 2026-09-11.** This whole round
(`claude/modest-faraday-h0dynj`, 49 commits) had been sitting unmerged on
a stale local branch since early August — found while auditing local
branches for lost work. Merged into `main` as `3f4c385`. Three real
conflicts, all resolved by hand: `public/favicon.svg` (add/add — kept
main's later, higher-quality vector polygon over this branch's
placeholder text-glyph version), `ui.tsx`'s `TargetBadge` (kept main's
`past`-prop version; the branch's "single-day arrow" bug was already
fixed independently on main's side), and `TaskRow.tsx` (main had already
moved to consume `ScheduledBadge`'s new `scheduledAt` prop — introduced
by this very branch's `ENT`/`COL` work — without the matching hook-call
update; merged both sides' changes so the declaration matches the
usage). One post-merge typecheck failure fixed: `SigilsPage.tsx`'s
sample `SectionRecord` object was missing `is_infinite`, added to the
schema after this branch was forked. Typecheck and build both verified
clean after resolution.~~ (done)

**Note: the merge only lands the code in main's history.** It does not
resolve the still-open decisions tracked separately in [ENT](#ent--components--entity-chips)
(chip height normalization, the mobile name-truncation stress test) or
[BRN](#brn--the-emblem-new-chamber--reopened-icon-animation-issue) (Emblem chamber awaiting final sign-off, the reopened
icon-animation item) — those stay open on their own.

---

## COL — Components — column chips

🟡 standard · started 2026-07-23

Split off from the original `CMP` scoping — the **columns** track, as
opposed to [ENT](#ent--components--entity-chips)'s entities. Columns are the badges pulled from a
task/project/section's own column values (status, priority, due, target,
tags, etc.), as distinct from entity identity chips (project, task,
event...).

### Done this round

- Audited and documented on the Sigils dev page, as its Part II ("The
  Dominions") — every column/field badge shown together (status,
  priority, fields, due, target, estimate/progress, tags, change
  badges), including the new `ScheduledBadge` from the sequencing
  redesign.
- **Colors decided:** toggle switch Pontus → Gaia, then later corrected
  to match the checkbox exactly (Eros on, no color off) after the user
  stayed unsure about Gaia. Icon-only add (`IconAddButton`):
  `bg-hypnos-400` → neutral Nyx, matching every other add control's
  default.
- `IconButton` vs. `IconAddButton` visual-language gap unified — both now
  ghost/transparent with hover fill.
- Chat composer textarea's radius (`rounded-2xl`, an outlier) matched to
  every other input's `rounded`.
- Status pill radius unified to `rounded-full`; the two `StatusPicker`
  rows connected edge-to-edge; `PriorityPicker`'s urgent bounce now only
  plays when urgent is actually selected; `Tag` given the dashed-border
  language `TagSuggestion` already used.
- `Tag` split into its own "Tags" section (was miscategorized with
  `ChangeBadge` swatches). `StatusBadge` spacing tightened.
- All Part II column sections made single unbroken rows (horizontal
  scroll instead of wrap). `DueBadge`'s overdue pulse now animates only
  the date text, not the flag icon.
- New `DueEditor` component extracted from `TaskDetailModal`'s inline Due
  pill, plus four live `TargetEditor` demo instances covering all real
  states.

### Still open

- No shared `Chip` primitive built yet (see [ENT](#ent--components--entity-chips) for the full
  explanation and API proposal — this is shared work between the two
  tracks).
- Today's badges (`StatusBadge`, `PriorityBadge`, `FieldBadge`,
  `DueBadge`, `TargetBadge`, `ChangeBadge`) still each hand-roll their
  own styling; whether columns share ENT's proposed primitive shape is
  unconfirmed.

---

## BRN — The Emblem (new chamber + reopened icon-animation issue)

🟡 standard · started 2026-07-23

### New chamber — The Emblem

User scoped `BRN` as app icon, app logo, and `KhaoticText`, and asked
where it belongs in the design-system "Vortex." Considered folding it
into Pantheon (color-adjacent) vs. a new chamber; built as a new chamber
since it's a genuinely different concern (brand identity, not tokens or
data).

Built as chamber **VII, "The Emblem"** (`/dev/vortex/emblem`), sourced
from the real components: `KhaosIcon` (default/spinning/corner-placard/
hero/favicon variants), `KhaosLogo`/`KhaosTitle` (the wordmark), and
`KhaoticText` (serif/display/multi-family+shimmer). Kept last in the
Theurgy ordering (Forge → Sigils → Threshold → Emblem) since the earlier
chambers build in functional complexity and don't depend on brand chrome
existing first. Wired into the nav, chamber index, and routes.

**Done this round:**
- Fixed the icon spinning off-center (was rotating around the glyph's
  own asymmetric font-metrics box, not a true-square container).
- Fixed the password-gate hero not spinning at all (referenced a CSS
  class that never existed).
- Added a real 3s `--animate-spin-slow` token (was relying on nothing /
  Tailwind's fast 1s default).
- Wordmark now always randomizes across all font families, not just on
  the home hero.
- Replaced the "✷" text glyph with lucide's real `Asterisk` SVG icon —
  a font glyph's own metrics box is never guaranteed symmetric around
  its visual shape, so no amount of container/span squaring fixed the
  off-center spin; an SVG path drawn around a fixed viewBox center gave
  it an actual geometric center to rotate around.
- Chat panel renamed to match the real Telegram bot, `@KhaosFacitBot`
  (user declined invented names like "Khaos"/"Pythia"/"Hermes").
- `public/favicon.svg` added — it (and the whole `public/` directory)
  didn't exist, a real pre-existing 404.
- User approved the spin speed and the chamber's placement (VII, last in
  Theurgy) specifically.

**Still open:** whole-chamber content awaiting a final sign-off.

### Reopened — icon animation

Approved and moved to Resolved once, then reopened: the icon was still
visibly orbiting, not just rotating slightly off-center as first
assumed.

Root cause: the wrapping `<span>` had no explicit size, so its box was
set by the font-size class's own line-height (taller than the icon) — a
non-square box, and rotating a non-square box drifts its content in a
circle. Fixed via a dedicated pixel-sized container
(`style={{ width, height }}`) instead of depending on font metrics at
all.

User eventually gave up chasing the exact rotation bug on the Vortex nav
icon specifically: "i give up on this icon on the vortex nav... just
remove the spinning and make it ping" → then corrected to "sorry, i
meant pulse, not ping." Changed to Tailwind's `animate-pulse`.

Icon still read visually misaligned against the "khaos vortex" title
text next to it (the glyph's own ink sits slightly high in its box even
when geometrically centered) — nudged 1px down via `relative top-px`.

**Still open:** waiting on user reconfirmation before moving back to
Resolved — approved once already, reopened once already.

---

## ENT — Components — entity chips

🟡 standard · started 2026-07-23

Split off from the original `CMP` scoping — the user called for two
separate tracks: entities vs. columns. This one is **entities** (chips
that carry identity — project, task, event, etc. — as opposed to
[COL](#col--components--column-chips)'s column-value badges).

### Audit and dictionary

Documented on the Sigils dev page as Part I ("The Entities") — every
entity type listed against whether it has a chip/badge today (project/
tag have one, field is a badge by design, task/section/event/task log/
routine/task item originally didn't), plus a written chip-vs-badge
distinction. All 11 real project fields now render (was a 6-field
slice), recolored as one hue circle anchored on Staging Academy's fixed
brand blue, WCAG-AA-checked. A "what each entity is, and why it looks
this way" dictionary was added.

Field colors were later desaturated (S 100%/L 61% → S 55%/L 58%) —
fields were the one fully-saturated system in the app next to the
deity accent palette (which sits around S 50-60%). Staging Academy is
the one field left unchanged (fixed brand-color anchor, not tunable —
also the one field still under AA at 4.13:1, unchanged from before).

### Real components built this round

- **`ProjectRow`** (`src/components/projects/ProjectRow.tsx`) — the
  row-form sibling to `ProjectCard`'s grid tile: status + name +
  priority/target/due + section/task count.
- **`SectionRow`** (`src/components/projects/SectionRow.tsx`) — same
  shape as ProjectRow, name swapped for a project›section breadcrumb.
- **`SectionChip`** revised to lead with the project (carries field
  color) then the section's own plain name.
- **`RoutineCard`** extracted to `src/components/routines/RoutineCard.tsx`
  so `RoutinesPage` and the docs page share one real component.
- Field emoji set approved for all 11 fields, stored as `FIELD_EMOJI` in
  `fieldsConfig.ts`.
- Second tag type built: `MomentTagChip` (Hypnos, `~` prefix) alongside
  the existing `Tag` (Pontus, `#` prefix, redesigned off the pill
  language entirely — `rounded-sm`, solid border, `font-mono`).
- 375px name-truncation bug fixed: `ProjectRow`/`SectionRow` rebuilt with
  the same `md:flex-row`/`flex-col` breakpoint `TaskRow` already used.
- Project/Section row height matched exactly to `TaskRow` (missing
  `border-y border-transparent`, root-caused a 2px mismatch).
- Right border added to Project/Section rows (reversing an earlier
  "skip it" call, per direct user request); spacing normalized to the
  project's real SPC ladder (hairline/tight/snug/element/group/block/
  shell).
- Due/Target input polish: `DueEditor` and `TargetEditor` both bumped to
  the app's default input size/icon size, native calendar/clock icons
  hidden, overdue color tied to the same `isOverdue` check the pill's
  border/background already used.
- **Real bug fixed:** `TargetBadge` was rendering the "→" arrow
  unconditionally, even for a single-day target with no end date.
- **Real bug fixed:** Due/Target badges never showed time-of-day even
  when the underlying value carried one — added `hasExplicitTime`
  check + `formatTimeOnly` output.

### Still open — decisions waiting on the user

1. **Chip height normalization.** Every chip/badge's rendered height was
   audited — they range from 11px (`FieldBadge` xs) to 26px (`FieldBadge`
   md), no two matching (`ScheduledBadge` 12 / `ProjectChip` 16 /
   `DueBadge` 16 / `StatusBadge` sm 18 / `TargetBadge` 19 / `Tag` 20 /
   `PriorityBadge` sm 24 / `FieldBadge` sm 24). Proposed normalizing
   one-line row chips to ~20px, but this ripples into TaskRow,
   ProjectCard, TaskDetailModal everywhere — paused for a go-ahead
   rather than done blind.

2. **Shared `Chip` primitive.** A concrete API was proposed (three
   shapes — `plain`/`pill`/`circle` — plus `tone`/`size`/`icon`/
   `onRemove`/`pulse` props) that would fold the height-normalization
   question in for free. User pushed back usefully: entities and
   columns have real structural variety not yet proven to fit one
   shape, so building the primitive now risks the API bending around
   whatever gets designed next. **Agreed: wait** — sketch the 2-3
   hardest remaining cases against this API on paper first, confirm it
   survives contact with them, only then build for real.

3. **`TaskRow`'s missing field badge.** `Project`/`SectionRow` both lead
   with a field badge; `TaskRow` doesn't (the project a task belongs to
   instead renders as a second line, `ProjectChip`, below the row).
   Whether this is worth fixing to bring TaskRow in step with the other
   two rows is unresolved.

4. **Chat/Telegram render contexts** for entities other than Field are
   still ahead — a proposal table for this was in progress in chat, not
   yet finalized or built.

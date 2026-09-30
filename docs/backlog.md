# Backlog — Round 2 · Theurgy

This file is the **canonical, live backlog** for the Khaos app. It follows the
Ḫprj methodology (`hprj/docs/methodology.md`, phases 6–7): the backlog is a
versioned file in the repo, and every change that opens, updates or resolves
an item edits it **in the same PR as the code** — never as a separate step
afterwards. Nothing lives only in chat, and nothing lives in a published
Artifact any more (the old "Round 2 — Theurgy backlog" and "Round 1 —
Foundations backlog" Artifacts are frozen; this file and
[`backlog-round-1.md`](./backlog-round-1.md) replaced them on 2026-09-30).

Round 1 (Cosmogony — the token layer: Pantheon / Chorus / Wellspring) is
closed and archived in [`backlog-round-1.md`](./backlog-round-1.md). This
round is the gods' working of those tokens into real components — the
Theurgy chambers (Forge / Sigils / Threshold / Emblem) and the consolidation
work that grows out of them. Roadmap phases live in
[`05-roadmap.md`](./05-roadmap.md).

## Conventions

- Items are identified by their **title** (no codes, no severity markers —
  dropped on 2026-09-30). The user refers to an item by name, or by a
  distinctive part of it.
- **Start date** when opened; **end date** once resolved. History is kept —
  resolved items move to the Resolved table, never deleted.
- An item is resolved when the user says **"approved"** for it.
- A new item starts with **`NEW`** from the user, **or proactively** whenever
  real work stays pending past the turn it came up (a decision, a review, a
  file to upload).
- A finished slice of a still-open item is written as ~~strikethrough~~
  inside the item; the item stays Open until it is approved as a whole.
- A treated item moves to the **bottom** of its table and its section order
  (most recently touched last).
- Write real detail in each item's status — enough to tell what happened
  without re-reading the chat — in short paragraphs, not one dense block.
  Anything substantive said in chat (a decision, a recommendation, next
  steps) is recorded in the item the same turn.

## Open

| title | started |
|---|---|
| [Task items — couldn't add from frontend](#task-items--couldnt-add-from-frontend) | 2026-08-29 |
| [Cosmogony compliance sweep (post-merge)](#cosmogony-compliance-sweep-post-merge) | 2026-07-23 |
| [Components — column chips](#components--column-chips) | 2026-07-23 |
| [The Emblem (new chamber + reopened icon-animation issue)](#the-emblem-new-chamber--reopened-icon-animation-issue) | 2026-07-23 |
| [Components — entity chips](#components--entity-chips) | 2026-07-23 |
| [PWA app icon — Chrome no macOS](#pwa-app-icon--chrome-no-macos) | 2026-09-30 |
| [`npm run lint` fails on main](#npm-run-lint-fails-on-main) | 2026-09-30 |
| [No changelog — rebuild it from the git history](#no-changelog--rebuild-it-from-the-git-history) | 2026-09-30 |

---

## Task items — couldn't add from frontend

started 2026-08-29

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

## Cosmogony compliance sweep (post-merge)

started 2026-07-23

Part of "make sure all Cosmogony standards are applied" (Cosmogony =
the app's deity-named design-token system: nyx/eros/pontus/gaia/
tartarus/hypnos, renamed from an earlier ink/copper/teal/sage/rust/
violet naming).

~~Mechanical rename sweep (ink→nyx, copper→eros, teal→pontus, sage→gaia,
rust→tartarus, violet→hypnos) on files main's merge brought in
pre-rename. Pushed as `9c091a7`.~~ (done)

~~Also applied as an ongoing practice, not a one-off: every commit this
round was grepped for rename residue before pushing, and several later
compliance passes caught real drift — Wellspring was missing `rounded-2xl` from
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
by this very branch's entity/column chip work — without the matching hook-call
update; merged both sides' changes so the declaration matches the
usage). One post-merge typecheck failure fixed: `SigilsPage.tsx`'s
sample `SectionRecord` object was missing `is_infinite`, added to the
schema after this branch was forked. Typecheck and build both verified
clean after resolution.~~ (done)

**Note: the merge only lands the code in main's history.** It does not
resolve the still-open decisions tracked separately in [Components — entity chips](#components--entity-chips)
(chip height normalization, the mobile name-truncation stress test) or
[The Emblem (new chamber + reopened icon-animation issue)](#the-emblem-new-chamber--reopened-icon-animation-issue) (Emblem chamber awaiting final sign-off, the reopened
icon-animation item) — those stay open on their own.

---

## Components — column chips

started 2026-07-23

Split off from the original component-consolidation scoping — the **columns** track, as
opposed to [Components — entity chips](#components--entity-chips)'s entities. Columns are the badges pulled from a
task/project/section's own column values (status, priority, due, target,
tags, etc.), as distinct from entity identity chips (project, task,
event...).

### Done this round

- ~~Audited and documented on the Sigils dev page, as its Part II ("The
  Dominions") — every column/field badge shown together (status,
  priority, fields, due, target, estimate/progress, tags, change
  badges), including the new `ScheduledBadge` from the sequencing
  redesign. Closing note flags Sequence (previous/next task) and
  Moments/notes as still unmarked. Pushed as `9c091a7`.~~
- ~~**Colors decided:** toggle switch Pontus → Gaia, then later corrected
  to match the checkbox exactly (Eros on, no color off) after the user
  stayed unsure about Gaia (a switch is a user-controlled state, not a
  status value, so it stays out of the status palette; the checkbox's
  existing `accent-eros-500` on-check-only coloring is the precedent).
  Icon-only add (`IconAddButton`): `bg-hypnos-400` → neutral Nyx,
  matching every other add control's default. Pushed as `ab22eb5` /
  `974dc8d`.~~
- ~~`IconButton` vs. `IconAddButton` visual-language gap unified — both now
  ghost/transparent with hover fill (smaller h-4/w-4 footprint kept for
  dense rows). Add/remove buttons made uniformly muted with zero color
  exceptions, inline checklist add text shrunk a step (`text-body` →
  `text-caption`), icon-only add given a border, section/swatch labels
  renamed to a consistent "add/remove, <variant>" pattern. Pushed as
  `7bc22a7` / `974dc8d`.~~
- ~~Chat composer textarea's radius (`rounded-2xl`, an outlier) matched to
  every other input's `rounded`; Wellspring's radius table updated.
  Pushed as `7bc22a7`.~~
- ~~Status pill radius unified to `rounded-full`; the two `StatusPicker`
  rows connected edge-to-edge with an inline border instead of an
  overflowing ring; `PriorityPicker`'s urgent bounce only plays when
  urgent is selected; `Tag` given the dashed-border language
  `TagSuggestion` already used. Pushed as `e33a295`.~~
- ~~`Tag` split into its own "Tags" section (was miscategorized with
  `ChangeBadge` swatches). `StatusBadge` spacing tightened. Pushed as
  `0267181`.~~
- ~~All Part II column sections made single unbroken rows (new `nowrap`
  prop on the shared `Section`, horizontal scroll instead of wrap).
  `DueBadge`'s overdue pulse now animates only the date text, not the
  flag icon. Pushed as `d7c21ce`.~~
- ~~New `DueEditor` component (`src/components/common/DueEditor.tsx`),
  extracted from `TaskDetailModal`'s inline Due pill, plus four live
  `TargetEditor` demos covering all real states and a "past target,
  suggested" swatch. Pushed as `d7c21ce`.~~

### Still open

- No shared `Chip` primitive built yet (see [Components — entity chips](#components--entity-chips) for the full
  explanation and API proposal — this is shared work between the two
  tracks).
- Today's badges (`StatusBadge`, `PriorityBadge`, `FieldBadge`,
  `DueBadge`, `TargetBadge`, `ChangeBadge`) still each hand-roll their
  own styling; whether columns share the entity-chips item's proposed primitive shape is
  unconfirmed.

---

## The Emblem (new chamber + reopened icon-animation issue)

started 2026-07-23

### New chamber — The Emblem

User scoped this item as app icon, app logo, and `KhaoticText`, and asked
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
existing first — the user agreed ("agreed. proceed." covered the ordering
question, not a sign-off on the chamber's content). Wired into the nav,
chamber index, and routes. Pushed as `9c091a7`.

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
  its visual shape. Spin and pulse kept on separate elements so they
  don't collide on the Vortex hero icon. Pushed as `4cae01c`.
- Chat panel renamed to match the real Telegram bot, `@KhaosFacitBot`
  (user declined invented names like "Khaos"/"Pythia"/"Hermes").
- `public/favicon.svg` added — it (and the whole `public/` directory)
  didn't exist, a real pre-existing 404. Pushed as `5d5f0f6`.
- Password wordmark bumped to `text-4xl` (off the Chorus scale, same
  precedent as the Vortex hero's own title size).
- User approved the spin speed and the chamber's placement (VII, last in
  Theurgy) specifically. Sidebar spin condition confirmed as
  `isAssistantProcessing || isFetching > 0 || isMutating > 0` (any
  app-wide activity, not chat-only) — **user's call: keep as-is.**

**Still open:** whole-chamber content awaiting a final sign-off.

### Reopened — icon animation

Approved and moved to Resolved once, then reopened: the icon was still
visibly orbiting, not just rotating slightly off-center as first
assumed. Verified with real timelapse screenshots rather than trusting
the earlier fix.

Root cause: the wrapping `<span>` had no explicit size, so its box was
set by the font-size class's own line-height (taller than the icon) — a
non-square box, and rotating a non-square box drifts its content in a
circle. First patch forced the span to exactly 1em × 1em (verified by a
second timelapse); then rebuilt with a dedicated pixel-sized container
(`style={{ width, height }}`) instead of depending on font metrics at
all (verified by a third).

User eventually gave up chasing the exact rotation bug on the Vortex nav
icon specifically: "i give up on this icon on the vortex nav... just
remove the spinning and make it ping" → then corrected to "sorry, i
meant pulse, not ping." Changed to Tailwind's `animate-pulse` (`4dccf92`,
`af797da`).

Icon still read visually misaligned against the "khaos vortex" title
text (the glyph's own ink sits slightly high in its box even when
geometrically centered) — nudged 1px down via `relative top-px`
(`4980690`).

**Still open:** waiting on user reconfirmation before moving back to
Resolved — approved once already, reopened once already.

---

## Components — entity chips

started 2026-07-23

Split off from the original component-consolidation scoping — the user called for two
separate tracks: entities vs. columns. This one is **entities** (chips
that carry identity — project, task, event, etc. — as opposed to
[Components — column chips](#components--column-chips)'s column-value badges).

### Audit and dictionary

Documented on the Sigils dev page as Part I ("The Entities") — every
entity type listed against whether it has a chip/badge today, plus a
written chip-vs-badge distinction (identity + navigable/removable vs. a
plain field value) and a "what each entity is, and why it looks this
way" dictionary, ordered project › section › task with Field first. A
"compact vs. expanded chips" framing covers the row forms (the task row
is really an expanded task chip, not a gap needing a new atomic one).
Pushed as `9c091a7`, `0f276f8`, `c9d46e6`.

Entity outcomes confirmed with the user:
- **Event** already had a chat card (`InlineEventPreview` +
  `EntityChip`); all three `event_type` variants demoed live (solid
  Pontus border fixed, dotted Hypnos scheduled, dotted Pontus routine).
  Calendar blocks use the same `EVENT_TYPE_META` as the chat card; the
  one real difference (`border-l-2` calendar vs. `border-l-4` chat) stays
  — the calendar's blocks are dense enough for a thinner accent. Not a
  gap; an event only needs reading alongside its calendar.
- **Task item** doesn't need a badge/chip/row — confirmed as fact.
- **Task log** has no chip; its one real per-entry mark (the calendar's
  logged-time rail) is demoed.
- **Routine**: the real list row (`RoutineCard`) was extracted from
  `RoutinesPage` to `src/components/routines/RoutineCard.tsx` so Sigils
  demos the actual component. `FREQUENCY_OPTIONS`/`TIME_OPTIONS` moved to
  `constants.ts`. Pushed as `5dc3816`.

### Fields

- ~~All 11 real fields render (was a 6-field slice; `Textos` was missing),
  recolored as one hue circle anchored on Staging Academy's fixed brand
  blue, WCAG-AA-checked against nyx-900. Pushed as `0f276f8`.~~
- ~~Field emoji set approved (🧑 Pessoal, 🎓 Pesquisa, 📄 Textos,
  🖌️ Caligrafia, ✨ Artes, 📦 Design, ✂️ Costura, 🏫 Staging Academy,
  🎧 Som, 🖼️ Imagem, 💻 Programação), stored as `FIELD_EMOJI` in
  `fieldsConfig.ts`; the Sigils site/Telegram comparison covers all 11.
  Pushed as `3cf8772`.~~
- ~~Field chip weight/size settled after two corrections: `font-bold` and
  one Chorus step smaller (`text-label`), applied to `FieldBadge`'s "md"
  variant itself — a real global change. Redundant standalone 11-field
  grid removed. Pushed as `3cf8772` / `c0b5788`.~~
- ~~Field colors desaturated (S 100%/L 61% → S 55%/L 58%) — fields were
  the one fully-saturated system next to the deity accents (S 50–60%).
  Re-checked AA: Pessoal and Som lightened further. **Staging Academy
  left unchanged** (fixed brand anchor) — the one field still under AA
  (4.13:1). Pushed as `3fef2b4`.~~
- Telegram text convention proposed (emoji + caps, e.g. "🎨 DESIGN"), not
  wired into the telegram functions; `field` isn't wired into
  `ChatEntityType` yet — real follow-ups, not done.

### Rows and chips built

- ~~**`ProjectRow`** (`src/components/projects/ProjectRow.tsx`) — the
  row-form sibling to `ProjectCard`'s grid tile: status + name +
  priority/target/due + section/task count. Chip = icon + name
  (`ProjectChip`, final); row = one-line, TaskRow-shaped. Pushed as
  `c0b5788`.~~
- ~~**`SectionRow`** (`src/components/projects/SectionRow.tsx`) — same
  shape, name swapped for the project›section breadcrumb, no counts.
  `SectionChip` revised to lead with the project (carries field color)
  then the section's plain name. Pushed as `5cdea51` / `85f5a9c`.~~
- ~~375px name-truncation bug fixed: `ProjectRow`/`SectionRow` rebuilt with
  the same `md:flex-row`/`flex-col` breakpoint `TaskRow` uses (verified at
  a real 390px viewport — `md:` is a viewport query, so the embedded
  stress-test div was misleading). Mobile stress-test swatches moved into
  each entity's own row section. Pushed as `1d7dd0c` / `69ae4fd`.~~
- ~~Row height matched exactly to `TaskRow` (38px): the 2px mismatch was
  `TaskRow`'s full `border border-transparent` vs. Project/SectionRow's
  `border-l-2` only — added `border-y border-transparent`. Right border
  added (neutral `border-nyx-700`, field-color left spine still winning
  on its edge), reversing an earlier "skip it" call at the user's direct
  request.~~
- ~~Project name bold wherever it renders as a reference (`ProjectChip`,
  `ProjectRow`, `SectionRow` breadcrumb) — color unchanged. Project name
  *input* in `ProjectDetailPage.tsx` given `font-normal` (it had inherited
  the display font's heavy default). Pushed as `ee76dfb` / `0012676` /
  `af1a976`.~~
- ~~Spacing normalized to the spacing ladder: `pl-2.5` → `px-2` in
  Project/SectionRow; all internal gaps unified to `gap-1.5`. Pushed as
  `4ae606e` / `2fe4b11`.~~
- ~~`InlineEventPreview` progress bar demoed on the scheduled variant; the
  card's text "event" label swapped for the `CalendarClock` icon
  `ScheduledBadge` already uses. Pushed as `130a3fa`.~~
- ~~**Tags redesigned off the pill language** ("too many pills already"):
  `Tag` is `rounded-sm`, solid border, `font-mono`, `#` prefix;
  `TagSuggestion` keeps a dotted border as the one deliberate difference.
  Second tag type built: **`MomentTagChip`** (Hypnos, `~` prefix) for
  `moment_tags` (a curated vocabulary with synonyms — previously had a
  data model and no UI), distinct from freeform `work_tags`. Tags section
  relocated from Part II to Part I under the Tag entry. Pushed as
  `904d200`.~~
- ~~`StatusPicker` polish (padding/gap, connected rows, corner-only
  rounding down to `rounded-*-sm`), split into its own section. Real
  clipping bug fixed generically on the shared `Section` (`px-1 py-1` on
  the nowrap row) — the selected item's ring was cut off. `StatusBadge`
  icon-label gap `gap-px`. `PriorityBadge` confirmed consistently sized
  at all 8 call sites. Pushed as `5d5b6a7` / `a38ea77` / `b9263e1`.~~
- ~~Due/Target inputs: native calendar/clock icons hidden (plain CSS on a
  `.due-input` class — the Tailwind arbitrary variant silently produced
  no CSS); date/time both `text-body`, icon 15px, `h-8.5`, widths
  `w-[11ch]`/`w-13`; overdue color tied to `isOverdue`; `TargetEditor`
  laid out like `DueEditor`; "+end" restyled as the standard bordered add
  pill; a pre-existing `react-hooks/set-state-in-effect` lint failure in
  `TargetEditor` fixed. Pushed as `4c959c8` / `9e06bad` / `c9949d0` /
  `dcd8ce7` / `424415b` / `94d39d3`.~~
- ~~**Real bugs fixed:** `TargetBadge` rendered "→" even for a single-day
  target with no end; Due/Target badges never showed time-of-day even
  when the value carried one (added `hasExplicitTime` + `formatTimeOnly`).~~
- ~~Sigils Part II restructured into per-column groups — **Due**,
  **Target**, **Estimate** — each reading badge-then-input. Pushed as
  `0345950`.~~

### Still open — decisions waiting on the user

1. **Chip height normalization.** Every chip/badge's rendered height was
   audited — they range from 11px (`FieldBadge` xs) to 26px (`FieldBadge`
   md), no two matching (`ScheduledBadge` 12 / `ProjectChip` 16 /
   `DueBadge` 16 / `StatusBadge` sm 18 / `TargetBadge` 19 / `Tag` 20 /
   `PriorityBadge` sm 24 / `FieldBadge` sm 24). Proposed normalizing
   one-line row chips to ~20px, but this ripples into TaskRow,
   ProjectCard, TaskDetailModal everywhere — paused for a go-ahead
   rather than done blind.

2. **Shared `Chip` primitive.** Today `StatusBadge`/`PriorityBadge`/
   `FieldBadge`/`DueBadge`/`TargetBadge`/`ScheduledBadge`/`Tag`/
   `ProjectChip`/`ChangeBadge` are each a fully separate component with
   no shared box underneath — exactly why their heights don't match, so
   building the primitive and fixing heights are the same piece of work.
   A concrete API was proposed (three shapes — `plain`/`pill`/`circle` —
   plus `tone`/`size`/`icon`/`onRemove`/`pulse`; one fixed height per
   `size` across shapes; open call: `tone` must accept both the deity
   palette and Field's 11 arbitrary hex values). User pushed back
   usefully: entities and columns have real structural variety not yet
   proven to fit one shape, so building it now risks the API bending
   around whatever gets designed next. **Agreed: wait** — sketch the 2–3
   hardest remaining cases against this API on paper first (without
   touching `ui.tsx`), confirm it survives, only then build.

3. **`TaskRow`'s missing field badge.** `Project`/`SectionRow` both lead
   with a field badge; `TaskRow` doesn't (the project a task belongs to
   renders as a second line, `ProjectChip`, below the row). Whether this
   is worth fixing to bring TaskRow in step is unresolved.

4. **Chat/Telegram render contexts** for entities other than Field are
   still ahead — a proposal table was in progress in chat, not yet
   finalized or built.

---

## PWA app icon — Chrome no macOS

started 2026-09-30

User reported that the app icon doesn't appear when Khaos is turned into an app
from Chrome on macOS — `~/Applications/Chrome Apps.localized/Khaos.app` showed
Chrome's grey "K" monogram fallback instead of the copper star.

**Root cause: environment, not code.** The app for the `Default` profile had
been installed *before* the manifest existed, so Chrome committed the monogram
as the app's icon. The later manifest update then sat in Chrome's `Pending`
stage, which is only promoted once every window of the app is closed.

~~Reported symptom — fixed on 2026-09-30 by closing the app and reinstalling.~~
Confirmed by direct measurement, not inference: the shim was rewritten at
04:13, `app.icns` now carries a 512 slot with alpha and the copper star inside
Apple's squircle (art measured at 80.5% of the canvas), and both `Pending
Manifest Icons/` and `Pending Trusted Icons/` are gone from the profile. The
stale app under `Profile 6` is gone too.

**What the investigation established** (branch
`hprj/investigation_planning/7db812a4…`; full forensics in `.hprj/handoff.json`):

- On macOS the app icon comes from the **maskable** manifest entry.
  `Trusted Icons/Icons/` exists but is empty — only the maskable set was
  promoted. Degrading that entry would change the app icon.
- One maskable size is enough: Chrome downsamples the seven sizes in
  `Trusted Icons/Icons Maskable/` from the single declared 512.
- The art must stay **square and full-bleed**. Chrome applies the squircle
  itself, so pre-rounding it would produce a double corner.
- An earlier claim that the art violated the maskable safe zone was a false
  premise — it was read off `favicon.svg`, which is not the art in the PNGs —
  and is retracted. Measured: the star's outer radius is 128 px on a 512
  canvas, well inside the 204.8 px safe zone.
- Production serving is fine. The manifest and every icon return 200 with the
  right content types, and `vercel.json`'s catch-all rewrite doesn't swallow
  statics. Nothing to change there.

**Still open — the hardening, now scoped to C and D (see the decision below).**
The real (non-blocking) defect is the inverse of the original diagnosis: the
same `icon-512.png` serves both `any` and `maskable` at 50% fill, so on the
surfaces that consume `any` unmasked the star renders too small.

- **A** (out this round) — split `any` from `maskable`: a new `icon-maskable-512.png` keeps today's art,
  while `icon-192`/`icon-512` and a new `icon-1024` get the star rescaled to
  ~80%; write them all with an alpha channel.
- **B** (out) — generate the icons with a dependency-free Node rasteriser
  (`scripts/gen-icons.mjs`) — not `sharp`, and not by rasterising the SVG. The
  art is a 16-vertex polygon whose geometry is fully determined (outer radius
  13, inner 5, points every 45°), a native dependency is disproportionate here,
  and `sharp`'s output varies across versions, which would defeat the
  idempotency check. `favicon.svg` becomes generated from the same vertex table
  so the SVG and the PNGs can't drift apart again.
- **C —** add `id` and `scope` to `site.webmanifest`. Their absence is the identity
  fragility that produced this incident in the first place.
- **D —** a short README section on the install-time icon cycle: an app icon is
  committed when the app is installed, and a manifest change alone never
  updates an app that already exists.
- Caveat to flag before shipping: the new anti-aliasing changes the maskable's
  bytes even at an identical scale, so the deploy needs one more
  close-every-window cycle before Chrome promotes the icon. Expect it — it
  isn't a regression.
- Verification is typecheck + lint + build + manual checks (no test suite, per
  this repo's convention), plus a bounding-box measurement of each PNG against
  the `#161b22` background. That measurement is precisely what would have
  caught the false safe-zone premise. Note that `npm run lint` does not cover
  `.mjs` files, and extending it would break `--max-warnings 0`.

**Decision, 2026-09-30: do C and D only.** Investigation and planning are
closed on that scope; implementation is the next phase.

- **C and D are in.** `id`/`scope` is a two-line change, and `"id": "/"` is
  identity-neutral — the default id already resolves to `start_url`, so it
  describes existing behaviour rather than changing it, which is also why it
  won't trigger another icon cycle. The README note is the highest return per
  effort here: the whole incident reduces to "app icons are committed at
  install time".
- **A is out this round.** The browser tab is already served by `favicon.svg`
  at ~81%, so the only genuinely visible symptom of the 50% fill is
  `apple-touch-icon.png` on an iPhone home screen, and no Android or Windows
  surface is in play. Worth revisiting only if the iOS home screen starts
  mattering.
- **B is out.** Its beneficiary is future debugging, not the app: the SVG/PNG
  drift never broke anything a user sees — it made an earlier investigation
  assert something false. Hand-writing a PNG encoder and rasteriser to
  regenerate five images that change almost never is a maintenance liability
  for a solo project. If A is ever done, generating the PNGs once and
  committing them is enough.

Because A and B are out, nothing about the icon files changes, so the
close-every-window caveat above does not apply to this round, and the
verification narrows to: typecheck, lint, build, the manifest parsing with
both new fields, and — the one that matters — confirming after deploy that the
installed app is still the *same* app (no second `Khaos.app`, same profile
directory `ojedpaiddfgkpgbnmlmlmagnkjbdekfk`, star icon intact). If a duplicate
app appears or the monogram returns, `"id"` wasn't neutral and C gets reverted.

**Implemented on 2026-09-30 — C and D are done; the item stays open pending
approval.**

- ~~**C** — `"id": "/"` and `"scope": "/"` added to `public/site.webmanifest`.~~
  Verified that the change adds exactly those two keys and alters nothing else:
  the three icon entries are byte-identical to the previous revision, which is
  what this scope required.
- ~~**D** — `## PWA e ícones` section added to `README.md`~~, between
  "Estrutura de arquivos" and "Documentação": the production URL, the four
  non-obvious facts (icon committed at install time; update held in `Pending`
  until every window closes; on macOS the maskable entry governs the app icon;
  maskable art stays square because Chrome applies the squircle), and the
  macOS icon-cache commands as a last resort.

The whole diff is two files and +30 lines. Verification: `npm run typecheck`
clean, `npm run build` clean (`dist/site.webmanifest` carries both new fields,
icons unchanged), manifest parses with `id` and `scope` present.
**`npm run lint` fails, but not because of this change** — all 16 problems are
in `src/` files this branch never touches, and neither `.webmanifest` nor `.md`
is matched by eslint's `--ext`. Tracked separately under
[`npm run lint` fails on main](#npm-run-lint-fails-on-main).

~~**Post-deploy identity check — done 2026-09-30, and clean.**~~ Production serves the manifest with
`id=/` and `scope=/` and the same three icon entries, and the identity risk did
not materialise: still a single `Khaos.app` under
`~/Applications/Chrome Apps.localized/` with its mtime unchanged from before the
deploy (so Chrome never rewrote the shim), the profile directory still
`ojedpaiddfgkpgbnmlmlmagnkjbdekfk`, and no `Pending` directories for this app.
`"id": "/"` was neutral, as expected. The user confirmed the same from their
side.

What remains before this can be approved is only the wider check: that the icon
still looks right in the Dock, Launchpad, Spotlight and Cmd+Tab.

Roadmap check: `05-roadmap.md` lists the PWA under "Concluído" and puts a
native mobile app explicitly out of scope. This only hardens the existing PWA,
so it contradicts no registered phase.

---

## `npm run lint` fails on main

started 2026-09-30

Found while verifying the PWA manifest change, which touches no TypeScript at
all. `npm run lint` exits 1 with **16 problems (11 errors, 5 warnings)**, none
of them from that change. This contradicts `CLAUDE.md`, which documents the
lint gate as "zero warnings tolerated, not just zero errors".

Three groups:

- **9 × `@typescript-eslint/no-explicit-any`**, all in `src/lib/chat/toolsCore.ts`
  (lines 91, 532–592).
- **2 × `react-hooks/set-state-in-effect`** — `AppShell.tsx:302` (closing the
  drawer on route change) and `CommandPalette.tsx:49` (clearing the query when
  the palette opens). Both look like a newer version of the React hooks plugin
  flagging code that was already there, rather than newly written mistakes.
- **5 warnings** — one unused `strokeWidth` arg in `StagingAcademyIcon.tsx`,
  four `react-refresh/only-export-components` in context modules.

Not fixed here: out of scope for the PWA work, and the `any` cluster in
`toolsCore.ts` in particular deserves its own pass rather than a drive-by.
Worth deciding whether these get fixed or whether the rule set gets adjusted —
right now the documented gate and the actual state disagree, which makes the
lint step useless as a signal.

Gotcha noticed in passing: `eslint .` descends into `.claude/worktrees/`, so
while a worktree is checked out there the problem counts come back exactly
doubled (32 instead of 16). Worth an ignore entry if worktrees are used often.

---

## No changelog — rebuild it from the git history

started 2026-09-30

Debt found while applying the Ḫprj methodology to every managed repo: it now
requires each app to produce a changelog entry per merged version, written in
the same PR as the change (`hprj/docs/methodology.md`, "Documentação viva
obrigatória por app"). Khaos has a roadmap (`docs/05-roadmap.md`), this
backlog and a version in `package.json` (`1.0.30` at the time of writing) —
but **no changelog at all**, so it is out of conformity until one exists.

**Decision (user, 2026-09-30):** record it as debt now, and rebuild the
changelog from the history later, not in the same change.

The rebuild looks feasible from the history alone: 31 commits touched
`version` in `package.json` (`chore: release v1.0.1` … `v1.0.30`), out of
~430 commits since 2026-06-22. Plan when picked up:
- Create `docs/history/CHANGELOG.md` (same location the other managed apps
  use — Etto and Ḫprj), one entry per released version, newest first, with
  date, what changed and why, taken from the release commits and the PRs
  between them.
- Versions that predate consistent bumping, or PRs merged without a
  `chore: release` commit, get a one-line summary instead of an invented
  version.
- From then on, every PR that bumps the version adds its entry in the same
  PR. Add that rule to the "Feature backlog tracking" section of `CLAUDE.md`
  when the file is created.

Not started; no code change involved.

---

## Resolved

| title | started | resolved |
|---|---|---|
| [Forge — second critique round](#forge--second-critique-round) | 2026-07-23 | 2026-07-23 |
| [Forge — missing inputs, divider, chevron](#forge--missing-inputs-divider-chevron) | 2026-07-23 | 2026-07-23 |
| [The Emblem — icon/logo/wordmark polish](#the-emblem--iconlogowordmark-polish) | 2026-07-23 | 2026-07-23 |
| [Daily review — stale in-review prioritization](#daily-review--stale-in-review-prioritization) | 2026-08-06 | 2026-08-07 |
| [Sequence rail — sometimes not visible](#sequence-rail--sometimes-not-visible) | 2026-08-12 | 2026-08-14 |
| [Unify target pill + input view](#unify-target-pill--input-view) | 2026-09-19 | 2026-09-19 |

Round 1 (the token layer) is archived separately in
[`backlog-round-1.md`](./backlog-round-1.md).

### Forge — second critique round

2026-07-23 → 2026-07-23 · approved by the user

Field label swatch fixed to match real usage (uppercase / tracking-wide /
semibold). Corrected the wrong "no icon-only add" claim — `IconAddButton`
is genuinely icon-only, swatch added, reasoning rewritten. Corrected the
wrong "only one toggle" claim — `TimeToggle` is also a toggle, just
button-shaped; the claim was narrowed to the switch pattern. Documented
the real `border-t` (sibling-section separator) vs. `border-b`
(fixed-header underline) distinction. `Select` chevron gap reduced
(`pr-8`/`right-3` → `pr-7`/`right-2.5`) after reading as too big live.
Pushed as `a55999e`.

Caught sitting stale in the backlog for several rounds after being fixed
in code — the user asked why it looked frozen. Only the tracking was out
of date; a duplicate leftover row was cleaned up in the same pass.

### Forge — missing inputs, divider, chevron

2026-07-23 → 2026-07-23 · approved by the user

Added swatches for input types Forge didn't show yet (textarea,
date/datetime, number, password, search-with-icon), sourced from where
they actually live (TaskDetailModal, ChatPanel, QuickAddBar,
PasswordGate). Added a Divider section documenting the `border-nyx-700` +
`border-t`/`border-b` idiom used across the app with no dedicated
component. Fixed `Select`'s chevron — the native arrow sat flush against
the border; replaced with `appearance-none` + a real `ChevronDown`.
Pushed as `5911119`.

Same stale-tracking bug as the second critique round: "FRG FRG2 approved"
covered both rounds but only the second was moved. The textarea radius fix flagged in the same
round was confirmed still live in `ForgePage.tsx`.

### The Emblem — icon/logo/wordmark polish

2026-07-23 → 2026-07-23 · approved by the user

Chamber VII built (icon, logo/wordmark, KhaoticText), wired into nav, kept
last in Theurgy per user agreement (`9c091a7`). Follow-up rounds:
`favicon.svg` added (was entirely missing, a real 404); wordmark always
multi-family; password gate rebuilt around the real `KhaosIcon` (was a
hand-rolled duplicate that silently never spun — it referenced a CSS
class that didn't exist); spin speed given a real 3s token; chat renamed
`@KhaosFacitBot`; password wordmark bumped three times chasing "bigger"
(`text-2xl` → `text-4xl` → `text-6xl`) with the icon alongside
(`h-16`/`text-6xl` → `h-20`/`text-7xl`); "Ordo ab chao" moved between the
wordmark and the password field.

**Off-center spin — two real bugs.** First the glyph itself: a font
character's baseline box isn't its visual ink center. A lucide SVG swap
fixed centering but changed the shape, which the user correctly rejected
(same glyph everywhere, always); reverted to "✷" drawn via SVG `<text>`
with `textAnchor="middle"` + `dominantBaseline="central"`. Then the user
caught it genuinely orbiting: timelapse screenshots showed the wrapping
span had no explicit size, so a non-square box rotated around its own
center. Forced to exactly 1em × 1em and re-verified — no drift. Pushed as
`567e3e7`. (This item was later reopened — see *The Emblem* in Open.)

A compliance sweep checked site-wide before approval: zero rename residue in `src/`,
Emblem swatches re-verified against real usage.

### Daily review — stale in-review prioritization

2026-08-06 → 2026-08-07

Tasks sitting in `in_review` too long are now pulled to the front of the
**morning digest** (`telegram-notify`'s `runDigest`/`DIGEST_INSTRUCTION`)
— not the web `TaskList` sort UI, per the user's clarification. The
user's answers: (1) it's the existing morning digest message, (2) no
fixed threshold — 3 days picked as a default, (3) staleness read from the
`moments` table.

Implemented as a prompt instruction, not new code (the digest is
LLM-composed from live queries and the agent already has `query_rows`
access to `moments`): each `in_review` task's most recent `status` moment
with `value = 'in_review'` gives the entry time (`created_at`); anything
3+ days stale is listed first, ahead of overdue/due/scheduled, most stale
first. Pushed as `add0de3`.

### Sequence rail — sometimes not visible

2026-08-12 → 2026-08-14 · approved by the user · PR `sei-xu/khaos#59`, merged

User reported the git-graph-style sequence rail on task lists sometimes
doesn't show up. A research agent traced the render chain
(`SectionColumn.tsx` → `sequenceGraph.ts`'s `buildSequenceRail` →
`SequenceRail.tsx`) and found six conditions under which it renders
nothing.

- **Real bug, fixed:** infinite sections fade out done/cancelled tasks,
  but their `tasks_sequence` edges kept pointing at the hidden id, so
  `buildSequenceRail` silently dropped both edges around it and broke the
  whole chain (A → B → C lost the line once B faded). Added
  `collapseHiddenEdges` to reroute A → C before layout (`e489149`).
- **UX ambiguity, fixed per the user's spec:** an empty section and a
  still-loading section both rendered as identical nothing. Empty stays
  empty; loading gets a marching-dash placeholder
  (`.sequence-rail-loading`, respects `prefers-reduced-motion`); a query
  error gets a small × marker. New `SequenceRailLoading`/
  `SequenceRailError`, wired via `useTasksSequence()` (`f77bb65`).
- **Left as design calls, not bugs:** a collapsed section hides the rail
  (expected); a task with no in/out edge draws no node inside an
  otherwise-visible chain (cosmetic); an edge whose target falls outside
  the visible order is silently dropped, but that reads as defensive dead
  code given upstream ordering.
- **Fork/merge readability:** `LANE_WIDTH` 10 → 14px and `BEND_H` 14 → 16px
  so branches separate visibly, plus a `title` tooltip stating the branch
  count (`43f59f2`). Two "wrong curve" reports were traced: one to the
  user's own data (a task with two real successors — no code bug,
  confirmed by simulating `buildSequenceRail` standalone and by the
  user's DevTools inspection), the other to the real cause below.
- **Root cause, real bug:** `SequenceRail.tsx`'s `LANE_COLORS` still
  referenced the **pre-rename palette** (`teal`/`copper`/`violet`/`sage`/
  `rust`), so any lane using the 2nd–5th color rendered with no color at
  all — invisible. Very likely also the original "às vezes não aparece"
  report. Remapped to the real tokens; the same bug in the new
  `SequenceRailError` (`text-rust-500` → `text-tartarus-500`) was fixed
  too (`9231657`).
- **Polish:** lane spacing back to 11px (`97e6e3c`); hollow first/last
  nodes on the loading placeholder (`3d06f83`); error marker once per
  section, not per row, since it's one shared query (`6d219fe`).

### Unify target pill + input view

2026-09-19 → 2026-09-19 · PRs `sei-xu/khaos#69` and `#70`, merged

Three rounds on the target/due date fields.

- **Round 1** (`#69`, squash `849e372`): `TargetBadge`/`TargetEditor`
  unified into one module (`TargetEditor.tsx`); shared `hasExplicitTime`/
  `isAllDayRange` helpers in `range.ts`; the read-only pill collapses to
  just the start date for an all-day single-day target.
- **Round 2** (`#70`): past targets now read tartarus-red outside the
  Dashboard — `TargetBadge` computes its own "past" state by default
  (`targetEnd()` vs. now) and the "→" follows that color. The Target icon
  in `TargetEditor` became a button that opens the start date's native
  `showPicker()` (needed `forwardRef` on the shared `TextInput`).
- **Round 3** (`#70`): the same convention extended to **Due** — an
  untimed due date now stores at 23:59 (was midnight, which read as
  "start of day" rather than "by end of day") and a due at exactly 23:59
  shows no time. The due input was duplicated in `DueEditor.tsx` and an
  un-migrated inline copy in `TaskDetailModal.tsx` — both fixed.
  `DueBadge` got its own `hasExplicitDueTime` (not-23:59), kept separate
  from `hasExplicitTime` (not-midnight) since that helper is shared with
  `ScheduledBadge`, whose midnight convention is unrelated.

Near-miss caught mid-round: a separate branch off `main` for the due fix
would have silently dropped the round-2 commit because `#70` hadn't merged
yet; caught before pushing and the commit went onto the `#70` branch.
Typecheck, eslint and build clean on every round. `#70` merged (squash)
as `bb298f7`.

**Not verified in the running app** for any of the three rounds (the
sandbox had no live Supabase data). Worth a quick look once deployed: an
overdue target row reads tartarus-red including the arrow; clicking the
target icon pops the date picker; an untimed due date shows no time badge
and behaves as end-of-day wherever it's compared against "now".

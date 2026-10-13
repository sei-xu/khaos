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
| [No changelog — rebuild it from the git history](#no-changelog--rebuild-it-from-the-git-history) | 2026-09-30 |
| [Assistente morre com `isError: Extra inputs are not permitted`](#assistente-morre-com-iserror-extra-inputs-are-not-permitted) | 2026-10-02 |
| [Remover envio de versão de deploy por Telegram](#remover-envio-de-versão-de-deploy-por-telegram) | 2026-10-07 |
| [Target editor — pickers, largura, clamp, 23:59 fantasma, seções infinitas](#target-editor--pickers-largura-clamp-2359-fantasma-seções-infinitas) | 2026-10-07 |
| [Quick add — dialog atualizado e tarefa aberta após criar](#quick-add--dialog-atualizado-e-tarefa-aberta-após-criar) | 2026-10-07 |
| [Backlog ordenado de tarefas (ordem do Today)](#backlog-ordenado-de-tarefas-ordem-do-today) | 2026-10-08 |
| [Nine unmerged branches — triage before cleanup](#nine-unmerged-branches--triage-before-cleanup) | 2026-09-30 |
| [Daily review — stale in-review prioritization](#daily-review--stale-in-review-prioritization) | 2026-08-06 |
| [`npm run lint` fails on main](#npm-run-lint-fails-on-main) | 2026-09-30 |
| [Integração bidirecional com o Google Calendar (somente eventos fixed)](#integração-bidirecional-com-o-google-calendar-somente-eventos-fixed) | 2026-10-12 |
| [Assistente sugere projeto, seção e estimativa ao criar tarefa](#assistente-sugere-projeto-seção-e-estimativa-ao-criar-tarefa) | 2026-10-13 |

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

## Assistente morre com `isError: Extra inputs are not permitted`

started 2026-10-02

O usuário reportou o erro vindo da API da Anthropic:
`messages.3.isError: Extra inputs are not permitted` (`invalid_request_error`,
request_id `req_011CfZHLGmuot7WEFCgcnrgd`). A conversa do assistente para de
funcionar e **não volta sozinha**: o erro é sticky.

**Causa-raiz.** `ChatMessage` é `Anthropic.MessageParam & { isError?: boolean }`
(`src/lib/chat/agent.ts:40`). O comentário logo acima diz que `isError` é
"UI-only", mas nada o remove na saída: quando uma chamada falha, `runTurn`
empurra `{ role: 'assistant', content: '…', isError: true }` dentro do próprio
`currentMessages` (`agent.ts:94-101`), e esse mesmo array é devolvido como
`updatedHistory`, vai para o estado do React **e** é persistido por
`saveHistory` (`src/hooks/useChatAgent.ts:66-67`). No turno seguinte esse
histórico é passado cru para `client.messages.create({ messages })` — a API
rejeita campos desconhecidos no objeto de mensagem, e o índice 3 do erro é
exatamente a mensagem envenenada. `useChatAgent.ts:71-78` tem o mesmo defeito
no catch externo (só no estado, mas o estado alimenta o próximo `runTurn`).

**Raio de alcance.** O histórico é uma linha única compartilhada
(`chat_history`, id `khaos`) e `supabase/functions/_shared/khaos.ts` tipa
`ChatMessage` como `Anthropic.MessageParam` puro, sem sanitizar na leitura —
então a linha envenenada pelo web quebra também o `telegram-bot` e o
`telegram-notify` (digest da manhã), com o mesmo 400. Enquanto a linha não for
limpa, nenhuma superfície responde.

**Plano (Fases 2-3, 2026-10-02).** Criar `src/lib/chat/historyCore.ts` no
padrão `*Core.ts` já usado no repo (sem imports de runtime, consumível pelo
Deno via `import_map.json`) com um `toWireMessages()` que devolve apenas
`{ role, content }`; aplicá-lo na borda da API em `agent.ts`, na gravação e na
leitura de `src/lib/chat/history.ts`, e na leitura/envio de
`_shared/khaos.ts`. Sanear na leitura é o que cura a linha já envenenada hoje.
Verificação: `npm run typecheck` + `npm run build` + repro manual (forçar a
falha e mandar uma segunda mensagem) — sem suíte de testes, e `npm run lint`
segue quebrado no main (item próprio).

~~Detalhe completo em `.hprj/handoff.json` do branch
`hprj/investigation_planning/cc410cdb-05b3-4d18-96b7-fd62c5ebe780`. Nada de
código foi escrito ainda.~~

**Implementado (2026-10-02).** `src/lib/chat/historyCore.ts` novo, sem
imports de runtime (só `import type Anthropic`), no padrão `*Core.ts` —
exporta `toWireMessages()` (allowlist `{ role, content }`, não blocklist de
`isError`: fecha a porta para o próximo campo de UI também, não só o de
hoje) e `sanitizeStoredHistory()` (mesmo mapeamento + descarte de entradas
sem `role`/`content`, para o caso de um valor de banco malformado).
Aplicado nos três pontos em que o histórico cruza uma fronteira:
`agent.ts` (`client.messages.create`), `history.ts` (`saveHistory` e
`loadHistory`) e `_shared/khaos.ts` (chamada à API e `loadHistory`, para o
Telegram se defender de uma linha que o web ainda não tenha saneado). O
tipo `ChatMessage` e o `isError` da UI (`ChatPanel.tsx`, bolha vermelha)
ficaram intactos — só o que atravessa a borda é saneado.

Decisão explícita: as mensagens de erro continuam indo para o modelo (só o
campo `isError` é removido), não são descartadas do histórico enviado —
descartar mudaria o comportamento conversacional (o modelo deixaria de
"ver" que uma chamada anterior falhou), o que é escolha de produto, fora do
escopo deste bug.

Verificação: `npm run typecheck` limpo, `npm run build` passa (aviso de
chunk >500kB é pré-existente), `npm run lint` continua em 16 problemas (11
erros, 5 avisos) — mesma contagem do main, nenhuma regressão. Sem suíte de
testes no repo (confirmado), então a lógica de `historyCore.ts` foi
verificada com um script `tsx` ad-hoc fora do repo, não comitado: confirma
que `toWireMessages`/`sanitizeStoredHistory` removem `isError`, rejeitam
valor não-array e descartam entradas sem `role`/`content`.

**Pendência explícita — não verificado nesta sessão.** T7 do plano (deploy
das Edge Functions e teste real do Telegram/`telegram-notify`) não rodou
aqui: exigiria dar deploy em `supabase/functions/_shared/khaos.ts` contra o
projeto real. O código do lado Edge foi só revisado por leitura +
typecheck, não exercitado em produção. Da mesma forma, a cura da linha
`chat_history` já envenenada em produção (T5) não foi confirmada ao vivo —
o saneamento na leitura foi comprovado isoladamente (script acima), mas não
contra a linha real do banco. Recomendo testar os dois depois do merge,
antes de considerar o item fechado.

---

---

## Remover envio de versão de deploy por Telegram

started 2026-10-07

Pedido do usuário: parar de mandar "Deployed vX.Y.Z" no Telegram a cada
release. A feature existia em três camadas, todas removidas na mesma PR:

- **CI** (`.github/workflows/bump-version.yml`) — o step final "Notify
  Telegram" (POST `{job:"deploy",version,url}` em `telegram-notify`) saiu
  junto com o step anterior "Wait for Vercel deployment", que só existia
  para alimentar esse aviso (até 10 min de polling por merge, mais os
  secrets `VERCEL_TOKEN`/`VERCEL_PROJECT_ID`/`VERCEL_TEAM_ID`). Sobrou só
  bump de versão + commit `chore: release vX.Y.Z` + tag; a Vercel continua
  deployando via integração própria do GitHub, sem o workflow observar o
  resultado.
- **Edge Function** (`supabase/functions/telegram-notify/index.ts`) —
  `runDeploy()` e o ramo `job === 'deploy'` saíram; o body passou a ser só
  `{ job?: string }`. `digest` e `reminders` não mudaram.
- **Documentação** — `supabase/functions/telegram-bot/README.md` (tabela de
  funções, seção "Release notifications" inteira removida — ficou só
  "Release versioning" com a nota do commit de bump —, bullet "Cron
  secret"), `docs/03-ai.md`, `docs/04-setup.md` (bullet "Notificação de
  release" removido) e `docs/05-roadmap.md` (item de roadmap retirado de
  Concluído, nota de remoção adicionada no lugar).

**Sem migração de banco.** `telegram_notifications.kind` é `text` livre,
sem `CHECK` — as linhas `kind='deploy'` já gravadas ficam como histórico
inócuo.

**Conflito com o roadmap, declarado em vez de silenciado:**
`docs/05-roadmap.md:16` registrava "Notificação automática de deploy
(Vercel + GitHub Actions → Telegram)" como concluído; a remoção contradiz
esse item registrado, então o roadmap foi atualizado (retirado de
Concluído, nota explicando a remoção) em vez de editado em silêncio.

**Pendências manuais, fora do repo — a fazer pelo usuário:**
1. `supabase functions deploy telegram-notify` para o ramo `deploy` sair
   do ar de fato.
2. Apagar os secrets de repo do GitHub Actions `VERCEL_TOKEN`,
   `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID` e `SUPABASE_FUNCTIONS_URL`
   (Settings → Secrets) — `KHAOS_CRON_SECRET` continua necessário para o
   cron, só não é mais usado pelo GitHub Actions.

---

## Target editor — pickers, largura, clamp, 23:59 fantasma, seções infinitas

started 2026-10-07

Pedido do usuário, seis pontos no mesmo item (`src/components/common/TargetEditor.tsx`):

1. **Pickers.** Só o ícone Target abria o date picker nativo; a seta `→` e
   os `·` (middot de hora) eram `<span>` sem handler. Agora cada um é um
   `<button>` com `openPicker()` próprio (`showPicker()`, fallback
   `.click()`): seta abre o date picker de fim, cada `·` abre o time picker
   do seu lado. `endDateRef`/`startTimeRef`/`endTimeRef` acrescentados ao
   `startDateRef` que já existia.
2. **Largura.** O pill usava `max-[350px]:` (viewport), nunca disparava nos
   hosts onde o container é mais estreito que a viewport (`ProjectDetailPage`
   tinha `max-w-sm`, `SectionColumn` fica dentro da coluna da seção) — com
   data+hora dos dois lados o conteúdo cortava. Trocado por `@container` no
   wrapper + variantes `@max-[350px]:` (Tailwind v4 nativo), que reagem à
   largura real do container; `max-w-sm` removido de `ProjectDetailPage`.
3. **Clamp início/fim.** Nada impedia escolher um início depois do fim —
   gravava um tstzrange invertido (Postgres rejeitava o `UPDATE`).
   `commitRange` agora empurra o fim junto: primeiro para o dia do novo
   início mantendo a hora do fim, e se ainda ficar atrás (hora do fim antes
   da hora do início no mesmo dia) espelha a hora do início.
4. **Remover fim não removia.** Causa raiz comum com o item 5 — ver abaixo;
   junto com isso, `handleRemoveEnd` passou a resetar `showEndTime` também,
   para que um `+ end` seguinte não reabra já com uma hora marcada.
5. **23:59 fantasma.** `effectiveEnd()` grava um target de um dia só como
   `[início 00:00, início 23:59]` para as queries de overlap não
   considerarem o target ainda ativo no dia seguinte — mas o editor derivava
   `showEndInput` direto do range gravado, então esse fim sintético sempre
   reaparecia como segunda data (`· 23:59`), e `handleRemoveEnd` virava
   no-op porque regravava o mesmo range. `showEndInput` agora usa
   `isAllDayRange()` (`src/lib/range.ts`) — a mesma checagem que o
   `TargetBadge` já usava — então o fim sintético deixa de aparecer e
   `handleRemoveEnd` volta a ter efeito visível.
6. **Seções infinitas sem due/target.** Uma seção `is_infinite` é uma lista
   contínua sem janela planejada nem prazo — `SectionColumn.tsx` deixou de
   renderizar o botão/badge de target e o `TargetEditor`, `SectionRow.tsx`
   deixou de renderizar `TargetBadge`/`DueBadge`. Ligar o modo infinito pelo
   menu agora limpa `target`/`due` no mesmo patch (`is_infinite: true,
   target: null, due: null`), para não deixar valor órfão invisível;
   desligar não restaura nada. `docs/01-database.md` (nota da coluna
   `is_infinite`) atualizado para registrar isso.

Verificação: `npm run typecheck` e `npm run lint` limpos (mesmos 16
problemas pré-existentes em arquivos não tocados, confirmados com/sem o
diff via stash — nada novo). Check manual no browser: `/dev/vortex/sigils`
para os quatro estados do editor (pickers confirmados via
`HTMLInputElement.prototype.showPicker` instrumentado — cada botão abre o
input certo; clamp testado nos dois ramos, inclusive o de espelhar a hora;
remover fim confirmado colapsando de volta pro "+ end" sem sobrar `23:59`;
estado "range + time" sem corte de layout); projeto real (`Geral` →
seção `Consertos`, já `is_infinite`) confirmando que o controle de target
não aparece mais na seção expandida.

### Segunda passada — extras do PR #78 portados (2026-10-12)

O PR #78 resolvia os mesmos seis pontos por um caminho paralelo ao que
entrou no `main` primeiro (`1290a1b`), e conflitava em tudo. Decisão do
usuário: manter a implementação do `main` e portar só o que o #78 tinha a
mais, em vez de fazer merge das duas.

Portado para `TargetEditor.tsx`/`range.ts`:

- **Fim sem hora vira 23:59** — `effectiveEnd` normaliza também um fim
  explícito sem hora para `endOfLocalDay`, fechando o range vazio/invertido
  quando início e fim caem no mesmo dia.
- **`início < fim`** em `validate()`, comparado sobre o fim efetivo.
- **Fim acompanha o início preservando a duração**, no lugar do clamp do
  `main`; compara pelo fim efetivo, então um fim sem hora no próprio dia do
  início (válido) não é deslocado.
- **Limite do due** — um due sem hora fica em 23:59:00 e um fim sem hora em
  23:59:59.999; agora compara contra o fim do dia do due, o que o #78 deixava
  rejeitando um target que terminava no próprio dia do due (achado
  bloqueante da revisão).
- **Toggle de hora do fim** — `hasExplicitEndTime` (novo, `range.ts`) evita
  abrir o toggle com o 23:59 sentinela, e `TargetBadge` passa a usá-lo
  (tolera registros legados gravados à meia-noite).
- **Sigils** — duas demos (um dia só, vários dias sem hora), montadas com
  `Date` local em vez de literais `+00`, que mostrariam "· hora" fora do UTC.

**Deixado de fora de propósito:** o estado `lastEmitted`/`emit` (a revisão
mostrou que nunca casava e o reset que ele deveria suprimir não existe no
`main`), a container query `@max-lg` (512px; o `main` mantém 350px, sem a
colisão do botão de limpar apontada na revisão), o demo "narrow host" e o
`max-w-2xl` do `ProjectDetailPage`. Verificação: typecheck e lint limpos
(zero avisos); sem checagem manual no browser neste sandbox.

---

## Quick add — dialog atualizado e tarefa aberta após criar

started 2026-10-07

O dialog "New task" aberto pelo quick-add do header (`QuickAddBar.tsx`)
estava defasado do vocabulário de componentes do round Theurgy — Priority
era um `Select` cru em vez do `PriorityPicker`, e Due era um
`TextInput type="datetime-local"` em vez do `DueEditor` (extraído do
TaskDetailModal justamente para reuso, mas até aqui só consumido pela
câmara de dev Sigils). Trazido ao padrão atual: Priority agora usa
`PriorityPicker`, Due usa `DueEditor`, e um campo Status (`StatusPicker`,
default `planning`) foi adicionado para bater com o conjunto de campos do
TaskDetailModal.

Três bugs reais corrigidos no mesmo dialog: (1) o texto digitado era
limpo mesmo quando o insert falhava — `setRaw('')` agora só roda dentro do
`onSuccess` da mutation; (2) uma falha de insert não mostrava nada — agora
há uma mensagem inline (`create.isError`) e o draft permanece aberto com o
texto preservado; (3) o default de projeto/seção nunca pegava quando o
parser não reconhecia um `#projeto` no texto (o filtro comparava contra
`project_id === null`, que nunca casava) — agora só pré-seleciona seção
quando o parser de fato achou um projeto.

Decisão de semântica de hora: o parser (`quickAdd.ts`) aplicava 09:00 como
default para uma data sem hora explícita, enquanto `DueEditor` e o Due do
TaskDetailModal tratam "sem hora" como 23:59 (fim do dia). `applyTimeOfDay`
foi ajustado para gravar 23:59 também, eliminando a divergência — agora o
quick-add e o resto do app concordam sobre o que "devido amanhã", sem hora,
significa.

Segunda metade do item: depois de criar, a tarefa agora abre — o
`TaskDetailModal` é montado como filho do próprio `QuickAddBar` (estado
local `created`, não a URL `?taskId=`), então funciona em qualquer página,
inclusive as que não montam esse modal (`/calendar`, `/tags`, `/routines`)
e sobrevive a troca de rota. A alternativa de navegar para
`/tasks?taskId=<id>` (padrão do `CommandPalette`) foi considerada e
descartada: tiraria o usuário da página em que estava, e `/dashboard` e
`/projects/:id` resolvem `?taskId` só na lista filtrada da própria página —
um id fora daquele escopo não abriria nada.

Fora de escopo, por decisão explícita: Estimate/Target/Tags/Items não
entraram no dialog de criação (Target em particular tem uma CHECK de banco
amarrando `target < due`, o que o torna ruim para criação). Uma
pré-seleção de projeto baseada na rota atual (`/projects/:id`) foi cogitada
e descartada por ora — fica como ideia registrada, não implementada.

Verificação: `npm run typecheck` limpo; `npx eslint` nos dois arquivos
tocados limpo (`npm run lint` no repo inteiro continua falhando pelos 11
erros pré-existentes do item "`npm run lint` fails on main", não
relacionados); `npm run build` passa. Checagem manual no browser (sem
suite de testes, conforme CLAUDE.md): parser com "tomorrow at 3pm !high"
produz nome limpo, prioridade High, Due com toggle de hora ligado em
15:00, Status em PLAN; botão "Create task" fica desabilitado sem seção
escolhida; `/dev/vortex/sigils` renderiza sem regressão. **Limitação
declarada:** o ambiente de verificação não tem credenciais reais do
Supabase, então o fluxo completo de criar → ver a tarefa nova → abrir o
modal não pôde ser exercitado fim a fim contra dados reais — só a lógica
do dialog e seus estados.

Achado incidental, fora de escopo: o parser não reconhece "tomorrow 3pm"
sem a palavra "at" antes da hora (ex.: o texto do próprio placeholder do
input, "Finish report tomorrow 3pm #ProjectX !high", na real cai no ramo
"today/tomorrow" sem capturar a hora, porque a regex exige `at` antes do
horário) — a hora fica no nome da tarefa em vez de virar Due. Não
corrigido aqui; registrado para decisão futura.

Revisão automatizada do PR #81 (2026-10-08): nenhum achado bloqueante no
diff — typecheck, eslint nos dois arquivos tocados e build limpos. Três
ajustes aplicados direto no branch: `applyTimeOfDay` teve os dois ramos
idênticos de 23:59 colapsados em um (`timeStr?.match(...)`); o
`onOpenTask={(task) => setCreated(task)}` do TaskDetailModal passou a ser
`onOpenTask={setCreated}`; e `create.reset()` passou a rodar ao abrir um
novo draft, porque a mensagem de erro inline (`create.isError`) só zera no
próximo `mutate()` e por isso reaparecia num dialog recém-aberto depois de
uma falha anterior.

Achado pré-existente levantado na revisão, fora do diff: o heurístico que
decide se o toggle de hora do Due começa ligado compara **substring da ISO
string** contra `'23:59:00'` (`DueEditor.tsx:40` e
`TaskDetailModal.tsx:554`). Como a ISO está em UTC, num fuso UTC-3 um due
sem hora (23:59 local) vira `...T02:59:00Z` e o toggle abre ligado
mostrando 23:59 — exatamente o oposto da convenção. O `ui.tsx` já tem a
versão correta, em hora local (`hasExplicitDueTime`, linha 625), só não
exportada. Plano: mover `hasExplicitDueTime` para `dateUtils` (ou
exportá-la de `ui.tsx`) e usá-la nos dois lugares. Não aplicado aqui: muda
comportamento visível de tarefas já existentes e mexe em arquivo fora do
escopo deste PR.

Segunda passada de revisão automatizada do PR #81 (2026-10-08): nenhum
achado bloqueante novo. Dois ajustes aplicados direto no branch. (1) A
busca da "primeira seção do projeto" estava duplicada em duas formas
diferentes no mesmo arquivo — `sections.filter(...)[0]` em `handleSubmit`
e `sections.find(...)` no `onChange` do select de Project; virou um único
helper `firstSectionId(projectId)`, que também absorve a guarda de
`projectId` nulo (um `find` contra `project_id === null` nunca casa, então
o `? :` externo ficou redundante). (2) `confirmCreate` ganhou um
`if (create.isPending) return;`: o botão "Create task" já é desabilitado
durante o insert, mas o atalho Cmd/Ctrl+Enter do `Modal` chama
`confirmCreate` direto, sem passar pelo botão — repetir o atalho com o
insert em voo criava a tarefa duas vezes.

Também notado, não alterado: o diff de `docs/backlog.md` traz ~150 linhas
de reformatação whitespace-only (tabelas com colunas alinhadas, `*all*` →
`_all_`, linha em branco antes de listas) misturadas ao conteúdo novo do
item. `npm run format` cobre só `src/**`, então essa formatação não veio
do script do projeto e sim de um prettier-on-save do editor. Duas saídas,
ambas defensáveis: (a) reverter a parte whitespace-only deste PR, deixando
o diff do doc só com o conteúdo novo — mantém o histórico do backlog
legível, mas o churn volta no próximo editor que salve o arquivo; (b)
aceitar e estender o glob de `format` para incluir `docs/**/*.md`, tornando
a formatação intencional e estável — custa um commit único de churn grande
agora, em troca de nunca mais acontecer por acidente. Fica como decisão do
usuário.

Terceira passada de revisão automatizada do PR #81 (2026-10-12): nenhum
achado bloqueante. Um ajuste aplicado direto no branch — o
`TaskDetailModal` montado pelo `QuickAddBar` ganhou `key={openTask.id}`. O
modal guarda estado local por tarefa que nenhum efeito reseta (o toggle de
hora do Due, inicializado via `useState` preguiçoso a partir de
`task.due`; os drafts debounced de nome/descrição, cujo `dirtyRef` impede
o efeito de ressincronizar; o `seqPicker`). Como `onOpenTask={setCreated}`
permite navegar de tarefa em tarefa pelos chips de sequência sem
desmontar, o estado da tarefa anterior era carregado para a seguinte — o
caso visível é o toggle de hora, e no pior caso um nome digitado e ainda
não commitado aparece no campo da outra tarefa. `ProjectDetailPage` já
passa a mesma `key` no seu próprio `TaskDetailModal`; `TasksPage` e
`DashboardPage` não (mesmo bug pré-existente, fora do escopo deste PR).

Notado, não alterado: os seis `<label>` do dialog usam
`text-nyx-400 … font-medium`, sem caixa alta, enquanto a convenção de
field label do app — a única usada de verdade, documentada na Forge — é
`text-nyx-500 … font-semibold tracking-wide uppercase` (`TaskDetailModal`
nos campos Due/Target/Tags/Moments, `ForgePage.tsx:144`). Os labels são
anteriores a este PR e só foram reordenados pelo prettier-tailwind, mas o
objetivo declarado do item é justamente trazer este dialog ao vocabulário
atual, então a divergência fica mais visível agora. Plano, se quiser:
trocar a classe nos seis labels (ou extrair um `FieldLabel` em `ui.tsx`,
já que a string se repete seis vezes aqui e cinco no `TaskDetailModal`).
Não aplicado por ser mudança visível de aparência, não refatoração neutra.

---

## Backlog ordenado de tarefas (ordem do Today)

started 2026-10-08

Pedido do usuário (requisito, não bug): criar uma maneira de organizar as
tarefas pendentes numa fila, com uma ordem explícita em que serão feitas, e
essa ordem refletida no Today.

**Investigação.** O app não tinha nenhuma noção de "ordem de execução"
persistida. `tasks_sequence` foi deliberadamente removida como ordenação
manual de tasks (vira dependência: desbloqueia/bloqueia, não exibição —
comentários em `sequence.ts`/`hierarchy.ts`/`useHierarchy.ts`/
`02-data-layer.md` documentam isso). `tasks.priority` é um enum de 4
baldes, grosso demais para expressar ordem. `src/lib/taskOrder.ts` tem
ordenações derivadas no client (cronológica e por status/urgência), nenhuma
persistida. Conclusão: reintroduzir ordem manual precisa de um mecanismo
novo — um rank numérico, não a linked-list que foi removida de propósito.
Confirmado que não contradiz `05-roadmap.md`: "Planejamento assistido" (IA
sugerir ordem do dia) ainda não foi construído e passa a ter, com este
item, um lugar para escrever essa ordem.

**Plano aprovado (v1).** `tasks.backlog_rank` (`double precision`, `NULL` =
fora da fila), rank esparso (não linked-list) com inserção por ponto médio e
rebalanceamento quando o gap colapsa. Fila global (não por projeto/seção).
O Today mantém os quatro grupos atuais (Scheduled/Marked/Target/Due);
`backlog_rank` entra como chave de ordenação primária dentro de cada grupo,
com fallback para o critério de data atual. Moment `backlog` novo, gravado
só na transição NULL ↔ não-NULL (nunca em um reorder). Dependência
(`tasks_sequence`) continua mandando no bloqueio — uma task `waiting`
aparece esmaecida como "blocked" na fila, sem reordenação automática.

**Implementado.**

- **Banco** — duas migrations (`ALTER TYPE` em transação própria, por regra
  do Supabase): `20261008000000_backlog_moment_type.sql` (enum
  `moment_types` ganha `backlog`) e `20261008010000_task_backlog_rank.sql`
  (`tasks.backlog_rank`, índice parcial `tasks_backlog_rank_idx`, trigger
  `moment_backlog_tasks`/`trg_moment_backlog`). `database.types.ts` e
  `constants.ts` atualizados a mão (sem script de geração neste repo); de
  passagem, corrigida uma defasagem pré-existente em `MOMENT_TYPES`
  (faltavam `definition`/`today`/`notToday`).
- **Aritmética pura** — `src/lib/backlogRank.ts` (`RANK_STEP`,
  `orderByRank`, `rankBetween`, `rankForIndex`, `needsRebalance`,
  `rebalanceRanks`), sem React/Supabase, no mesmo estilo de `reorder.ts`/
  `taskOrder.ts`.
- **Camada de dados** — `src/lib/api/backlog.ts` (`add`/`move`/
  `removeFromBacklog`/`rebalance`/`listOrdered`), updates comuns na tabela
  `tasks`. Comentários desatualizados em `hierarchy.ts`/`useHierarchy.ts`
  corrigidos para apontar para este novo caminho em vez de só dizer "foi
  removido".
- **Hook** — `src/hooks/useBacklog.ts`: `useBacklogTasks()` derivado do
  cache de `useTasks()`; `useBacklogMutations()` com `add`/
  `removeFromBacklog`/`move` (grava um rank já calculado, sem rebalancear —
  para quem só vê uma vizinhança parcial) e `reorder` (índice-baseado, com
  rebalanceamento — vê a fila inteira).
- **UI — view Backlog** — quarta aba em `TasksPage.tsx` + novo
  `src/components/tasks/BacklogList.tsx`: lista ordenável por
  `@dnd-kit/sortable`, número de posição, badges reaproveitados de
  `common/ui.tsx`, remover da fila, e um painel de tarefas abertas sem rank
  para adicionar.
- **UI — toggle global** — `BacklogToggle` novo em `common/ui.tsx` (mesmo
  formato do `TodayToggle`), ao lado da estrela de "hoje" em `TaskRow.tsx` e
  `TaskDetailModal.tsx`.
- **UI — Today** — `DashboardPage.tsx`: `backlog_rank` como chave primária
  de ordenação dentro de Marked/Target/Due (fallback no critério de data de
  cada grupo, dividers preservados); badge de posição (`RankBadge`) nas
  pills com rank; grupo Marked ganhou reordenação por arraste
  (`SortableTaskPill` + `SortableContext`), restrita ao subconjunto de
  marcas de hoje que já estão na fila (as sem rank e as marcas antigas
  esmaecidas não são arrastáveis — adicionar à fila primeiro pelo toggle).
  Scheduled não entrou: suas pills renderizam por hora do evento, não por
  lista, então um rank não mudaria nada visível ali.
- **Assistente** — parágrafo novo em `src/lib/chat/prompts.ts` explicando
  `backlog_rank`, como lê-lo/escrevê-lo via `query_rows`/`update_rows`, e
  que reordenar é escrever um rank entre dois vizinhos. Tool dedicada
  `list_backlog` fica como follow-up, fora do v1.
- **Docs** — `01-database.md`, `02-data-layer.md` (corrige a nota antiga
  sobre ordenação manual removida), `06-concepts.md` (seção "Backlog"),
  `05-roadmap.md` (registrado como concluído/pré-requisito).

**Pendência explícita — não verificado nesta sessão.** A sessão de
implementação correu num ambiente sem acesso a rede/Supabase linkado:
`npm run db:push` e `npm run db:dump` (que regenera `schema.sql` e
`supabase/functions/_shared/schema.sql.ts` via `gen:edge-schema`, para o
`search_schema` do assistente/bot ver a coluna) **não foram executados**.
As migrations foram escritas e revisadas por leitura, seguindo o estilo das
já existentes, mas não aplicadas contra o banco real. Depois do merge e do
push: aplicar as migrations, rodar o dump, e então rodar a checagem manual
completa do plano (setar/mover/limpar `backlog_rank` em algumas tasks e
conferir a ordem e os moments gravados; checagem no navegador — arrastar
para reordenar na view Backlog e dentro de Marked no Today, recarregar e
confirmar persistência; perguntar ao assistente "o que está no meu
backlog?"). `npm run typecheck`, `npm run lint` (`--max-warnings 0`) e
`npm run build` foram verificados limpos nesta sessão.

**Revisão do PR #82 (2026-10-12).** O PR já estava mergeado (e seu branch
`worktree-backlog-ordering` apagado) quando a revisão rodou, então nada pôde
ser empurrado para ele; os achados foram registrados como comentários de
revisão ancorados no commit `f7233f4` e as limpezas neutras foram para um
branch de follow-up (`worktree-review-pr82-cleanups`).

Dois achados bloqueantes, ambos aguardando decisão do usuário sobre o
caminho (as alternativas e o trade-off estão nos comentários do PR):

- **Filtro de status da fila mora em dois lugares.** `useBacklogTasks()` não
  filtra status; `BacklogList` filtra por `OPEN_STATUSES`. Como nada limpa
  `backlog_rank` quando a task é concluída, (1) o `RankBadge` do Today
  numera incluindo tasks fechadas, divergindo da coluna de posição da
  view Backlog, e (2) o `rebalanceRanks` disparado por um arraste reatribui
  ranks só ao subconjunto aberto, embaralhando a ordem relativa das
  fechadas que ainda têm rank. Caminhos: filtrar dentro do hook
  (recomendado, resolve os dois sintomas em uma linha) ou zerar o rank
  quando a task sai de `OPEN_STATUSES` (invariante mais limpa, escrita
  extra no caminho de concluir).
- **Rank duplicado ao reordenar dentro do Marked no Today.** O ponto médio é
  calculado entre vizinhos do grupo Marked, não da fila global, e pode
  cair exatamente sobre o rank de uma task enfileirada porém não marcada
  (ex.: fila `1024/2048/3072/4096`, com `2048` não marcada, gera `2048`
  de novo). Ranks iguais deixam a ordem indefinida e as posições instáveis
  entre recargas. Caminhos: calcular o rank contra a fila global
  (`backlogTasks`, recomendado) ou manter a vizinhança marcada e só
  desempatar quando houver colisão.

Três notas não bloqueantes, também nos comentários: a consulta de rank
máximo em `backlogApi.add` não filtra `deleted_at` (não usa o índice
parcial, e dois `add` concorrentes colidem); `backlogApi.rebalance` faz N
updates paralelos sem transação, podendo deixar a fila meio rebalanceada; e
`npm run format` não rodou sobre o código novo (o lint não pega formatação).

Limpezas neutras aplicadas no branch de follow-up (typecheck + lint
limpos): comentário duplicado do `TaskPill` removido, `TaskPillBodyProps`
reduzido ao que o corpo realmente renderiza (herdava `onOpen`/`faded` em
vão), `rankPosition` dobrado em `TaskPillProps` em vez de interseção
inline em três lugares, `className` compartilhado entre `TaskPill` e
`SortableTaskPill` extraído em `pillClassName()`, cast
`as { data: Task[] }` removido de `useBacklogTasks` e constraint de
`rebalanceRanks` simplificada.

**Achados corrigidos (2026-10-13).** Os três bloqueantes e os não
bloqueantes foram resolvidos num PR empilhado sobre o das limpezas
(branch `worktree-fix-pr82-review-findings`), seguindo as recomendações
dos comentários:

- ~~Filtro de status em dois lugares~~ — `useBacklogTasks()` agora filtra
  `deleted_at` **e** `OPEN_STATUSES` e é memoizado (`useMemo` sobre o cache
  de tasks); `BacklogList` deixou de filtrar. A fila tem uma só definição:
  numeração do Today, coluna da view Backlog e `rebalanceRanks` enxergam a
  mesma lista. Consequência assumida: task concluída fica com
  `backlog_rank` órfão no banco (invisível) e reaparece no rank antigo se
  reaberta; limpar o rank no fechamento segue como follow-up opcional.
- ~~Rank duplicado no Marked~~ — o reorder do Today usa `reorder()` sobre a
  fila global (`arrayMove` em `backlogTasks`), então o rank sai sempre entre
  dois vizinhos reais e o rebalanceamento é o mesmo da view Backlog. A
  mutation `move` (que só via vizinhança parcial) foi removida do hook.
- ~~Colisão do DnD (`marked-zone` vs. pills)~~ — o alvo do reorder é
  resolvido pela lista `collisions` do evento quando `over` é
  `marked-zone`; soltar uma pill de fora sobre uma pill marcada ranqueada
  volta a marcar para hoje. **Não verificado no navegador** (2 e 5 pills
  marcadas), como o resto da pendência de verificação manual acima.
- ~~Não bloqueantes~~ — `backlogApi.add` filtra `deleted_at` (casa com o
  índice parcial); `rebalance` usa `Promise.allSettled` e falha apontando
  quais ids não foram gravados (RPC atômico fica de fora: exigiria migration
  que não dá para aplicar daqui; a corrida de dois `add` concorrentes
  também segue aberta); entrada morta `backlog: 'Backlog'` de
  `MOMENT_TYPE_LABELS` removida e helper inlinado; na view Backlog a
  `TasksPage` esconde a barra de filtros e passa a lista inteira; `<hr>` do
  grupo Marked só aparece se houver marcação atual; `prettier` aplicado
  nos arquivos tocados, em commit separado.

Verificação: `npm run typecheck` e `npm run lint` limpos. A verificação
manual (SQL + navegador + assistente) e `db:push`/`db:dump` continuam
pendentes.

**Busca em "Not queued" (2026-10-13).** Com ~300 tasks abertas fora da
fila, achar uma para enfileirar na view Backlog exigia rolar a lista. A
seção "Not queued" ganhou uma caixa de busca (nome da task ou nome do
projeto/campo), com o contador mostrando "n of total" enquanto há busca. A
busca só estreita os candidatos; a fila de cima continua global e sem
filtro, pelo mesmo motivo registrado na revisão do #82 (reordenar por um
subconjunto distorce os ranks). Sem resultado, a seção diz "No tasks match
this search" em vez de "Every open task is already in the backlog".

A ordem de "Not queued" era indefinida (a query de tasks não tem
`ORDER BY`; valia a ordem física do Postgres, que muda a cada update). Agora
é: prioridade maior primeiro, depois due mais próximo (sem due por último),
depois nome.

---

## Nine unmerged branches — triage before cleanup

started 2026-09-30

`delete_branch_on_merge` was off on `sei-xu/khaos` until 2026-09-30, so every
branch ever merged stayed behind. Turning it on (done, same day) fixes the
future but not the backlog of 56 remote branches it left.

**46 of them are already merged into `main`.** Those are pure clutter and are
safe to delete in bulk — the content is all on `main`. Not done yet: a 46-branch
deletion is worth doing deliberately, and it should come *after* the triage
below, not before.

**Nine are NOT merged.** This is the part that matters — it is work that never
reached `main`, and deleting them would lose it:

| branch | last commit | commits ahead | files vs main |
|---|---|---|---|
| `claude/anthropic-proxy-cleanup` | 2026-07-13 | 1 | 1 |
| `claude/khaos-telegram-bot-yolc9z` | 2026-07-23 | 2 | **0** |
| `claude/review-tasks-stale-priority-f02xyi` | 2026-08-07 | 1 | 1 |
| `claude/task-logging-broken-5b9exk` | 2026-08-07 | 1 | 1 |
| `claude/infinite-sections-sorting-na7nql` | 2026-08-29 | 1 | 3 |
| `claude/task-items-frontend-inclusion-kqu4tm` | 2026-08-29 | 1 | 1 |
| `claude/task-logs-editable-18yaqw` | 2026-08-30 | 3 | 1 |
| `claude/mobile-task-drag-today-opaf6k` | 2026-09-04 | 1 | 6 |
| `claude/unificar-targets-view-zm599h` | 2026-09-19 | 2 | 4 |

Three things stand out:

- `khaos-telegram-bot-yolc9z` shows **zero file difference** against `main`. Its
  content already landed by another route, so it is merge-unreachable but
  functionally dead — the one clearly safe deletion of the nine.
- `claude/review-tasks-stale-priority-f02xyi` is **recovered** — its one
  commit, `add0de3`, is the fix for
  [Daily review — stale in-review prioritization](#daily-review--stale-in-review-prioritization)
  (reopened; it had been marked resolved in 2026-08-07 but never reached
  `main`). Only that commit's `DIGEST_INSTRUCTION` hunk was applied, not a
  merge of the branch — the branch's version of the file still has the
  `deploy` job (`runDeploy` + the three-job doc comment), which was removed
  from `main` on 2026-10-07 per
  [Remover envio de versão de deploy por Telegram](#remover-envio-de-versão-de-deploy-por-telegram);
  merging the branch wholesale would have silently reintroduced it. The
  branch itself is now safe to delete.
- `task-items-frontend-inclusion-kqu4tm` maps to the still-open item
  [Task items — couldn't add from frontend](#task-items--couldnt-add-from-frontend).
  Worth checking whether it holds an attempted fix before anyone restarts that
  work from scratch.
- `unificar-targets-view-zm599h` maps to
  [Unify target pill + input view](#unify-target-pill--input-view), which is
  marked **resolved**. So either the branch is an abandoned earlier take, or a
  slice of that work never made it in. Worth a look either way.

There is also a merged branch literally named
`claude/lost-unmerged-branches-ctk3d3`, which suggests work has been lost this
way before.

Suggested order: triage these nine first (recover, re-open, or confirm dead),
then delete the 46 merged ones in one pass. Nothing has been deleted yet apart
from the two branches of PRs #72 and #74.

---

## Daily review — stale in-review prioritization

started 2026-08-06 · reopened 2026-10-12

Originally approved 2026-08-07 and marked resolved — but the fix
(`add0de3`, "Surface stale in-review tasks first in the morning digest")
never reached `main`. `git merge-base --is-ancestor add0de3 main` came back
false; the commit only ever lived on
`origin/claude/review-tasks-stale-priority-f02xyi`, one of the nine
branches in [Nine unmerged branches — triage before cleanup](#nine-unmerged-branches--triage-before-cleanup).
Confirmed on `main`: `DIGEST_INSTRUCTION` in
`supabase/functions/telegram-notify/index.ts` has no mention of
`in_review` at all. The backlog recorded this as done for over two months
while it never ran.

User request this time (phrased generically — "tarefas em review devem
ser colocadas no drop diário após certo tempo"): same surface as before,
confirmed against this session — "drop diário" is the Telegram morning
digest, not the web `TaskList` sort UI.

~~Recovered the `add0de3` hunk into `DIGEST_INSTRUCTION`: a new "stale
in-review" section, listed first ahead of every other section, most stale
first — staleness read from the task's most recent `moments` row with
`moment_type = 'status'`, `value = 'in_review'` (its `created_at` is the
entry time). Applied as a targeted patch of just that hunk, not a merge of
the branch (see the branch note above for why). The 3-day default is
unchanged from what the user accepted in August, but it's no longer
hardcoded in the prompt text — added `STALE_REVIEW_DAYS` (env var, default
`'3'`, same pattern as the existing `REMINDER_LEAD_MINUTES`), so the
threshold is adjustable via `supabase secrets set` without a code
redeploy. Documented in `supabase/functions/telegram-bot/README.md` (the
`digest` bullet and the secrets table).~~

**Still pending — not done in this PR, part of the delivery, not an
afterthought:** the change only takes effect after
`supabase functions deploy telegram-notify` is run; today's digest is
unaffected until then. Also pending: the manual end-to-end check (a task
4+ days in `in_review` appears first, oldest-first; a task ~1 day in
`in_review` does not appear; no `deploy`-job message reappears; repeat
with `STALE_REVIEW_DAYS=1` and confirm the ~1-day task now shows). No test
suite exists in this repo (`CLAUDE.md`): verification here is
`npm run typecheck` (clean, but doesn't cover `supabase/functions` —
`tsconfig.json`'s `include` is `["src"]`), `npm run lint` (clean on this
branch), and `deno check supabase/functions/telegram-notify/index.ts`
(clean — the only check that actually covers the edited file).

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

### Investigation — 2026-10-05

The suspicion above is confirmed, and it is not a regression: the history of
`package.json` shows `eslint-plugin-react-hooks` has been pinned at `^7.1.1`
since the repository's **initial commit**. v7's flat `recommended` config ships
the React-Compiler-era rules, and `set-state-in-effect` is `error` there. So
the lint gate has never been green on this repo — the documented "zero
warnings" gate in `CLAUDE.md` describes an intent that was never actually met,
rather than a state that was lost.

Nothing enforces it either: there is no lint job in CI (`.github/workflows/`
holds only `bump-version.yml`), and although `vite-plugin-eslint` is still a
devDependency it is **not wired into `vite.config.ts`**, so the dev server
doesn't lint on save. `npm run lint` is manual-only, which is how 16 problems
accumulated unnoticed.

Per-group root cause:

1. **`no-explicit-any` × 9 in `toolsCore.ts`** — not a typing gap in the
   domain, just friction. `executeTool(deps, rawName, args)` already receives
   `args: Record<string, unknown>`, and each `case` does `const a = args as
   any` purely so `a.table` / `a.filters` / `a.limit` read without complaint.
   The file's *first* case already demonstrates the correct in-house idiom —
   `const a = args as { date?: unknown }` followed by `typeof` guards — so
   this is applying a pattern the file already owns to the other six cases.
   The last two sites are `cleanPayload(obj: any): any` (a recursive JSON
   scrubber that wants `unknown`) and `db.rpc(a.name as any, …)`.
2. **`set-state-in-effect` × 2** — both are "reset state when something
   changes", the exact case React's *You Might Not Need an Effect* covers.
   Important finding: the escape hatch of adjusting state during render is
   **also blocked**, because the same recommended config enables
   `react-hooks/set-state-in-render` as `error`. Both fixes therefore have to
   remove the `setState` rather than relocate it.
3. **`strokeWidth` warning** — the prop is destructured deliberately, to
   swallow it: the mark is fill-only (`fill="none"` on the `<svg>`,
   `fill={color}` on the paths), so a stroke width would be meaningless on the
   DOM node. Verified by probe that `ignoreRestSiblings` does *not* cover
   function parameters (the `...rest` sibling doesn't exempt it) but that an
   `_` prefix does, matching the configured `argsIgnorePattern: '^_'`.
4. **`react-refresh/only-export-components` × 4** — the three context modules
   (`activeEntityContext.tsx`, `chat/chatActivityContext.tsx`,
   `processingContext.tsx`) each export a Provider component *and* its
   consumer hook from one file. Standard, deliberate React practice; the
   warning is only about dev-time HMR granularity.

Also confirmed: `docs/05-roadmap.md` registers no phase this touches, so
nothing here contradicts the roadmap. `eslint .` does lint
`supabase/functions/**`, and those files are currently clean.

### Plan — 2026-10-05

Goal: `npm run lint` exits 0 with zero problems, so the gate `CLAUDE.md`
documents becomes real. Behaviour-preserving throughout — no feature change.

1. **`eslint.config.ts`** — add `.claude` to the top-level `ignores`. Without
   it `eslint .` descends into `.claude/worktrees/` and double-counts every
   problem whenever a worktree exists (the 32-instead-of-16 gotcha above),
   which also means the implementation session can't trust its own counts.
2. **`src/lib/chat/toolsCore.ts`** — replace each `const a = args as any` with
   a locally declared `{ … ?: unknown }` shape plus `typeof` guards, following
   the `list_tasks_marked_for_day` case already in the file. Widen the private
   `assertAllowedTable(table: string)` to accept `unknown` (it is a runtime
   membership check against `ALLOWED_TABLES` anyway, and it is not exported),
   guard `select` / `orderBy` with `typeof x === 'string'`, pass `args`
   straight to `coerceValues` (its parameter is already `Record<string,
   unknown>`), and retype `cleanPayload` as `(value: unknown) => unknown`.
   `search_schema` guards `args.query` instead of casting. For `db.rpc(a.name
   as any, …)`: try dropping the cast first and only fall back to a narrower
   cast with a one-line justification if the untyped `SupabaseClient` won't
   accept a plain `string`. `executeTool`'s exported signature does **not**
   change, so `src/lib/chat/tools.ts` and
   `supabase/functions/_shared/khaos.ts` are untouched.
3. **`src/components/layout/AppShell.tsx`** — delete the route-change effect
   and derive the overlays instead of storing them: keep the pathname the
   overlay was opened on (`drawerOpenFor` / `chatSheetOpenFor`) and compute
   `const drawerOpen = drawerOpenFor === location.pathname`. Navigating makes
   the comparison false on its own, so the overlay closes with no `setState`
   in either an effect or render. The `localStorage` sidebar effect stays —
   that one is a genuine external-system sync and is not flagged.
4. **`src/components/layout/CommandPalette.tsx`** — drop the `open` prop and
   the `if (!open) return null` early return, and let `AppShell` mount it
   conditionally (`{paletteOpen && <CommandPalette onClose={…} />}`). A fresh
   mount per open means `useState('')` already starts empty, so the
   query-clearing effect is deleted outright rather than rewritten.
5. **`src/components/icons/StagingAcademyIcon.tsx`** — rename the swallowed
   prop to `_strokeWidth` (verified to satisfy `argsIgnorePattern`) with a
   short comment saying why a fill-only mark drops it.
6. **`react-refresh/only-export-components`** — recommendation: *don't* split
   the three context modules. Splitting Provider from hook would add three
   files and churn 12 import sites to buy a dev-only HMR nicety, against a
   pattern the whole React ecosystem uses. Instead add a `files`-scoped block
   in `eslint.config.ts` covering those modules that passes `allowExportNames:
   ['useActiveEntity', 'useSyncActiveEntity', 'useChatActivity',
   'useProcessingContext']` to the rule — the rule stays `warn` everywhere
   else, and only these named hook exports are exempted. (To verify during
   implementation: `allowExportNames` is supported by the installed
   `eslint-plugin-react-refresh@0.5.3`.)

   **Decided on 2026-10-05: the user chose this option ("seguir com A") — do
   not split the context modules.** This was the one item in the plan that was
   a policy call rather than a defect fix, so it was taken to the user; the
   other five steps have a single correct fix and needed no decision. What the
   warning actually costs was the deciding factor: Vite's Fast Refresh can
   only hot-swap a module whose exports are *all* components, so with a hook
   exported alongside the Provider, editing one of these three files during
   `npm run dev` triggers a full page reload instead of a surgical swap. That
   is the entire cost — nothing in the build or in production. Splitting would
   have bought nicer HMR on three rarely-edited files in exchange for three
   new files and edited import lines in twelve others, against a Provider +
   hook co-location pattern the whole React ecosystem uses.

**Verification** (there is no test suite in this repo, per `CLAUDE.md` —
verification is typecheck + lint + build + manual checks):

- `npm run lint` → **0 problems**, down from 16. This is the primary gate and
  the whole point of the change.
- `npm run typecheck` → clean. This is what actually proves step 2 is sound:
  removing `any` means every property access in those cases is now checked, so
  a wrong guard surfaces here.
- `npm run build` → clean.
- `deno check supabase/functions/_shared/khaos.ts` — best-effort, since that
  file imports `toolsCore.ts` directly and is outside `tsconfig.json`'s
  `include: ["src"]`. Confirms the Edge-function consumer still typechecks.
- Manual browser checks for steps 3–5, the only user-visible surfaces: mobile
  drawer opens and closes itself on navigating to another route; chat sheet
  likewise; Esc and ⌘K still close the drawer; ⌘K opens the palette with an
  **empty** query after a previous search (the behaviour the deleted effect
  provided); the Staging Academy icon still renders in `FIELDS_CONFIG`.
- Agent smoke test for step 2, exercising the coercion paths the retyping
  touches: a `query_rows` with `filters` as a real array, as a JSON *string*,
  and as a `{column: value}` map, plus one `update_rows` with a `reason` so
  `backfillReason` is covered.

Follow-ups deliberately **not** in scope here, noted so they don't get lost:
adding a lint job to CI (nothing would stop problem #17 from landing
otherwise), and either wiring up or removing the unused `vite-plugin-eslint`
devDependency.

### Implementação — 2026-10-05

Aberta como [PR #77](https://github.com/sei-xu/khaos/pull/77), no branch
`worktree-lint-investigation-planning`. O item segue **aberto** até aprovação.

`npm run lint` agora sai 0 com **zero problemas**, contra os 16 de antes, em
108 arquivos. Os quatro gates passam: `lint`, `typecheck`, `build` e
`deno check supabase/functions/_shared/khaos.ts` (o consumidor Edge, que vive
fora do `include: ["src"]` do tsconfig).

Cinco dos seis passos saíram como planejado. **O passo 3 mudou de mecanismo**,
e essa é a parte que importa revisar:

#### O passo 3 foi feito de outro jeito — o plano tinha um bug

O plano mandava derivar os overlays de uma comparação com `location.pathname`
(`drawerOpen = drawerOpenFor === location.pathname`). Isso tem um defeito real:
**estado velho volta a casar**. Abrir a chat sheet em `/dashboard`, navegar
para `/tasks` (fecha, correto) e voltar para `/dashboard` faz a sheet reabrir
sozinha, porque `chatSheetOpenFor` continua valendo `/dashboard`. No mobile é
fácil de alcançar. Trocar para `location.key` não resolve: o botão Voltar
restaura a entrada antiga do histórico com a chave original.

A saída idiomática de verdade — remontar uma subárvore via `key` — exigiria
reestruturar o `AppShell`, porque as regiões que dependem de `drawerOpen` e
`chatSheetOpen` estão espalhadas pelo render (backdrop, painel do drawer,
botão hambúrguer, FAB do chat e a bottom-sheet). Reestruturação, não ajuste,
numa mudança que deveria preservar comportamento.

Então o efeito **ficou como estava**, com uma supressão estreita
(`eslint-disable` em volta das duas linhas de `setState`) e um comentário
explicando por que as duas alternativas sem efeito não servem. O código do
drawer/sheet ficou byte-equivalente ao que já roda em produção. Trocar um
warning de lint por um bug de reabertura de overlay não valeria a pena.

Nota de mecânica: a diretiva precisa ficar colada na linha do `setState` — um
`eslint-disable-next-line` antes do `useEffect` não suprime nada, porque a
regra reporta na linha da chamada, não na do hook.

#### Os outros cinco

1. ~~`.claude` entrou nos `ignores` do eslint.~~ Confirmado: 108 arquivos
   lintados, nenhum sob `.claude`, sem contagem dobrada.
2. ~~Os 9 `any` do `toolsCore.ts` saíram~~, trocados por shapes locais
   `{ …?: unknown }` com guards `typeof`, seguindo o idioma que o próprio
   arquivo já usava no primeiro `case`. O `db.rpc` aceitou `string` sem cast
   nenhum, então o fallback previsto não foi necessário.
4. ~~`CommandPalette` agora é montada condicionalmente pelo `AppShell`~~ e
   perdeu a prop `open`, o early-return e o efeito que limpava a query.
   Verificado no browser: ⌘K abre com a busca **vazia** depois de uma busca
   anterior. Ganho de brinde — o `autoFocus` só dispara na montagem, então
   antes a paleta não refocava ao reabrir; agora refoca.
5. ~~`strokeWidth` virou `_strokeWidth`~~ no `StagingAcademyIcon`. Ícone
   verificado renderizando no app.
6. ~~Isenção `allowExportNames` para os três módulos de contexto~~, como
   decidido. Verificado que a isenção é **por nome, não por arquivo**: um
   export não listado dentro de um arquivo de contexto continua avisando, e a
   regra segue disparando em qualquer outro arquivo do app.

#### Verificação

Além dos quatro gates: smoke test do executor com um `db` falso injetado via
`ToolDeps` — 22 checks cobrindo `filters` nas três formas que o modelo emite
(array, string JSON e mapa `{coluna: valor}`), o alias `set`, as coerções de
`ascending`/`limit` vindos como string, o cap de 40 no limit, a rejeição de
tabela fora da allowlist (incluindo não-strings) e o `backfillReason`. Não
tocou o banco e **não ficou no repo**, porque o `CLAUDE.md` diz para não
inventar suíte de testes.

No browser: app carregado em dev, paleta e ícone verificados, console sem
erros (só os warnings pré-existentes de future flag do React Router). O
drawer/sheet não foi re-testado de propósito — seu código não mudou.

Duas coisas que ficaram **fora** de propósito, e seguem abertas: não há job de
lint no CI, então nada impede o problema nº 17 de entrar; e o
`vite-plugin-eslint` continua como devDependency sem estar ligado ao
`vite.config.ts`. Também não rodei `npm run format`: os três arquivos maiores
que toquei já estavam fora do padrão do prettier **antes** desta mudança, e
formatá-los agora inflaria o diff com linhas que nada têm a ver com o lint.

### Investigação e implementação — 2026-10-12

Pedido chegou com `npm run lint` já verde (confirmado de novo em `main`,
`9549583`/v2.0.3: 112 arquivos, 0 problemas) — os 16 problemas históricos
foram zerados pela PR #77. Não há PR aberta nem branch com lint quebrado.
Então o que restava de "problemas de lint" eram os dois follow-ups que a
#77 deixou de propósito fora de escopo, mais duas pendências novas achadas
nesta investigação:

- ~~**Não havia job de lint no CI**~~ — `.github/workflows/` só tinha
  `bump-version.yml`; nada impedia uma regressão de entrar em `main` sem
  ninguém notar.
- ~~**`vite-plugin-eslint` seguia como devDependency morta**~~, não ligada
  ao `vite.config.ts` (confirmado lendo o arquivo: só `react`, `tailwindcss`
  e `mkcert`). Pacote sem release desde 2022, que linta dentro do hook
  `transform` (fonte confirmada: `new ESLint(opts)` + `lintFiles` por
  módulo, com `failOnError` derrubando o dev server) — custo em todo HMR e
  risco de dev server morrendo por erro de lint.
- **Achado novo:** `eslint` e `@eslint/js` nunca foram devDependencies
  declaradas — `npm ls eslint` mostrava `eslint@9.39.4` só por
  transitividade (via `eslint-plugin-react-hooks`, `typescript-eslint`,
  `eslint-plugin-react`, `react-refresh`, `simple-import-sort` e o próprio
  `vite-plugin-eslint`), e `eslint.config.ts` importa `@eslint/js` contando
  com hoisting. O gate inteiro dependia de pacote fantasma: um bump que
  mude a árvore de deps (ou a remoção do `vite-plugin-eslint` acima) podia
  deixar `npm run lint` sem binário.
- **Achado novo:** `eslint-plugin-simple-import-sort@^13` está declarado
  mas nunca registrado em `eslint.config.ts` — devDependency morta, mesma
  categoria do `vite-plugin-eslint`.

**Feito nesta PR**, sem tocar nenhum arquivo em `src/`:

1. `package.json` — declaradas `eslint` e `@eslint/js` como devDependencies
   diretas (`^9.39.4`, a versão que já rodava), para o gate parar de
   depender de hoisting transitivo.
2. `package.json` — removido `vite-plugin-eslint`. Decisão registrada:
   recomendo **não** ligá-lo ao `vite.config.ts` (a outra opção do
   follow-up) — sem manutenção desde 2022, linta em `transform` (custo a
   cada HMR) e derruba o dev server num erro de lint; o passo 3 abaixo já
   cobre o gate de verdade, e o sinal em tempo de edição vem do ESLint do
   editor. Se um dia quiser lint no dev server, o caminho é
   `vite-plugin-eslint2` ou `@nabla/vite-plugin-eslint`, mantidos e
   compatíveis com flat config — fica anotado aqui, não executado.
3. `.github/workflows/lint.yml` (novo) — job `verify` em `ubuntu-latest`:
   checkout, `setup-node@v4` (Node 22, `cache: npm`), `npm ci`,
   `npm run lint`, `npm run typecheck`. Gatilhos: `pull_request` e `push`
   para `main` (cobre também o commit `chore: release vX.Y.Z` do
   `bump-version.yml`), `concurrency` por ref com `cancel-in-progress`.
   Typecheck entrou junto porque também não tinha gate nenhum (o build usa
   `esbuild` e não checa tipos).
4. `package.json` — removido `eslint-plugin-simple-import-sort`, nunca
   registrado no `eslint.config.ts`. Ligá-lo reordenaria imports em ~112
   arquivos — diff enorme e sem relação com este item; fica anotado como
   item separado caso haja interesse real em ordenação de imports.

Checagens de contexto: `docs/05-roadmap.md` não registra fase de CI/lint,
então nada aqui contradiz o roadmap; `lockfileVersion` 3 (`npm ci` ok); o
pacote `supabase` não tem `postinstall` que atrapalhe CI; o ignore de
`.claude` já estava no `eslint.config.ts`, então a contagem não dobra.

**Verificação**: `npm run lint` → 0 problemas em 112 arquivos (mesma
baseline), agora com `eslint`/`@eslint/js` como dependência direta e não
só transitiva; `npm ci` do zero confirma que o lockfile reescrito instala e
que remover `vite-plugin-eslint` não levou o binário do `eslint` junto —
esse é o teste que de fato valida os passos 1, 2 e 4; `npm run typecheck`
e `npm run build` limpos provam que tirar `vite-plugin-eslint` do
`package.json` não afeta o build (nunca esteve no `vite.config.ts`);
`npm run dev` sobe e serve o app. Na PR: job `verify` precisa estar verde;
teste negativo (um `console.log` descartável, que `no-console` reporta
como warning e `--max-warnings 0` transforma em falha) confirma que o job
fica vermelho quando deveria, depois removido.

Segue **aberto** até aprovação — a recomendação do passo 2 (não ligar
`vite-plugin-eslint`) e a remoção do `simple-import-sort` são decisões que
valem checar com o usuário antes de fechar.

---

## Integração bidirecional com o Google Calendar (somente eventos fixed)

started 2026-10-12

Pedido do usuário (`user_request`): criar integração com o Google Calendar.

**Requisito decidido pelo usuário (2026-10-12), respondendo pergunta de
esclarecimento da rodada anterior:** integração **bidirecional**, restrita a
`events.event_type = 'fixed'`. `scheduled` e `routine` nunca sincronizam —
nada vindo do Google pode se materializar como `scheduled`/`routine`, e
eventos desses dois tipos nunca saem do Khaos. Essa é a regra mais importante
da feature.

**Investigação.** `fixed` já é definido no enum como "compromisso rígido e
não-movível (reunião, aula, voo)" — exatamente o que mora num Google
Calendar. Achados principais: (1) não existe camada de backend própria — o
agente de chat (app e bot do Telegram) escreve direto em `events` com a
service-role key, então o gatilho de push só podia viver num **trigger de
Postgres**, nunca na camada de API do frontend, que o agente ignora
completamente; (2) `trg_moment_scheduled` já descarta eventos sem
`task_id`/`project_id` — confirmado por leitura — então importar em massa não
cria `moments` nem alimenta o oversight-agent; (3) a API incremental do
Google (`syncToken`) é incompatível com `timeMin`/`timeMax`/
`privateExtendedProperty` no mesmo request — a janela de 90 dias só pode ser
aplicada do lado do Khaos, e um `410 fullSyncRequired` exige refazer o full
sync **sem apagar** os eventos que já existem localmente (ao contrário do
exemplo oficial do Google), já que a tabela `events` também guarda dados
que não vêm do Google; (4) não há Supabase Auth (`[auth] enabled = false`),
então o OAuth do Google teve que ser implementado à mão, com uma pegadinha
operacional real: enquanto a tela de consentimento ficar em "Testing", o
refresh token expira em 7 dias — é preciso publicá-la ("In Production").

**Implementado.**

- **Migrations** —
  `supabase/migrations/20261013000000_google_calendar_sync.sql` adiciona
  `google_event_id`/`google_calendar_id`/`google_etag`/`google_synced_at`/
  `sync_dirty` em `events`, um índice único parcial em
  `(google_calendar_id, google_event_id)` (impede importar o mesmo evento
  duas vezes) e o trigger `trg_google_sync_dirty`: marca `sync_dirty` só
  quando a linha é (ou acabou de deixar de ser) `fixed` **e** uma coluna
  observável mudou (`name`/`duration`/`deleted_at`/`event_type`) — as
  colunas que a própria sincronização escreve ficam de fora do que o trigger
  observa, para uma escrita de sync não se remarcar sozinha como suja.
  `20261013010000_google_calendar_account.sql` cria `google_calendar_account`
  (singleton, refresh/access token, `sync_token`, RLS sem policy — só
  service-role lê) e `google_calendar_sync_log` (trace append-only, podado a
  cada 30 dias), mais a RPC `google_calendar_status()` (SECURITY DEFINER,
  projeta só `connected`/`calendar_id`/`last_sync_at`/`last_error`, nunca os
  tokens).
- **Edge Functions** — `supabase/functions/google-calendar-oauth` (fluxo
  OAuth manual, uma vez: `?start=<secret>` redireciona para o consentimento,
  `?code=&state=` troca pelo refresh token; `state` assinado por HMAC para
  não aceitar um replay). `supabase/functions/google-calendar-sync` (motor
  cron, mesmo padrão `X-Khaos-Cron-Secret` do `telegram-notify`): PUSH antes
  do PULL em cada execução. PUSH lê as linhas `sync_dirty`, insere/atualiza/
  apaga no Google, grava o `extendedProperties.private.khaos_event_id`. PULL
  faz `events.list` com `singleEvents=true` (o Khaos não tem RRULE — um
  evento recorrente do Google vira instâncias separadas), reconcilia por
  `google_event_id`, recupera de um `410` sem apagar eventos locais, e trata
  evento de dia inteiro como `[00:00 local, 00:00 do dia seguinte)`.
  **Conflito: Google sempre vence** (um compromisso fixo é um fato combinado
  com terceiros) — a edição local perdedora é descartada e registrada em
  `google_calendar_sync_log` com `action='conflict'`, nunca silenciosamente.
  Um detalhe de implementação não previsto no plano original e corrigido
  durante a implementação: como o trigger força `sync_dirty=true` sempre que
  `name`/`duration`/`event_type`/`deleted_at` mudam — mesmo quando é o
  próprio PULL escrevendo esses campos —, cada mutação do PULL usa uma
  segunda escrita (só `sync_dirty=false`, sem tocar colunas observadas) para
  realmente limpar a marca, senão a próxima execução reenviaria o dado
  idêntico ao Google e poderia re-notificar os participantes de um "update"
  vazio. Ver o cabeçalho de `google-calendar-sync/index.ts` para o raciocínio
  completo.
- **Frontend** — `database.types.ts` editado à mão (sem `supabase gen
  types` neste ambiente — sem instância linkada); `types.ts` herda sozinho.
  `events.ts`/`useEvents.ts` não precisaram de mudança (`select('*')` já
  traz as colunas novas; nenhum patch as sobrescreve). Badge discreto
  (`Link2`) nos blocos do `CalendarView` e no `EventModal` para eventos com
  `google_event_id` — continuam editáveis no Khaos, editar e empurrar de
  volta é o ponto de ser bidirecional. `CalendarPage` ganhou uma faixa de
  status no cabeçalho (`useGoogleCalendarStatus` → RPC
  `google_calendar_status()`): conectado/desconectado, último sync, último
  erro.
- **Documentação** — `docs/01-database.md` (colunas novas, tabelas novas,
  trigger, RPC), `docs/04-setup.md` (projeto Google Cloud, OAuth client,
  escopo, secrets, aviso de publicar a tela de consentimento),
  `docs/05-roadmap.md` (registrado em Concluído),
  `supabase/functions/google-calendar-sync/README.md` novo (setup completo,
  pg_cron, verificação manual).

**Fora de escopo, registrado para não se perder:** botão "Sincronizar agora"
na UI (o browser não tem, e não deve ter, o cron secret — não há Supabase
Auth para gatear uma rota interativa); push notifications do Google (watch
channels) no lugar do poll a cada ~5 min; sincronizar mais de um calendário;
mapear calendário do Google para um `field` do Khaos; e recorrência real
(RRULE) em vez de instâncias importadas.

**Verificação.** Não há suíte de testes neste repo (confirmado:
sem vitest/jest, sem `*.test.ts`, sem script `test` em `package.json`) —
conforme `CLAUDE.md`, nenhuma foi criada. `npm run typecheck`, `npm run
lint` (zero warnings) e `npm run build` limpos. `deno check
--node-modules-dir=auto` limpo nas duas Edge Functions novas (contra o
`import_map.json` do repo). **Não verificado neste sandbox, por exigir uma
instância Supabase linkada e credenciais reais do Google:** aplicar as
migrations (`npm run db:push`), o teste manual do trigger via SQL (inserir/
atualizar um evento `fixed` e confirmar `sync_dirty`), o `npm run db:dump` (
para atualizar `schema.sql`/`_shared/schema.sql.ts` — feito à mão nesta PR
em vez disso, ver nota abaixo), e o teste ponta a ponta contra um calendário
Google real (criar/mover/apagar dos dois lados, dia inteiro, recorrência,
recuperação de `410`, execução concorrente, e a asserção central: um evento
`scheduled` ligado a uma task nunca aparece no Google em várias rodadas de
cron). Recomendo rodar esse roteiro manual depois do merge, antes de
aprovar o item.

**Nota sobre `schema.sql`:** `npm run db:dump` precisa de um projeto Supabase
linkado, que não existe neste ambiente de implementação. `schema.sql` e
`supabase/functions/_shared/schema.sql.ts` foram atualizados à mão para
refletir as duas migrations novas, para o `search_schema` do agente já
reconhecer as colunas/tabelas novas; rodar `npm run db:dump` de verdade após
o merge, contra o projeto real, é o jeito correto de confirmar que a cópia à
mão bate com o schema de fato.

**Nota sobre changelog e versão:** não há `CHANGELOG.md` neste repo — o item
[No changelog — rebuild it from the git history](#no-changelog--rebuild-it-from-the-git-history)
registrou essa dívida em 2026-09-30 e decidiu explicitamente reconstruí-lo
depois, não nesta mudança, então não há arquivo para atualizar aqui. O bump
de versão em `package.json` também não é manual: é automatizado por
`.github/workflows/bump-version.yml` a cada merge em `main` (ver "Release
versioning" em `supabase/functions/telegram-bot/README.md`) — bumpá-lo à mão
nesta PR colidiria com esse workflow. Nenhum dos dois foi tocado aqui por
estarem fora do escopo real deste PR, não por omissão.

**Revisão automatizada do PR #89 (2026-10-13).** Revisão só do diff, sem o
contexto das decisões tomadas durante a implementação.

Corrigido direto no branch do PR (sem mudança de comportamento):

- ~~`[functions.google-calendar-sync]` em `supabase/config.toml` não tinha
  `import_map`~~ — toda função que importa um especificador bare o declara
  (`telegram-bot`/`telegram-notify`/`oversight-agent`), e não existe
  `deno.json` de projeto; sem essa linha o `supabase functions deploy`
  não resolveria `@supabase/supabase-js`. O deploy quebraria, não a
  typecheck local (que resolve via `node_modules`).
- ~~Parsing de `tstzrange` duplicado~~ — `parseRange`/`rangeLiteral` saíram
  de `google-calendar-sync/index.ts` para
  `supabase/functions/_shared/range.ts`, junto com o `parseRangeLower` que
  era uma terceira cópia dentro de `telegram-notify/index.ts`; as duas
  funções agora importam de lá.
- ~~Boilerplate repetido em `google-calendar-sync`~~ — `eventPath()` para a
  URL de um evento do Google (4 ocorrências), `patchEvent()` para o
  `update(...).eq('id', ...)` em `events` (5 ocorrências) e
  `conflictDetail()` para a string de conflito (2 ocorrências).
- ~~`text-xs` na faixa de status do `CalendarPage`~~ → `text-caption`, que é
  o token do design system (165 usos no `src/`, contra 15 de `text-xs`) e o
  que o próprio `EventModal` desta PR usa.

Como a PR #89 **já estava merged** (merge commit `20b59a3`, 2026-10-13
05:17Z, seguido do `chore: release v3.0.1`) quando a revisão rodou, esses
quatro consertos não cabiam mais no branch dela: foram para um PR de
follow-up a partir do `main`. Os achados bloqueantes abaixo estão como
comentários de revisão na #89, ancorados no commit `81ce453`.

Achados **bloqueantes** comentados no PR, para o usuário decidir:

1. **A fila de push não tem claim.** `runPush` lê as linhas `sync_dirty` e só
   limpa a marca depois do round-trip ao Google. Duas execuções sobrepostas
   (o cron é a cada 5 min e o `waitUntil` responde 200 na hora, então
   sobreposição é possível assim que uma rodada passar de 5 min) fazem dois
   `POST` para a mesma linha e deixam um evento órfão no Google; e uma edição
   do usuário que caia entre o `SELECT` e o `update` final é perdida para
   sempre (`sync_dirty` volta a `false`). Opções: lock de execução
   (`pg_try_advisory_lock`), ou claim por linha antes do push.
2. **O full sync é um N+1 sem progresso persistido.** Cada item do `pull` faz
   seu próprio `SELECT` + 2–3 writes, e o `sync_token` só é gravado no fim de
   todas as páginas; com `singleEvents=true` e sem `timeMax`, um calendário
   com recorrências gera milhares de instâncias — se a execução estourar o
   tempo da Edge Function, nada é gravado e o full sync recomeça do zero
   indefinidamente. Opções: batelada por página, progresso resumível, ou
   limitar o full sync com `timeMax`.
3. **Evento de dia inteiro vira evento com hora no round-trip.** O `pull`
   importa dia inteiro como `[00:00, 00:00 do dia seguinte)`; qualquer edição
   local depois disso faz o `push` mandar `start.dateTime`/`end.dateTime`, e
   o Google converte o evento de dia inteiro em evento com hora — para todos
   os participantes. Opções: registrar a all-day-ness numa coluna, inferir
   pelos limites, ou mandar no `PATCH` só os campos que mudaram.
4. **A afirmação de que importar em massa não cria `moments` é falsa.**
   `trg_moment_scheduled` não descarta eventos sem `task_id`/`project_id`:
   cai no ramo `else v_column := 'event_id'` e grava o moment mesmo assim
   (`insert_moment` aceita `'event_id'` na whitelist). Cada evento importado
   gera um `moments` do tipo `scheduled`, e cada mudança de `duration` vinda
   do `pull` gera outro. O `oversight-agent` escapa por acidente (não
   seleciona `event_id`, então `entityRef()` devolve `null` e ele pula a
   linha), mas o raciocínio registrado na investigação acima e a verificação
   manual do README estão errados.
5. **O bump manual de `package.json` para 3.0.0** contradizia a própria nota
   desta PR e o `.github/workflows/bump-version.yml` (que faz `version patch`
   a partir do `main` depois do merge), e deixou o `package-lock.json` em
   2.1.2. Já consumado: o workflow patchou o 3.0.0 manual e o `main` saiu em
   **3.0.1**, pulando a linha 2.x inteira sem nenhuma decisão de major
   registrada (o lockfile se corrigiu sozinho, porque o workflow commita os
   dois). Resta decidir se 3.0.1 é a versão desejada ou se vale um
   `3.0.x`→ correção explícita, e manter o bump fora das PRs.

**Verificação da revisão.** `npm run typecheck`, `npm run lint` (zero
warnings) e `deno check` limpos depois dos quatro consertos acima. Nota: o
`prettier --check` já acusava `google-calendar-sync/index.ts` e
`CalendarPage.tsx` **antes** desta revisão (o script `format` só cobre
`src/**/*`, e o gate de CI é só o eslint), então o estilo dos dois arquivos
foi deixado como estava em vez de reformatar e inflar o diff.

---

## Assistente sugere projeto, seção e estimativa ao criar tarefa

Hoje, se o usuário pede "cria uma tarefa X" sem dizer projeto/seção, a IA
insere direto: `section_id` e `estimate` são ambos nullable no schema, então
o insert passa sem erro e o resultado é uma tarefa órfã (sem seção) e sem
estimativa — sem nenhum aviso. O prompt (`SYSTEM_INSTRUCTION`) nunca cobria
esse caso, e as tools disponíveis eram só as genéricas de CRUD, sem
agregação — derivar "quanto costuma levar algo parecido" por `query_rows`
bruto custaria várias rodadas de tool use contra o teto `MAX_TOOL_ROUNDS = 6`.

Duas tools de leitura novas em `toolsCore.ts` (compartilhadas pelo app web e
pelo bot do Telegram, já que ambos importam o mesmo módulo):

- `suggest_task_placement({ name, limit? })` — devolve a hierarquia ativa
  (field→project→section, não deletada, status fora de done/cancelled) com
  contagem de tarefas abertas e última atividade por seção/projeto como
  critério de desempate. Deliberadamente sem score lexical — o casamento do
  nome com as seções/projetos é feito pelo próprio modelo, já que os nomes
  misturam português e inglês.
- `suggest_task_estimate({ name, section_id?, project_id? })` — cascata de
  base de comparação (mesma seção → mesmo projeto → `work_tag` em comum via
  `work_tag_entities` → palavras do nome), soma os `task_logs` fechados das
  tarefas `done` encontradas e devolve mediana/média de minutos reais, a
  mediana do `estimate` dessas tarefas, até 10 amostras, e qual base foi
  usada — ou `{basis: 'none', n: 0}` quando não há nada comparável.

Novo bloco no `SYSTEM_INSTRUCTION` ("TASK CREATION — PLACEMENT AND
ESTIMATE"): ao criar tarefa sem projeto/seção, chamar `suggest_task_placement`
antes de inserir, propor a melhor colocação + até duas alternativas numa
linha curta, com a estimativa de `suggest_task_estimate` sempre dizendo a
base (ou marcando como chute quando `n = 0`), e só criar depois da
confirmação. Dois atalhos para criar direto, só informando a escolha: o
usuário já disse algo como "só adiciona", ou o prefixo `[UI Context: user is
currently looking at ...]` (que o `useChatAgent.ts` já injeta, mas que o
prompt nunca explicava) já aponta um projeto/seção. Se nada servir, a IA
propõe criar uma seção/projeto novo ou deixar a tarefa sem seção, nunca
escolhendo em silêncio. Ao gravar `estimate`/`section_id` a partir dessas
sugestões, o `reason` passado documenta a base, fechando com a regra de
`reason` que já existia para o `moment_note`.

Fecha uma fatia do item "Aprendizado histórico" do roadmap (sugestão de
estimativas a partir de `task_logs`) sem contradizer nada já registrado ali
— ver `docs/05-roadmap.md`. Fora de escopo: `QuickAddBar`/`quickAdd.ts`
(parsing client-side sem IA), qualquer RPC ou migração nova, e `section_id`
segue nullable (tarefa sem seção continua válida).

Verificação: `npm run typecheck`, `npm run lint` e `npm run build` limpos
(sem suíte de testes no repo); `deno check
supabase/functions/telegram-bot/index.ts` limpo, confirmando que
`toolsCore.ts` continua sem imports de runtime e bundla no Deno sem a
extensão `.ts` explícita. Checagem manual do fluxo completo (pedir tarefa
sem projeto, com `[UI Context]` aberto, com seção explícita, e com nome sem
histórico comparável) ainda pendente — fica para quem revisar o PR testar no
app/Telegram antes de aprovar.

---

## Resolved

| title | started | resolved |
|---|---|---|
| [Forge — second critique round](#forge--second-critique-round) | 2026-07-23 | 2026-07-23 |
| [Forge — missing inputs, divider, chevron](#forge--missing-inputs-divider-chevron) | 2026-07-23 | 2026-07-23 |
| [The Emblem — icon/logo/wordmark polish](#the-emblem--iconlogowordmark-polish) | 2026-07-23 | 2026-07-23 |
| [Sequence rail — sometimes not visible](#sequence-rail--sometimes-not-visible) | 2026-08-12 | 2026-08-14 |
| [Unify target pill + input view](#unify-target-pill--input-view) | 2026-09-19 | 2026-09-19 |
| [PWA app icon — Chrome no macOS](#pwa-app-icon--chrome-no-macos) | 2026-09-30 | 2026-09-30 |
| [Cmd + Enter should submit and close the task modal](#cmd--enter-should-submit-and-close-the-task-modal) | 2026-10-12 | 2026-10-12 |

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

### PWA app icon — Chrome no macOS

2026-09-30 → 2026-09-30 · approved by the user

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

~~**Visual check across the macOS surfaces — confirmed 2026-09-30.**~~ The user
reported the icon correct in the Dock, Launchpad, Spotlight and Cmd+Tab.

Nothing technical was left outstanding, and the user approved the item on
2026-09-30.

Roadmap check: `05-roadmap.md` lists the PWA under "Concluído" and puts a
native mobile app explicitly out of scope. This only hardens the existing PWA,
so it contradicts no registered phase.

### Cmd + Enter should submit and close the task modal

2026-10-12 → 2026-10-12 · approved by the user (merge of
[PR #83](https://github.com/sei-xu/khaos/pull/83))

Pedido do usuário: Cmd+Enter (ou Ctrl+Enter) deve "submeter e fechar" o
modal de detalhe de task — hoje só funcionava no modal "New task" do
QuickAddBar.

`Modal` (`src/components/common/ui.tsx`) já tinha o atalho — se a prop
opcional `onSubmit` existisse, Cmd/Ctrl+Enter chamava e fechava — mas
`TaskDetailModal.tsx` nunca passava `onSubmit`, porque salva campo a campo
(debounce de 500ms + flush no blur) em vez de ter uma ação de "save" única.

Mudanças:

1. `TaskDetailModal.tsx` ganhou `submitAndClose()`: tira o foco do elemento
   ativo dentro do modal (reaproveita todo caminho de commit por `onBlur` —
   nome, estimate, item de checklist, log de tempo — sem duplicar lógica),
   chama `flushName()`/`flushEstimate()` como rede de segurança para o
   debounce ainda pendente, cria o item pendente em "Add a task item..." (
   extraído de `addItem` para `createPendingItem()`, reusado pelo `<form>`
   normal) e só então chama `onClose()`. Passado como `onSubmit` do
   `<Modal>`.
2. `Modal` (`ui.tsx`) passou a exigir que o Cmd/Ctrl+Enter se origine
   dentro do dialog (`dialogRef.current?.contains(e.target)`) — o listener
   é global no `document`, e o composer do `ChatPanel` (sempre montado no
   rail direito) também usa Cmd+Enter; sem essa checagem, um Cmd+Enter no
   composer dispararia o submit do modal de task aberto por cima.

Verificação: `npm run typecheck`, `npm run lint` e `npm run build` limpos
(sem suite de testes no repo). Manual no `npm run dev`, numa task real:
editar o campo Estimate e apertar Cmd+Enter antes dos 500ms do debounce —
modal fechou e o valor novo persistiu ao reabrir (confirmado por ciclo
completo: 60→75→reload→75→de volta a 60); digitar em "Add a task item..."
e Cmd+Enter — item criado e modal fechado (confirmado reabrindo, depois
removido o item de teste); Escape ainda fecha o modal normalmente. Não
testado via chat real contra o `ChatPanel` para evitar efeito colateral no
bot/dados do usuário — mas a sobreposição do modal (`z-50`, cobre a tela
inteira) já impede o composer de receber o Cmd+Enter enquanto o modal está
aberto, o que a mudança 2 reforça para qualquer handler global futuro.

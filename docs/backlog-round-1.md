# Backlog — Round 1 · Foundations (closed)

**Closed archive.** Round 1 (Cosmogony — the token layer: Pantheon /
Chorus / Wellspring) is finished; nothing here is open. Migrated on
2026-09-30 from the "Round 1 — Foundations backlog" Artifact, which is now
frozen. Current work is tracked in [`backlog.md`](./backlog.md) (Round 2 ·
Theurgy), following the Ḫprj methodology (`hprj/docs/methodology.md`).

Items are in the order they were resolved. Dates are start → resolved.

| title | started | resolved |
|---|---|---|
| Variable Slab upload | 2026-07-13 | 2026-07-14 |
| Vault → "Khaos Vortex" rename | 2026-07-13 | 2026-07-13 |
| `--font-serif` not loading | 2026-07-13 | 2026-07-13 |
| Uppercase raw token names | 2026-07-13 | 2026-07-13 |
| Realistic sample content | 2026-07-13 | 2026-07-13 |
| Contrast + hue fixes | 2026-07-13 | 2026-07-13 |
| `--font-body` not loading | 2026-07-13 | 2026-07-13 |
| Missing nav between pages | 2026-07-13 | 2026-07-13 |
| KhaoticText not stretching | 2026-07-13 | 2026-07-13 |
| KhaoticText on all titles | 2026-07-13 | 2026-07-15 |
| Icon spin/pulse + light color | 2026-07-13 | 2026-07-14 |
| Header nav — full roman row | 2026-07-13 | 2026-07-14 |
| Home logo — dark but visible | 2026-07-13 | 2026-07-14 |
| Multi-family text + drifting gradient | 2026-07-13 | 2026-07-14 |
| Inline nav reveal on hover | 2026-07-13 | 2026-07-14 |
| Stripped remaining bg/border/padding | 2026-07-13 | 2026-07-14 |
| Standardized chamber widths | 2026-07-16 | 2026-07-16 |
| Shimmer — one band, not per character | 2026-07-16 | 2026-07-16 |
| Museum chrome (no sidebar/chat) | 2026-07-13 | 2026-07-16 |
| Roboto Flex vs Inter — dropped Inter | 2026-07-15 | 2026-07-16 |
| Wellspring — trim, audit, document | 2026-07-13 | 2026-07-16 |
| Type scale (The Chorus) | 2026-07-13 | 2026-07-16 |
| Vortex in Vercel previews | 2026-07-17 | 2026-07-17 |
| Pantheon page (The Pantheon) | 2026-07-13 | 2026-07-17 |
| Spacing scale (the ladder) | 2026-07-16 | 2026-07-17 |
| Wire the type scale into the real app | 2026-07-16 | 2026-07-17 |
| Normalize the spacing half-steps | 2026-07-17 | 2026-07-17 |
| The great rename — CSS vars to deities | 2026-07-17 | 2026-07-17 |
| Complete The Forge | 2026-07-17 | 2026-07-23 |
| Vortex index — Cosmogony / Theurgy parts | 2026-07-23 | 2026-07-23 |

---

## Variable Slab upload

2026-07-13 → 2026-07-14

The user uploaded a variable Roboto Slab file
(`RobotoSlabVariableFont_wght.ttf`). Inspected the real `fvar` table with
fonttools instead of trusting the filename: **wght 100–900 only, no wdth
axis** — the same font as the Google one, already loaded in the app. The
answer was definitive: this file changes nothing for `KhaoticText`.

## Vault → "Khaos Vortex" rename

2026-07-13 → 2026-07-13

The Vault started as one long scrolling page that got unwieldy as
sections were added. Replaced with an index + 6 chambers, numbered I–VI,
each its own route, sharing a chrome kit in `vaultUI.tsx`. No sidebar nav
inside it — the index list *is* the navigation.

Later renamed "The Khaos Vault" → **"Khaos Vortex"** everywhere it's shown
(index heading, corner placards, the Chorus type sample), then renamed
the URLs too: `/dev/vault/*` → `/dev/vortex/*`, with old links redirecting
to the dashboard. Internal file/component names still saying "vault" were
left as-is (no visible effect).

## `--font-serif` not loading

2026-07-13 → 2026-07-13

The token declared 'Roboto Serif', a font never imported; the installed
package is Roboto **Slab**. Worse, no class used `font-serif`, so Tailwind
v4 tree-shook it out entirely and it never reached the browser. Fixed:
pointed at 'Roboto Slab Variable' and switched to `@theme static` so every
token always emits, used or not.

## Uppercase raw token names

2026-07-13 → 2026-07-13

Raw identifiers (`--font-serif`, `ink`, …) went through the uppercase
micro-label style, obscuring the real lowercase name. Removed uppercase
from raw names only; section headers kept theirs.

## Realistic sample content

2026-07-13 → 2026-07-13

Font specimens showed their own class names as the sample text. Replaced
with real task-manager copy, then with Khaos-mythology sentences, matched
in length for fair comparison.

## Contrast + hue fixes

2026-07-13 → 2026-07-13

Computed real WCAG ratios and HSL hue distances with a script, not by
eye. `ink-500` failed AA at 2.94:1 — lightness raised 41% → 54%, same hue,
now passes. `copper` and `rust` sat 22° apart (risky for color-blind
users) — rust moved to 345°, now 42° apart, still unambiguously red.

## `--font-body` not loading

2026-07-13 → 2026-07-13

Declared 'Inter' with no `@fontsource` package installed, so body text
silently used system-ui. Installed the real package, pointed the token at
'Inter Variable', confirmed loading in a real browser check. (Inter was
later dropped — see "Roboto Flex vs Inter".)

## Missing nav between pages

2026-07-13 → 2026-07-13

Raised right after the museum redesign; turned out to be mid-flight, not a
bug. Resolved once the museum chrome landed: the exit mark + index list
is the whole nav.

## KhaoticText not stretching

2026-07-13 → 2026-07-13

Two stacked bugs. **1:** `family` defaulted to `''` and `??` doesn't fall
back on an empty string, so the random pick never ran and real usages
generated an invalid class, silently inheriting the ambient font.
**2:** two of the three fonts had no width axis (confirmed from each
font's own metadata). Fixed by always using Roboto Flex. Verified in a real
render: the same word measured 100px vs 271px between extreme classes.

## KhaoticText on all titles

2026-07-13 → 2026-07-15

Renamed `ChaoticText` → `KhaoticText` (file, export, both real usages)
and wired it into every Vault title: the index heading, all 6 chamber-row
titles, every chamber page's own heading.

Toned down later: italic was a 50/50 coin flip per letter and read as
constant flicker — reweighted to roughly 1-in-4. Then letters were fixed
in place and only the style changes, on a per-character random timer.
Multi-family (display/serif/mono) was added on the home hero, plus a
gradient shimmer option. Verified in a real browser render that weight and
width genuinely animate. Explained back to the user in plain terms
(per-letter independent timers; family/weight/stretch/italic randomized;
letters never change) and confirmed correct.

## Icon spin/pulse + light color

2026-07-13 → 2026-07-14

The corner logo and hero logo read as invisible — a color too close to the
ink-900 background. Confirmed both were the same `KhaosIcon` component.
Recolored lighter, added `spin` plus a layered `animate-pulse`, and
checked with real WCAG contrast math: landed on `ink-700`/`ink-400`
depending on context, the darkest step that still reads as present.

## Header nav — full roman row

2026-07-13 → 2026-07-14

The corner placard had no way to jump chambers. Replaced with all six
roman numerals, I–VI, each a real link, current chamber highlighted and
the rest dimmed. Superseded by the inline hover reveal (below) for hover
behavior.

## Home logo — dark but visible

2026-07-13 → 2026-07-14

Asked for the home hero logo in black over the title; built literally and
confirmed by screenshot; then "I think it's too dark." Pulled back from
pure black and repositioned above the title instead of overlapping it; the
same pullback was applied to the index roman numerals. Real contrast
ratios to pick the shade: `ink-800` on `ink-900` ≈ 1.12:1 (invisible),
`ink-700` ≈ 1.36:1 (barely-but-really there), `ink-600` ≈ 1.85:1 (clearly
visible). Landed on `ink-700` for both.

## Multi-family text + drifting gradient

2026-07-13 → 2026-07-14

The home hero title randomizes font family too (display/serif/mono per
character). Added a gradient-fill shimmer option to `KhaoticText`
(`shimmer` prop, applied per glyph span since `background-clip: text`
doesn't inherit onto a wrapper) and a slow drifting, blurred
radial-gradient backdrop looping between two ink shades over 12s.

## Inline nav reveal on hover

2026-07-13 → 2026-07-14

The first "show the chamber name on hover" attempt was an
absolute-positioned popup, explicitly rejected — wanted inline ("I II III
The Wellspring IV V VI"). Rebuilt as a sibling span next to each numeral,
collapsed to zero width by default and expanding in normal flex flow on
hover, pushing the following numerals over. Nav font matched to the site's
own title font.

## Stripped remaining bg/border/padding

2026-07-13 → 2026-07-14

Several chambers still had boxed sections (border + background + rounded
corners + padding), against the plain-museum look settled on elsewhere.
Removed the wrapping box treatment from the Foundations sections and the
Pantheon's "how they read together" block. Left on purpose: individual
token swatches (color chips, radius/shadow demo boxes), which need their
own box to demonstrate the token.

## Standardized chamber widths

2026-07-16 → 2026-07-16

A system-wide rule. First explained what `max-w-*` means (Tailwind's
max-width scale in real rem/px, e.g. `max-w-5xl` = 1024px; `max-w-prose`
is the exception, in `ch`, for paragraph readability). New rule across
every Vault page: index page `max-w-xl` → `max-w-lg`; chamber title block
always `max-w-4xl`, even inside a wide chamber; standard chamber content
`max-w-5xl` → `max-w-4xl`; wide content (e.g. Chorus's font specimens)
stays `max-w-6xl` via the existing `wide` prop on `Chamber`. Verified with
real renders of the index, Pantheon and Chorus. Pushed as `ed2d39b`.

## Shimmer — one band, not per character

2026-07-16 → 2026-07-16

The home hero shimmer ran the same animation, in sync, on every
character's own tiny background box — every letter showed the same color
at the same instant, a uniform pulse rather than a traveling band. Fixed
with a shared coordinate space: every character uses one fixed-px
gradient image and reads one animated CSS custom property
(`--shimmer-offset`, registered via `@property` so it interpolates
smoothly), each shifted by its own static per-character offset. Verified
via two screenshots 2s apart — the highlight visibly moved. Pushed as
`8340411`.

## Museum chrome (no sidebar/chat)

2026-07-13 → 2026-07-16

The Vault used to render inside `AppShell`, so the task sidebar + chat
panel still showed. Fixed at the routing level: every Vault route moved
outside `AppShell`, fully full-bleed with zero app chrome. The old header
(icon circle + "← Back to Vault") was replaced by one spaced corner
placard plus one subtle `×` exit mark. Nav model: a chamber's `×` → the
index; the index's `×` → the real app — two levels, always predictable.

The placard later grew a full roman-numeral row (I–VI, all linked, with
inline hover-reveal names that are themselves links; `8340411`). Index
page narrowed twice (`max-w-2xl` → `max-w-xl` → `max-w-lg`), nav numeral
spacing widened (`gap-3` → `gap-5`). The Wellspring index row's stale
"contains" line was fixed in passing (now "Radii · Shadows").

## Roboto Flex vs Inter — dropped Inter

2026-07-15 → 2026-07-16

While looking at the Chorus font samples, `--font-display` (Flex) and
`--font-body` (Inter) — both neo-grotesque humanist sans — were hard to
tell apart. Built a live test page (`/dev/vortex/font-test`): the same
sentence at 12px/14px in both, Flex again at `font-stretch-condensed`, and
real UI context (task row, sidebar item, chat bubble, caption).

**Decision: drop Inter.** At live sizes the two read as functionally
identical; condensed Flex was rejected too (too tight for body copy).
`--font-body` now points at Roboto Flex Variable; the
`@fontsource-variable/inter` package and import were removed; the scratch
`font-test` page and route were retired. Verified `/tasks` unaffected.
Down to 3 families: Flex, Slab, Mono. Pushed as `c3caf4a`.

## Wellspring — trim, audit, document

2026-07-13 → 2026-07-16

Wellspring (III) still showed colors (fully duplicated by The Pantheon)
and fonts that belonged with the Chorus. Trimmed to radii + shadows
(`fc089c0`). Checked "can't we count on Tailwind defaults?" against the
real scale and corrected a wrong first read along the way: bare `--radius`
is load-bearing across ~25 real components (not a safe drop), while
`--radius-sm` was safe and got dropped (`ffb04ea`). Added usage-guideline
tables (when to use which radius/shadow) grounded in actual app usage
(`c220bcc`), then a visual restyle to match the rest of the Vortex — live
swatches, deity-borrowed colors, "Used in:" lines, bordered rows
(`a18f5f5`).

User's read: "still boring, but a good guide" — approved as the working
structure, with the explicit expectation that this chamber keeps growing;
future guide content lands as new backlog items rather than reopening
this one.

## Type scale (The Chorus)

2026-07-13 → 2026-07-16

Five tokens formalized from the app's real ad-hoc sizes: `text-label` 10 /
`text-caption` 12 / `text-body` 14 / `text-display` 18 /
`text-display-lg` 24 — ratios 1.17–1.33, the same family as musical
intervals (octave/fifth/fourth land exactly on real token pairs).

The Chorus chamber went through many passes: a strings graph with deity
initials, interval squares rebuilt on the real ratios (Octave A:E, Fifth
A:P, Fourth P:E — "Third" dropped since it lands on no real pair), a
3-column bottom-aligned layout, fonts folded in from Wellspring. The
samples took three tries: one sentence → two stacked (read as a wrapped
title) → **"The scale in motion"**: one realistic Khaos screen fragment
using all five steps, each line annotated with its token in the gutter,
deity-colored — cover the annotations and the structure still tells you
what each line is. Approved; last push `5f6fb67`. Wiring the tokens into
real components was split out as its own item (see "Wire the type scale").

## Vortex in Vercel previews

2026-07-17 → 2026-07-17

The `/dev/vortex` routes were gated behind `import.meta.env.DEV` —
invisible on Vercel, which builds in production mode. User's call: the
whole app already runs behind the password gate (`PasswordGate` wraps
everything in `main.tsx`), so no flags. Removed the DEV gate; verified
against a real production build (`25da913`).

Then still 404 on Vercel for a different cause: the repo had no
`vercel.json`, so deep links to any client-side route 404ed (the same
would have hit `/tasks` on a hard refresh). Added the standard SPA
fallback rewrite (everything → `index.html`), `22f3ffd`.

## Pantheon page (The Pantheon)

2026-07-13 → 2026-07-17

The 7 color families renamed after primordial deities: Nyx / Aether /
Eros / Pontus / Gaia / Tartarus / Hypnos. Chamber built with circle-coin
swatches, per-deity stories, icons in the left gutter, prose-width text.

Two real accessibility fixes came out of it (ink-500 contrast,
copper/rust hue distance), plus the **warning decision**: caution =
Tartarus-300 (`#dc8fa5`, 7.0:1 — a lightness step, not a new hue, since an
amber would collide with Eros for colorblind users). Escalation: Gaia →
Tartarus 300 → 500, "growth, drifting, gone."

Samples section "When the gods share a screen": every deity has a role row
(Base, Caption, Lifted, Action, Info, Quiet, Success, Warning, Danger),
each a vertical block — role title, description, the sample rendered big,
contrast math as a subtitle; all ratios computed. Approved; last push
`907fe2f`. The CSS-variable rename split out as its own item.

## Spacing scale (the ladder)

2026-07-16 → 2026-07-17

The third style-guide pillar after color and type. Audited real usage
first (grep across app code, dev pages excluded): gap-1/1.5/2/3 already
carry ~80% of 180+ usages. Named the emergent ladder — **hairline** 2 /
**tight** 4 / **snug** 6 / **element** 8 / **group** 12 / **block** 16 /
**shell** 24 — and built it into Wellspring as "The spacing ladder": each
role shown as two blocks separated by the actual distance, the gap tinted.
Half-step noise (10/14px, ~40 usages) documented as normalization
candidates. Approved; pushed as `907fe2f`. The two open decisions were
split out (see "Normalize the spacing half-steps").

## Wire the type scale into the real app

2026-07-16 → 2026-07-17

Split out of the type-scale item. **Slice 1:** the five tokens added to
`@theme` with line-heights matching the classes they replace, verified at
exactly 10/12/14/18/24px (`338f79c`). **Slice 2:** 30 app files swept onto
the tokens (2xl→display-lg, lg→display, sm→body, xs→caption,
[10px]→label), verified pixel-neutral numerically; the wordmark, icon
glyphs and off-scale strays (16/11/9px) were deliberately left as
normalization candidates (`527f08b`). Mapping documented on the Chorus page
("The wiring") with a live sample per token (`acdd046`). Approved.

## Normalize the spacing half-steps

2026-07-17 → 2026-07-17

Split out of the spacing item: normalize the 10px/14px half-steps, and
should ladder names become tokens? Ladder names stay documented
convention — plain Tailwind classes, no parallel naming layer. Half-steps
were snapped across 21 app files in one pass (a small, mechanical regex
swap verified by build + screenshot, not page-by-page as first planned):
**2.5 → 2** (10px → element 8px), **3.5 → 4** (14px → block 16px), on
gap/space/padding/margin only — dimensions (`h-3.5`/`w-3.5`) untouched.
Pushed as `f7e9926`. Approved with a caveat: with no per-page visual
review, if a spot reads cramped it gets fixed individually.

## The great rename — CSS vars to deities

2026-07-17 → 2026-07-17

Split out of the Pantheon item: deity names lived only in display copy.

**Mechanical half:** every CSS variable and utility class across 42 files
— ink→nyx, fog→aether, copper→eros, teal→pontus, sage→gaia,
rust→tartarus, violet→hypnos. Same hex values, verified pixel-identical
(`fb171a7`).

**`STATUS_META` went through two models.** v1 was a flat per-status deity
assignment; the user proposed a better one: group by what each status
asks of the *user*. Final model, applied:

- **Calls you to act** (planning/todo/in_progress): all Eros, heat rising
  600→500→400.
- **Waiting**, softest to hardest: in_review → Pontus 400 (others act),
  waiting → Hypnos 400 (asleep till its turn), paused → Nyx 500 (hard
  stop, drained).
- **Closed:** done → Gaia 500. Cancelled was corrected mid-review — not
  Tartarus/danger ("if it's cancelled, it's dead") — landed on Nyx 600,
  more muted than paused. Danger stays reserved for things still actively
  going wrong.

Proposed as a visual artifact (v1 → v2 → v3) before touching code, every
status rendered today-vs-proposed with real hexes. Applied to
`STATUS_META` (`49d5c11`); documented on the Sigils page, "How status
color reads" (`0d8cf01`). This closed Round 1's finale trio: colors,
sizes and spacing are all named, ruled and wired.

## Complete The Forge

2026-07-17 → 2026-07-23

Last ask before closing Round 1: fill in the missing elements — label,
add/remove, toggle, checkbox — sourced from where they actually live in
the app (`TaskDetailModal`, `CalendarView`), not invented. Added: field
label, the bordered-pill add button, the checklist inline-add row, the
remove/close (×) pattern (hover → danger), a checkbox with
`accent-eros-500`, and a live toggle switch (from "show logged time").
Kept as raw inline patterns, not new shared components — that
consolidation (component consolidation) was parked for Round 2, which now had a real
inventory to build from. Pushed as `cce82c2`.

**Follow-up critique round, same day** — the user caught real gaps after
the "done" declaration:

- `Select` vs `TextInput` rendered at different heights
  (`px-2/py-1.5` vs `px-3/py-2`) — aligned.
- No control except `Button` had `disabled:` styling — added to
  `Select`/`TextInput`, plus disabled swatches for
  button/input/select/checkbox/toggle.
- The remove(×) swatch's hover-to-danger silently didn't work (the hover
  class was on the wrapping button, but the icon's own static color class
  won) — moved onto the icon, matching the real `TaskDetailModal` pattern.
- Checked every real "add" usage app-wide: none were icon-only, so the
  add/remove asymmetry was real, not an oversight, and was documented
  (this claim was later corrected — see *Forge — second critique round* in `backlog.md`).
- Documented why add/remove stays muted (Eros reserved for "needs you",
  not "always visible") and why the one toggle was Pontus (inherited from
  pre-rename teal, never a deliberate call — since revised, see *Components — column chips* in `backlog.md`).

Also swapped the chamber order: **Forge is now IV, Sigils is V** —
primitives before the marks built with/around them — in both
`vaultUI.tsx`'s nav array and `VaultIndexPage.tsx`'s chamber list, kept in
sync by hand per the existing convention. Typecheck, eslint (0 warnings)
and build clean. Pushed as `0e48f58`, confirmed on the remote.

## Vortex index — Cosmogony / Theurgy parts

2026-07-23 → 2026-07-23

The user's idea: I–IV reads as a natural "Part I" grouping. My take: I–III
(Pantheon/Chorus/Wellspring) is the pure token layer; Forge and Sigils
are peers, neither more foundational — proposed **I–III / IV–VI** (a clean
3/3 split) over the user's I–IV / V–VI cut. The user rejected "Part I /
Part II" as too flat for a Vortex and wanted real khaos-themed names:
**Cosmogony** (I–III, where color/type/space are born from nothing) and
**Theurgy** (IV–VI, the gods' working of them — marks inscribed, tools
forged, the threshold opened). Rejected alternates: *Genesis* (too
biblical for a Greek-primordial set), *Ex Nihilo* (Latin, breaks naming
consistency).

**Cosmogony approved by the user directly.** Both part headers were built
into `VaultIndexPage.tsx` — a `partOpener` field on the first chamber of
each part, rendered as a small serif name + mono tagline row above that
chamber's link. Verified via a real Playwright screenshot of
`/dev/vortex`. Pushed as `b49aef0`, confirmed on the remote.

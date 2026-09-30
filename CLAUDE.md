# Working with the user

## Build, lint and test commands

React/Vite/TypeScript frontend backed by Supabase. Always run via the `npm run <script>` below — don't infer the command from the file layout:

- **Build**: `npm run build` (`vite build`).
- **Typecheck**: `npm run typecheck` (`tsc --noEmit`).
- **Lint**: `npm run lint` (`eslint . --ext .js,.jsx,.ts,.tsx --max-warnings 0` — zero warnings tolerated, not just zero errors; `npm run lint:fix` to auto-fix).
- **Test**: **no test suite is configured** — no vitest/jest, no `*.test.ts` files, no `test` script in `package.json`. Don't invent one; verification here is typecheck + lint + manual/browser check.
- **Format**: `npm run format` (`prettier --write`, not `--check` — it mutates; rules in `.prettierrc`: single quotes, `trailingComma: es5`, plus `prettier-plugin-tailwindcss` for class sorting).
- **DB**: `npm run db:migration:new` (new Supabase migration), `npm run db:push` (push to linked project), `npm run db:dump` (dump remote schema to `schema.sql` + regenerate the edge-function schema via `gen:edge-schema`).

Style convention beyond the language default: `strict` + `noFallthroughCasesInSwitch` in `tsconfig.json`; `@typescript-eslint/consistent-type-imports` is a warning (prefer `import type`); `no-console` warns except `console.warn`/`console.error`.

## Feature backlog tracking

Follows the Ḫprj methodology (`~/Systems/seixu/hprj/docs/methodology.md`,
phases 6–7 "Revisão / PR" and "Registro"): the backlog is a **versioned
Markdown file in this repo**, not an Artifact, and it is edited **in the same
PR as the code it describes** — never as a separate step afterwards, and
never only in chat (chat doesn't survive context compaction).

- **`docs/backlog.md`** — the live backlog (currently Round 2 · Theurgy):
  an "Open" table + one section per item, then a "Resolved" table + one
  section per item. Its header restates these conventions; keep them in sync
  if this section changes.
- **`docs/backlog-round-1.md`** — closed archive of Round 1. Read-only
  history; don't add to it. When a round closes, its file is renamed to
  `docs/backlog-round-N.md` and a fresh `docs/backlog.md` is started.
- **`docs/05-roadmap.md`** — roadmap phases. Per the methodology, a change
  must not contradict a phase the roadmap already registers, especially one
  not built yet; if it would, say so explicitly instead of doing it silently.
- The old Artifacts ("Round 1 — Foundations backlog", "Round 2 — Theurgy
  backlog") are frozen and no longer updated. Don't republish them and don't
  create a new backlog Artifact.

Each item in `docs/backlog.md`:

- Gets a distinct **three-character keyword code**, uppercase, memorable,
  unique within the file (e.g. `FNT`, `NAV`, `PAN`). The user replies with
  just that code to call up, discuss, or act on that item — no need to
  repeat the whole request.
- Gets a **severity marker**, hospital-triage style — emoji only, don't also
  spell out the color name next to it (redundant):
  - 🔴 critical / blocking, needs immediate attention
  - 🟠 urgent, high priority
  - 🟡 standard priority
  - 🟢 low priority / nice-to-have
- Gets a **start date** (when the item was opened) and, once resolved, an
  **end date** — history is kept, so both dates matter.
- Moves to the "Resolved" table (don't delete — keep history) once the user
  says **"approved"** for that code, with its end date recorded. The code is
  then free to be reused for an unrelated future item.
- A new item is added when the user's message starts with **`NEW`** — assign
  the next unused code, an initial severity marker (ask if unclear), and
  today's date as the start date.
- **Also add items proactively, not only on `NEW`.** Anything that becomes a
  real pending task — something waiting on the user (a file to upload, a
  decision, a review), or a genuine open thread that isn't resolved in the
  same turn it comes up — gets added right away, on its own initiative, even
  without the literal word `NEW`.
- If the user replies with a code, treat that as their call on what it refers
  to even if it doesn't exactly match the file — note the mismatch briefly
  rather than blocking on it.
- **Treated items move to the end of the list.** When an item gets worked on
  (reopened, updated, discussed) in a turn, move it to the bottom of its
  table and its section order once that turn's work is done — "most recently
  touched" order, not first-added order.

Format: Markdown. The index table has one row per item (code linking to the
item's `##` section, title, severity, start date; Resolved adds the end
date). Each item section is real detail, not a one-line stub — enough that
the user can tell what happened without re-reading the chat — in short
paragraphs (2–4 sentences) or short bullet lists, never one dense block.
Anything substantive said in chat (a decision, a recommendation with a take,
a list of next steps, an explanation the user asked for) is recorded in the
relevant item the same turn it comes up.

A sub-part of an item can be done while the item as a whole stays open. Wrap
that finished slice in `~~…~~` (strikethrough) rather than deleting it or
waiting for the whole item to resolve.

## Self-verify pushes with a pull

After pushing a commit, `git pull` (or `git fetch` + compare) in this working
checkout to confirm the push actually landed on the remote branch before
telling the user it's ready — don't just trust that `git push` exiting 0 means
the state is what's expected. Do this automatically, without being asked each
time.

This is a check on *this* sandbox's checkout, not the user's local machine —
those are separate checkouts on separate hardware; there is no way to run
`git pull` on the user's computer from here. If the user is checking out the
branch locally, they still need to run their own `git pull`.

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

Superseded the old inline-numbered-topic scheme (`1a`, `2`, `NEW`, etc. spoken in
chat) — chat-only tracking doesn't survive context compaction. Instead:

The canonical record is a custom-HTML dark-themed Artifact (not a repo file,
not a plain-rendered .md — a hand-built table). Republish to the same URL on
every update rather than minting a new one. This has flipped a few times
already (repo file vs. Artifact, table vs. list) — **this is the settled
answer, don't revisit the format again without being asked.**

Format: a table, one row per item, columns for marker/code/title/description
/dates. Inside the description cell, write in very short fragments — a
handful of words per line, `<br>` after nearly every one, blank `<br><br>`
between thoughts. Do not write flowing paragraphs or multi-sentence lines
inside a cell; dense text in a narrow cell is what this format exists to
avoid. Group into an "Open" table and a "Resolved" table, each with its own
`<h2>`.

There is no backing repo file for this — the source of truth lives only in
the published Artifact. (An earlier iteration tried `docs/backlog/*.md`
files, both with and without a parallel Artifact; abandoned. If old files
under `docs/backlog/` are ever found, they're stale — safe to delete, not
authoritative.)

Each open item in the backlog:

- Gets a distinct **three-character keyword code**, uppercase, memorable, unique
  within the file (e.g. `FNT`, `NAV`, `PAN`). The user replies with just that
  code to call up, discuss, or act on that item — no need to repeat the whole
  request.
- Gets a **severity marker**, hospital-triage style — emoji only, don't also
  spell out the color name next to it (redundant):
  - 🔴 critical / blocking, needs immediate attention
  - 🟠 urgent, high priority
  - 🟡 standard priority
  - 🟢 low priority / nice-to-have
- Gets a **start date** (when the item was opened) and, once resolved, an
  **end date** — history is kept (see below), so both dates matter.
- Moves to a "Resolved" section (don't delete — keep history) once the user says
  **"approved"** for that code, with its end date recorded. The three-character
  code is then free to be reused for an unrelated future item.
- A new item is added when the user's message starts with **`NEW`** — assign
  the next unused code, an initial severity marker (ask if unclear), and
  today's date as the start date.
- **Also add items proactively, not only on `NEW`.** Anything that becomes a
  real pending task — something waiting on the user (a file to upload, a
  decision, a review), or a genuine open thread that isn't resolved in the
  same turn it comes up — gets added to the backlog table right away, on its
  own initiative, even without the literal word `NEW`. Don't let real open
  work go untracked just because it wasn't announced with the keyword.
- If the user replies with a code, treat that as their call on what it refers
  to even if it doesn't exactly match the file — note the mismatch briefly
  rather than blocking on it.
- **Treated items move to the end of the list.** When an item gets worked
  on (reopened, updated, discussed) in a turn, move its row to the bottom
  of its table (Open or Resolved) once that turn's work is done — this
  reflects "most recently touched" order, not first-added order. (This
  reverses an earlier version of the rule that said row order stays
  fixed — that was wrong, this is the correct one.)

Write real detail in each item's status, not a one-line stub — enough that the
user can tell what actually happened without re-reading the chat. Not a full
transcript, but not a cryptic fragment either. Break each description into
several short paragraphs (2-4 sentences, blank line between) rather than one
dense block — a single wall of text is hard to scan even when the content is
good.

The backlog is meant to be a substitute for scrolling back through chat, not
a supplement to it. Anything substantive said in the chat — a decision, a
recommendation with a take, a list of next steps, an explanation the user
asked for — belongs recorded in the relevant item's description, not left to
live only as chat history. Update the item (or open one) the same turn it
comes up, don't wait to be asked to log it separately.

A sub-part of an item can be marked done while the item as a whole stays
open (e.g. one pass of a two-pass item). Wrap that finished slice in
`<span class="done">…</span>` (styled via the `.done` class already defined
in the artifact's `<style>` block — strikethrough, dimmed) rather than
deleting it or waiting for the whole item to resolve before showing any
progress.

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

# Telegram bot for Khaos

A Telegram front end for the Khaos assistant. Message the bot and you get the
same intelligence as the in-app chat — same persona, same database tools, same
conversational memory — and it also reaches out to you proactively: a morning
digest and reminders before scheduled work starts.

Two Edge Functions, one shared brain:

| Function | Trigger | Does |
| --- | --- | --- |
| `telegram-bot` | Telegram webhook | Answers your messages (the reactive chat) |
| `telegram-notify` | cron | Morning digest and upcoming-task reminders |

Both import their agent brain, Telegram helpers, and tools from
`supabase/functions/_shared`, which in turn reuses the app's own
`src/lib/chat` core modules (persona prompts, schema search, tool schemas +
executor) — so the bot can never drift from the in-app assistant.

The browser-only glue is swapped out: instead of the `anthropic-proxy`
function the bot calls Anthropic directly with `ANTHROPIC_API_KEY`, and instead
of the anon-key client with interactive write-confirmation it uses a
**service-role** client and executes write tools without a confirmation step (a
single-owner bot behind an allowlist — the persona still soft-deletes and
records its rationale). Per-chat history lives in `telegram_chats`; delivered
notifications are logged in `telegram_notifications` for idempotency.

`_shared/schema.sql.ts` is a generated, embedded copy of the repo's
`schema.sql` (Deno has no Vite `?raw` import). Regenerate it whenever the schema
changes:

```bash
npm run gen:edge-schema   # runs automatically as part of `npm run db:dump`
```

## Setup

1. **Create the bot** with [@BotFather](https://t.me/BotFather) and copy the token.

2. **Apply the migrations** (adds `telegram_chats` and `telegram_notifications`):

   ```bash
   npm run db:push
   ```

3. **Set the function secrets** (`ANTHROPIC_API_KEY` is already set for
   `anthropic-proxy`; you only need the rest):

   ```bash
   supabase secrets set TELEGRAM_BOT_TOKEN=123456:ABC...
   supabase secrets set TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 32)
   supabase secrets set KHAOS_CRON_SECRET=$(openssl rand -hex 32)
   # Leave the allowlist empty for now — the bot will reply with your chat id.
   ```

4. **Deploy both functions:**

   ```bash
   supabase functions deploy telegram-bot
   supabase functions deploy telegram-notify
   ```

5. **Register the webhook** (the `secret_token` must equal `TELEGRAM_WEBHOOK_SECRET`):

   ```bash
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<project-ref>.supabase.co/functions/v1/telegram-bot" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```

6. **Claim the bot.** Message it once. With an empty allowlist it replies with
   your numeric chat id. Add it and set the secret (comma-separate multiple ids):

   ```bash
   supabase secrets set TELEGRAM_ALLOWED_CHAT_IDS=<your chat id>
   ```

7. **Schedule the notifier** — see the next section.

## Scheduled notifications (`telegram-notify`)

Callers (cron) POST to the function with a `{ "job": ... }` body and the
`X-Khaos-Cron-Secret` header (matching `KHAOS_CRON_SECRET`):

- **`digest`** — once each morning. Khaos queries your current state and sends a
  concise briefing: overdue, due today, today's scheduled tasks, scheduled
  windows that elapsed while unfinished, tasks whose **target** window has
  passed, and important **unscheduled** tasks. For the last two it only
  *suggests* ("want me to move these targets / schedule these?") — nothing is
  changed until you reply approving, which the webhook then acts on (the digest
  is threaded into the chat history so the follow-up has context).
- **`reminders`** — every few minutes. Finds scheduled tasks whose window starts
  within the lead time (`REMINDER_LEAD_MINUTES`, default 10) and sends a plain
  reminder. Deterministic, no model call.

Both are idempotent (`telegram_notifications`), so overlapping/retried fires
never double-send.

### Wire up cron with pg_cron + pg_net

Run this once in the SQL editor (`America/Sao_Paulo` is UTC−3 year-round, so
08:00 local = 11:00 UTC). Replace `<project-ref>` and `<KHAOS_CRON_SECRET>`:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Morning digest at 08:00 America/Sao_Paulo (11:00 UTC)
select cron.schedule('khaos-digest', '0 11 * * *', $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Khaos-Cron-Secret', '<KHAOS_CRON_SECRET>'),
    body    := '{"job":"digest"}'::jsonb
  );
$$);

-- Upcoming-task reminders every 5 minutes
select cron.schedule('khaos-reminders', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/telegram-notify',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'X-Khaos-Cron-Secret', '<KHAOS_CRON_SECRET>'),
    body    := '{"job":"reminders"}'::jsonb
  );
$$);
```

(Supabase's **Database → Cron** dashboard can create the same two jobs without
SQL.) To change the times later: `select cron.unschedule('khaos-digest');` then
re-schedule. To harden the secret out of the job definition, store it in
Supabase Vault and read it via `vault.decrypted_secrets` instead of inlining.

## Release versioning

Every PR merged into `main` bumps `package.json`'s patch version and commits
it straight to `main` as `chore: release vX.Y.Z` (`.github/workflows/bump-version.yml`).
That commit is a push to `main`, which Vercel's own GitHub integration
already auto-deploys — the workflow doesn't drive the deploy itself, and it
doesn't observe or report on the result.

If `main` has branch protection requiring PRs (no direct pushes), the bump
workflow's push will be rejected — either allow the `github-actions[bot]`
actor to bypass that rule for `main`, or the workflow needs to open a PR
instead of pushing directly (not what's implemented here).

## Commands

| Command | Effect |
| --- | --- |
| `/start`, `/clear`, `/reset` | Wipe this chat's history and open a fresh session |
| `/whoami` | Reply with your chat id |
| anything else | A turn with the agent |

## Access control & security

- **Webhook secret** — every `telegram-bot` request must carry the
  `X-Telegram-Bot-Api-Secret-Token` header matching `TELEGRAM_WEBHOOK_SECRET`,
  checked before the body is read.
- **Cron secret** — every `telegram-notify` request must carry
  `X-Khaos-Cron-Secret` matching `KHAOS_CRON_SECRET`.
- **Allowlist** — only chat ids in `TELEGRAM_ALLOWED_CHAT_IDS` reach the agent
  or receive notifications. An empty allowlist denies everyone and just echoes
  the caller's chat id.
- `verify_jwt` is off for both functions (neither caller can present a Supabase
  JWT); the secrets above are the trust boundary.
- **Service-role key** stays server-side. `telegram_chats` and
  `telegram_notifications` have RLS on with no policies, so nothing but the
  service role can read them.

## Secrets

| Secret | Required | Default | Purpose |
| --- | --- | --- | --- |
| `TELEGRAM_BOT_TOKEN` | yes | — | @BotFather token |
| `TELEGRAM_WEBHOOK_SECRET` | yes | — | Webhook auth; also passed to setWebhook |
| `TELEGRAM_ALLOWED_CHAT_IDS` | yes | — | Comma-separated chat ids allowed |
| `KHAOS_CRON_SECRET` | for notify | — | Auth for the cron-triggered notifier |
| `ANTHROPIC_API_KEY` | yes | — | Shared with anthropic-proxy; set once |
| `LLM_MODEL` | no | `claude-sonnet-5` | Model the bot uses |
| `TELEGRAM_TIMEZONE` | no | `America/Sao_Paulo` | IANA tz for times & digest date |
| `REMINDER_LEAD_MINUTES` | no | `10` | How early to send task reminders |

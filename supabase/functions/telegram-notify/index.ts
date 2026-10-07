// Scheduled notifier for Khaos.
//
// Proactive counterpart to the telegram-bot webhook. Invoked by cron (pg_cron
// / Supabase Cron), not by Telegram, so it authenticates with its own shared
// secret (X-Khaos-Cron-Secret header) rather than the Telegram webhook secret.
//
// Two jobs, selected by the POST body { "job": "digest" | "reminders" }:
//
//   digest     Once each morning: hands the agent a briefing instruction and
//              sends Khaos's summary of overdue / due / scheduled work, plus
//              suggestions about elapsed targets and unscheduled tasks (it only
//              proposes — you confirm in a reply, which the webhook then acts
//              on). Threaded into the chat history so that follow-up works.
//
//   reminders  Every few minutes: finds scheduled tasks (events of type
//              'scheduled') whose window starts within the lead time and sends
//              a plain reminder. Deterministic — no model call.
//
// Idempotent via the telegram_notifications table, so overlapping or retried
// cron fires never double-send.
//
// verify_jwt is OFF (see supabase/config.toml). See ../telegram-bot/README.md
// for the cron setup.

import { sendMessage, ALLOWED_CHAT_IDS } from '../_shared/telegram.ts';
import {
  db,
  runAgent,
  temporalContext,
  TIMEZONE,
} from '../_shared/khaos.ts';

const CRON_SECRET = Deno.env.get('KHAOS_CRON_SECRET') ?? '';
const REMINDER_LEAD_MINUTES = Number(
  Deno.env.get('REMINDER_LEAD_MINUTES') ?? '10'
);

const CHAT_IDS: number[] = ALLOWED_CHAT_IDS.map((s) => Number(s)).filter(
  (n) => Number.isFinite(n)
);

const DIGEST_INSTRUCTION = `[Morning Digest job — automated, around 08:00 local time. Nobody typed this; produce a concise morning briefing to be read on Telegram.

Query the database for the current state and report only what matters. Cover, when present:
- overdue: tasks whose due date is in the past and whose status is not done or cancelled
- due today
- target today: tasks whose target window (tasks.target, a tstzrange) falls today, status not done or cancelled — same treatment as "due today", not an afterthought
- target starting soon: tasks whose target window starts within the next few days, status not done or cancelled — worth a heads-up before it's actually today
- today's scheduled tasks: events with event_type = 'scheduled' whose duration window falls today. Each such event links a task via task_id, and the event's duration (a tstzrange) IS the scheduled window — tasks themselves have no schedule column
- scheduled windows that already ended (today or earlier) while the linked task is still not done
- tasks whose target window has already elapsed while the task is not done or cancelled
- important open tasks that have no scheduled event yet (unscheduled)

For the elapsed targets and the unscheduled tasks: list them and OFFER to roll the target forward or to create a schedule — but DO NOT modify anything in this turn. Make no write tool calls now; wait for me to reply confirming. If I later reply approving, act then.

Follow your OPENING TURN tone: brief, plain, no filler, no generic offers of help. If nothing meaningful stands out, say the shortest true thing. Plain Telegram text.]`;

// --- idempotency -----------------------------------------------------------

// Records that (chatId, kind, ref) was handled. Returns true if this is the
// first time (caller should send), false if it was already recorded. Marking
// happens before the send so overlapping cron fires can't double-notify; a
// send that then fails is logged and simply missed rather than duplicated.
async function claim(
  chatId: number,
  kind: string,
  ref: string
): Promise<boolean> {
  const { error } = await db
    .from('telegram_notifications')
    .insert({ chat_id: chatId, kind, ref });
  if (!error) return true;
  if (error.code === '23505') return false; // unique violation → already sent
  console.error('claim failed', kind, ref, error.message);
  return false;
}

// --- digest ----------------------------------------------------------------

function localDate(): string {
  // en-CA formats as YYYY-MM-DD, in the configured timezone.
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(
    new Date()
  );
}

async function runDigest(): Promise<void> {
  const ref = localDate();
  for (const chatId of CHAT_IDS) {
    if (!(await claim(chatId, 'digest', ref))) continue;
    try {
      const briefing = await runAgent(
        chatId,
        `${temporalContext()}${DIGEST_INSTRUCTION}`
      );
      if (briefing.trim()) await sendMessage(chatId, briefing);
    } catch (err) {
      console.error('digest failed for chat', chatId, err);
    }
  }
}

// --- reminders -------------------------------------------------------------

interface ScheduledEvent {
  id: string;
  name: string;
  duration: string; // tstzrange text, e.g. ["2026-07-20 11:00:00+00","..."]
}

// Parses the lower bound of a Postgres tstzrange literal into a Date.
function parseRangeLower(range: string | null): Date | null {
  if (!range) return null;
  const m = range.match(/^[[(]\s*"?([^",]+?)"?\s*,/);
  if (!m) return null;
  // "2026-07-20 11:00:00+00" → ISO the Date constructor accepts everywhere.
  let s = m[1].trim().replace(' ', 'T');
  s = s.replace(/([+-]\d{2})$/, '$1:00'); // "+00" → "+00:00"
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(d: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

async function runReminders(): Promise<void> {
  if (!CHAT_IDS.length) return;

  const now = new Date();
  const leadEnd = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000);
  const window = `[${now.toISOString()},${leadEnd.toISOString()})`;

  // Overlap catches events that start within the lead time as well as ones
  // already in progress; the lower-bound check below keeps only those about to
  // start, and claim() dedupes so an event is reminded once.
  const { data, error } = await db
    .from('events')
    .select('id,name,duration')
    .eq('event_type', 'scheduled')
    .is('deleted_at', null)
    .filter('duration', 'ov', window)
    .limit(50);

  if (error) {
    console.error('reminders query failed', error.message);
    return;
  }

  for (const ev of (data ?? []) as ScheduledEvent[]) {
    const start = parseRangeLower(ev.duration);
    if (!start) continue;
    // Only remind for windows that haven't started yet (starting within lead).
    if (start < now || start > leadEnd) continue;

    const mins = Math.max(0, Math.round((start.getTime() - now.getTime()) / 60_000));
    const text = `Reminder: "${ev.name}" starts at ${formatTime(start)} (in ${mins} min).`;

    for (const chatId of CHAT_IDS) {
      if (await claim(chatId, 'reminder', ev.id)) {
        await sendMessage(chatId, text);
      }
    }
  }
}

// --- entry point -----------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const presented = req.headers.get('x-khaos-cron-secret') ?? '';
  if (!CRON_SECRET || presented !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  let body: { job?: string };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return new Response('Bad request', { status: 400 });
  }
  const job = (body.job ?? '').toLowerCase();

  const run =
    job === 'digest'
      ? runDigest()
      : job === 'reminders'
        ? runReminders()
        : null;

  if (!run) {
    return new Response('Unknown job', { status: 400 });
  }

  // Return 200 immediately; the work (agent calls / sends) finishes in the
  // background so the cron caller isn't held open.
  const work = run.catch((err) => console.error(`job ${job} error`, err));
  const runtime = (
    globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }
  ).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    await work;
  }

  return new Response('ok', { status: 200 });
});

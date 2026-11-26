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
import { parseRangeLower } from '../_shared/range.ts';
import {
  db,
  runAgent,
  temporalContext,
  resolveLocation,
  TIMEZONE,
} from '../_shared/khaos.ts';
import { fetchForecast, getDayForecast, getHoursForDate } from '../../../src/lib/weather/forecast.ts';
import { findDryWindows, suggestDeparture, clothingAdvice } from '../../../src/lib/weather/advice.ts';
import { wmoLabel } from '../../../src/lib/weather/wmo.ts';

const CRON_SECRET = Deno.env.get('KHAOS_CRON_SECRET') ?? '';
const REMINDER_LEAD_MINUTES = Number(
  Deno.env.get('REMINDER_LEAD_MINUTES') ?? '10'
);
const STALE_REVIEW_DAYS = Number(Deno.env.get('STALE_REVIEW_DAYS') ?? '3');

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
- stale in-review: tasks with status = 'in_review'. For each, find when it
  entered that status from the moments table (moment_type = 'status', value =
  'in_review', most recent such row per task — the row's created_at is the
  entry time). Any task that's been sitting in in_review for ${STALE_REVIEW_DAYS}+ days counts
  as stale. List stale ones FIRST, ahead of every other section above, most
  stale first — that's the point of this section, they've been left behind
  and need to surface before anything else.

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

// --- weather block -----------------------------------------------------
//
// Computed in plain TypeScript (same thresholds as the calendar and the
// get_weather_forecast tool, via src/lib/weather/*) and handed to the model
// as ready data — the digest only has to report it in tone, not fetch or do
// the math itself. Fail-open: any error here just means no weather block,
// never a failed/delayed digest (the task digest is the point of the
// message).

function currentLocalHour(): number {
  return (
    Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        hour: '2-digit',
        hour12: false,
      }).format(new Date())
    ) % 24
  );
}

function hourKey(dateStr: string, hour: number): string {
  return `${dateStr}T${String(hour).padStart(2, '0')}:00`;
}

interface ExternalEventRow {
  id: string;
  name: string;
  location: string | null;
  duration: string;
}

async function todaysExternalEvents(today: string): Promise<ExternalEventRow[]> {
  const { data, error } = await db
    .from('events')
    .select('id,name,location,duration')
    .is('deleted_at', null)
    .not('location', 'is', null)
    .limit(100);
  if (error) {
    console.error('todaysExternalEvents query failed', error.message);
    return [];
  }
  return (data ?? []).filter((ev: ExternalEventRow) => {
    if (!ev.location?.trim()) return false;
    const start = parseRangeLower(ev.duration);
    if (!start) return false;
    const key = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE }).format(start);
    return key === today;
  });
}

async function buildWeatherBlock(): Promise<string | null> {
  try {
    const location = await resolveLocation();
    if (!location) return null;

    const forecast = await fetchForecast(location.latitude, location.longitude, TIMEZONE);
    const today = localDate();
    const day = getDayForecast(forecast, today);
    const hours = getHoursForDate(forecast, today);
    if (!day || !hours.length) return null;

    const nowIndex = Math.max(
      0,
      hours.findIndex((h) => h.time === hourKey(today, currentLocalHour()))
    );
    const nowTemp = hours[nowIndex]?.temperature;
    const dryWindows = findDryWindows(hours);
    const rainy = (day.precipitationProbabilityMax ?? 0) >= 40;

    const lines: string[] = [
      `Clima em ${location.label}: agora ${nowTemp != null ? Math.round(nowTemp) + '°C' : 'sem leitura'}, hoje mín ${day.tempMin ?? '?'}°C / máx ${day.tempMax ?? '?'}°C, ${wmoLabel(day.weatherCode)}.`,
      clothingAdvice(day.tempMax ?? nowTemp ?? 20, rainy),
    ];

    if (dryWindows.length && dryWindows.length < hours.length) {
      const windowLabel = (w: { startIndex: number; endIndex: number }) =>
        `${hours[w.startIndex].time.slice(-5)}–${hours[w.endIndex].time.slice(-5)}`;
      lines.push(
        `Janelas sem chuva previstas hoje: ${dryWindows.map(windowLabel).join(', ')}.`
      );
    } else if (!dryWindows.length) {
      lines.push('Previsão de chuva o dia inteiro — sem janela seca hoje.');
    }

    const events = await todaysExternalEvents(today);
    for (const ev of events) {
      const start = parseRangeLower(ev.duration);
      if (!start) continue;
      const startHour = Number(
        new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(start)
      ) % 24;
      const idx = hours.findIndex((h) => h.time === hourKey(today, startHour));
      if (idx < 0) continue;
      const hour = hours[idx];
      const departure = suggestDeparture(dryWindows, idx);
      const departureLabel = departure
        ? ` Janela seca para saída: ${hours[departure.startIndex].time.slice(-5)}–${hours[departure.endIndex].time.slice(-5)}.`
        : '';
      lines.push(
        `"${ev.name}" (${ev.location}) às ${hour.time.slice(-5)}: ${hour.temperature != null ? Math.round(hour.temperature) + '°C' : '?'}, ${hour.precipitationProbability ?? 0}% de chuva.${departureLabel}`
      );
    }

    return lines.join('\n');
  } catch (err) {
    console.error('weather block failed', err);
    return null;
  }
}

const WEATHER_BLOCK_PREFIX = `[Weather — precomputed, already final. Report these numbers/recommendations plainly in your own words and tone; do not recompute, second-guess, or look them up elsewhere.]\n`;

async function runDigest(): Promise<void> {
  const ref = localDate();
  const weatherBlock = await buildWeatherBlock();
  for (const chatId of CHAT_IDS) {
    if (!(await claim(chatId, 'digest', ref))) continue;
    try {
      const weatherPrefix = weatherBlock
        ? `${WEATHER_BLOCK_PREFIX}${weatherBlock}\n\n`
        : '';
      const briefing = await runAgent(
        chatId,
        `${temporalContext()}${weatherPrefix}${DIGEST_INSTRUCTION}`
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

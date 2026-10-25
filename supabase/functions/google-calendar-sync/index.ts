// Google Calendar sync for events.event_type IN ('fixed', 'routine').
// 'scheduled' (task time blocks) never touches Google. 'fixed' events are
// fully bidirectional; generated 'routine' occurrences (see
// src/lib/routines/occurrences.ts and docs/backlog.md, "Rotinas devem ser
// criadas por cron/assistente...") are PUSH-ONLY — see the trigger
// trg_google_sync_dirty (20261013000000_google_calendar_sync.sql,
// extended by 20261025000000_routine_occurrences.sql) that is the only
// thing marking a row for this function to push.
//
// Why push-only for routine: a pull (see fromGoogleEvent/applyPulledItem
// below) always writes event_type='fixed', never 'routine' — an edit made
// on the Google side of a generated occurrence "promotes" it into a real
// fixed commitment instead of silently rewriting a routine template's
// occurrence. That keeps the GOOGLE WINS rule below meaningful without
// inventing separate two-way semantics for a cron-generated row.
//
// Cron-invoked (same X-Khaos-Cron-Secret / KHAOS_CRON_SECRET pattern as
// telegram-notify), never by a browser — see supabase/config.toml and
// supabase/functions/telegram-bot/README.md for the pg_cron wiring; this
// function's own README documents the Google-specific setup.
//
// Each run: PUSH first, then PULL — a local edit reaches Google before a
// pull could mistake it for an external change needing reconciliation.
//
// Conflict rule: GOOGLE WINS. A 'fixed' event is a commitment made with
// other people; the copy they see is authoritative. A local edit that loses
// a conflict is logged (google_calendar_sync_log, action='conflict'), never
// silently dropped. The same rule applies if a push PATCH on a 'routine'
// occurrence 412s — the occurrence's name/duration gets overwritten with
// whatever Google currently has, same as 'fixed'.
//
// Echo avoidance: trg_google_sync_dirty excludes the google_* / sync_dirty
// columns from its watched set, so a push that only writes those back never
// re-marks a row dirty. A pull, though, writes name/duration/event_type/
// deleted_at — columns the trigger DOES watch — so every pull mutation here
// goes through applySyncedUpdate(), which does the data write and then a
// second write touching only sync_dirty. The trigger can only force
// sync_dirty back to true, never force it false, so that second write always
// sticks. Skipping this would start a push/pull ping-pong that re-sends
// identical data to Google every cycle — and, worse, can re-notify its
// attendees of a no-op "update".

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { parseRange, rangeLiteral } from '../_shared/range.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CRON_SECRET = Deno.env.get('KHAOS_CRON_SECRET') ?? '';
const CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID') ?? '';
const CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '';
// Brazil has had no DST since 2019, so America/Sao_Paulo is a fixed -03:00
// offset — same assumption telegram-notify's cron docs already rely on.
const TZ_OFFSET = Deno.env.get('GOOGLE_CALENDAR_TZ_OFFSET') ?? '-03:00';
const WINDOW_DAYS = 90;
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const LOG_RETENTION_DAYS = 30;

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

// --- shared types ----------------------------------------------------------

interface Account {
  calendar_id: string;
  refresh_token: string | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  sync_token: string | null;
  last_full_sync_at: string | null;
}

interface EventRow {
  id: string;
  name: string;
  event_type: 'scheduled' | 'fixed' | 'routine';
  duration: string | null;
  deleted_at: string | null;
  google_event_id: string | null;
  google_calendar_id: string | null;
  google_etag: string | null;
}

interface GoogleEventItem {
  id: string;
  etag?: string;
  status?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
}

// --- logging -----------------------------------------------------------

type Direction = 'push' | 'pull';
type Action = 'created' | 'updated' | 'deleted' | 'skipped_echo' | 'conflict' | 'error';

async function logSync(
  direction: Direction,
  action: Action,
  eventId: string | null,
  googleEventId: string | null,
  detail: string | null
): Promise<void> {
  const { error } = await db.from('google_calendar_sync_log').insert({
    direction,
    action,
    event_id: eventId,
    google_event_id: googleEventId,
    detail,
  });
  if (error) console.error('logSync failed', direction, action, error.message);
}

async function pruneLog(): Promise<void> {
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 3600_000).toISOString();
  const { error } = await db.from('google_calendar_sync_log').delete().lt('ts', cutoff);
  if (error) console.error('pruneLog failed', error.message);
}

// The four places that address a single Google event by URL.
function eventPath(calendarId: string, googleEventId: string): string {
  return `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(googleEventId)}`;
}

// Writes only columns the trigger does not watch (the google_* / sync_dirty
// set), so it never re-marks the row dirty. Pull mutations that do touch a
// watched column go through applySyncedUpdate() instead.
async function patchEvent(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('events').update(patch).eq('id', id);
  if (error) console.error('patchEvent failed', id, error.message);
}

// Detail recorded on either side's conflict: the local edit that lost.
function conflictDetail(discardedName: string): string {
  return `local edit discarded; Google version kept (local name was "${discardedName}")`;
}

// Writes a change that touches a trigger-watched column (name, duration,
// event_type, deleted_at) and then clears sync_dirty in a second write, so
// the trigger's forced re-dirty doesn't start a ping-pong. See file header.
async function applySyncedUpdate(id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db.from('events').update(patch).eq('id', id);
  if (error) {
    console.error('applySyncedUpdate failed', id, error.message);
    return;
  }
  await patchEvent(id, { sync_dirty: false });
}

// --- account / tokens --------------------------------------------------

async function getAccount(): Promise<Account | null> {
  const { data, error } = await db
    .from('google_calendar_account')
    .select('calendar_id,refresh_token,access_token,access_token_expires_at,sync_token,last_full_sync_at')
    .eq('id', true)
    .maybeSingle();
  if (error) {
    console.error('getAccount failed', error.message);
    return null;
  }
  return data as Account | null;
}

async function ensureAccessToken(account: Account): Promise<string | null> {
  const expiresAt = account.access_token_expires_at ? new Date(account.access_token_expires_at) : null;
  if (account.access_token && expiresAt && expiresAt.getTime() > Date.now() + 60_000) {
    return account.access_token;
  }
  if (!account.refresh_token || !CLIENT_ID || !CLIENT_SECRET) return null;

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: account.refresh_token,
      grant_type: 'refresh_token',
    }),
  });
  if (!res.ok) {
    console.error('token refresh failed', res.status, await res.text());
    return null;
  }
  const token = (await res.json()) as { access_token: string; expires_in: number };
  const expires = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await db
    .from('google_calendar_account')
    .update({ access_token: token.access_token, access_token_expires_at: expires })
    .eq('id', true);
  return token.access_token;
}

async function googleFetch(path: string, init: RequestInit, accessToken: string): Promise<Response> {
  return fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers as Record<string, string> | undefined),
    },
  });
}

// --- push (Khaos -> Google) ---------------------------------------------

function toGoogleEventBody(row: EventRow): Record<string, unknown> {
  const range = parseRange(row.duration);
  if (!range) throw new Error(`event ${row.id} has no bounded duration`);
  return {
    summary: row.name,
    start: { dateTime: range.start.toISOString() },
    end: { dateTime: range.end.toISOString() },
    extendedProperties: { private: { khaos_event_id: row.id } },
  };
}

async function handlePushConflict(row: EventRow, calendarId: string, accessToken: string): Promise<void> {
  if (!row.google_event_id) return;
  const res = await googleFetch(
    eventPath(calendarId, row.google_event_id),
    { method: 'GET' },
    accessToken
  );
  if (!res.ok) {
    await logSync('push', 'error', row.id, row.google_event_id, `conflict refetch failed: ${res.status}`);
    return;
  }
  const current = (await res.json()) as GoogleEventItem;
  const parsed = fromGoogleEvent(current);
  const patch: Record<string, unknown> = {
    google_etag: current.etag ?? null,
    google_synced_at: new Date().toISOString(),
  };
  if (parsed) {
    patch.name = parsed.name;
    patch.duration = parsed.duration;
  }
  const detail = conflictDetail(row.name);
  await applySyncedUpdate(row.id, patch);
  await logSync('push', 'conflict', row.id, row.google_event_id, detail);
}

async function pushOne(row: EventRow, account: Account, accessToken: string): Promise<void> {
  const calendarId = row.google_calendar_id ?? account.calendar_id;
  const isSyncable = row.event_type === 'fixed' || row.event_type === 'routine';
  const needsDelete = row.deleted_at !== null || !isSyncable;

  if (needsDelete) {
    if (!row.google_event_id) {
      await patchEvent(row.id, { sync_dirty: false });
      return;
    }
    const res = await googleFetch(
      eventPath(calendarId, row.google_event_id),
      { method: 'DELETE' },
      accessToken
    );
    if (res.ok || res.status === 404 || res.status === 410) {
      await patchEvent(row.id, {
        google_event_id: null,
        google_calendar_id: null,
        google_etag: null,
        google_synced_at: new Date().toISOString(),
        sync_dirty: false,
      });
      await logSync('push', 'deleted', row.id, row.google_event_id, null);
    } else {
      await logSync('push', 'error', row.id, row.google_event_id, `delete failed: ${res.status} ${await res.text()}`);
    }
    return;
  }

  let body: Record<string, unknown>;
  try {
    body = toGoogleEventBody(row);
  } catch (err) {
    await logSync('push', 'error', row.id, row.google_event_id, String(err));
    await patchEvent(row.id, { sync_dirty: false });
    return;
  }

  if (row.google_event_id) {
    const res = await googleFetch(
      eventPath(calendarId, row.google_event_id),
      {
        method: 'PATCH',
        headers: row.google_etag ? { 'If-Match': row.google_etag } : undefined,
        body: JSON.stringify(body),
      },
      accessToken
    );
    if (res.status === 412) {
      await handlePushConflict(row, calendarId, accessToken);
      return;
    }
    if (!res.ok) {
      await logSync('push', 'error', row.id, row.google_event_id, `patch failed: ${res.status} ${await res.text()}`);
      return;
    }
    const updated = (await res.json()) as GoogleEventItem;
    await patchEvent(row.id, {
      google_etag: updated.etag ?? null,
      google_synced_at: new Date().toISOString(),
      sync_dirty: false,
    });
    await logSync('push', 'updated', row.id, row.google_event_id, null);
  } else {
    const res = await googleFetch(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      { method: 'POST', body: JSON.stringify(body) },
      accessToken
    );
    if (!res.ok) {
      await logSync('push', 'error', row.id, null, `insert failed: ${res.status} ${await res.text()}`);
      return;
    }
    const created = (await res.json()) as GoogleEventItem;
    await patchEvent(row.id, {
      google_event_id: created.id,
      google_calendar_id: calendarId,
      google_etag: created.etag ?? null,
      google_synced_at: new Date().toISOString(),
      sync_dirty: false,
    });
    await logSync('push', 'created', row.id, created.id, null);
  }
}

async function runPush(account: Account, accessToken: string): Promise<void> {
  const { data, error } = await db
    .from('events')
    .select('id,name,event_type,duration,deleted_at,google_event_id,google_calendar_id,google_etag')
    .eq('sync_dirty', true)
    .limit(200);
  if (error) {
    console.error('push query failed', error.message);
    return;
  }
  for (const row of (data ?? []) as EventRow[]) {
    await pushOne(row, account, accessToken);
  }
}

// --- pull (Google -> Khaos) ----------------------------------------------

function fromGoogleEvent(item: GoogleEventItem): { name: string; duration: string; start: Date } | null {
  let start: Date;
  let end: Date;
  if (item.start?.dateTime && item.end?.dateTime) {
    start = new Date(item.start.dateTime);
    end = new Date(item.end.dateTime);
  } else if (item.start?.date && item.end?.date) {
    // All-day event: Google's end.date is already the exclusive next day.
    // duration_must_be_bounded needs a concrete, non-empty range, so this
    // becomes [00:00 local, 00:00 local next day).
    start = new Date(`${item.start.date}T00:00:00${TZ_OFFSET}`);
    end = new Date(`${item.end.date}T00:00:00${TZ_OFFSET}`);
  } else {
    return null;
  }
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  return { name: item.summary || '(sem título)', duration: rangeLiteral(start, end), start };
}

function isDeclinedBySelf(item: GoogleEventItem): boolean {
  const self = (item.attendees ?? []).find((a) => a.self);
  return self?.responseStatus === 'declined';
}

async function applyPulledItem(item: GoogleEventItem, calendarId: string, windowStart: Date): Promise<void> {
  const googleId = item.id;
  const { data: existing, error } = await db
    .from('events')
    .select('id,name,sync_dirty,google_etag')
    .eq('google_calendar_id', calendarId)
    .eq('google_event_id', googleId)
    .maybeSingle();
  if (error) {
    await logSync('pull', 'error', null, googleId, error.message);
    return;
  }

  if (existing && existing.google_etag && item.etag && existing.google_etag === item.etag) {
    await logSync('pull', 'skipped_echo', existing.id, googleId, null);
    return;
  }

  if (item.status === 'cancelled') {
    if (existing) {
      await applySyncedUpdate(existing.id, {
        deleted_at: new Date().toISOString(),
        google_etag: item.etag ?? existing.google_etag,
        google_synced_at: new Date().toISOString(),
      });
      await logSync('pull', 'deleted', existing.id, googleId, null);
    }
    return;
  }

  if (!existing && isDeclinedBySelf(item)) return;

  const parsed = fromGoogleEvent(item);
  if (!parsed) {
    await logSync('pull', 'error', existing?.id ?? null, googleId, 'event has neither dateTime nor date bounds');
    return;
  }

  if (existing) {
    const conflict = Boolean(existing.sync_dirty && existing.google_etag && existing.google_etag !== (item.etag ?? null));
    const detail = conflict ? conflictDetail(existing.name) : null;
    await applySyncedUpdate(existing.id, {
      name: parsed.name,
      duration: parsed.duration,
      event_type: 'fixed',
      deleted_at: null,
      google_etag: item.etag ?? null,
      google_synced_at: new Date().toISOString(),
    });
    await logSync('pull', conflict ? 'conflict' : 'updated', existing.id, googleId, detail);
    return;
  }

  // New-to-Khaos event. The window only gates first-time imports — an
  // already-paired row above is always reconciled regardless of where it
  // now falls, since it's already part of the synced set (see ACHADO 3 in
  // the backlog entry for why there's no server-side time window at all).
  if (parsed.start < windowStart) return;

  const { data: inserted, error: insertError } = await db
    .from('events')
    .insert({
      name: parsed.name,
      event_type: 'fixed',
      duration: parsed.duration,
      google_event_id: googleId,
      google_calendar_id: calendarId,
      google_etag: item.etag ?? null,
      google_synced_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (insertError) {
    // 23505 = unique violation on idx_events_google_pairing: a concurrent
    // run already imported this event.
    if (insertError.code !== '23505') await logSync('pull', 'error', null, googleId, insertError.message);
    return;
  }
  // The trigger forces sync_dirty=true on INSERT for a 'fixed' row
  // regardless of what we pass; clear it so this import doesn't immediately
  // get pushed back to Google next cycle. See file header.
  await patchEvent(inserted.id, { sync_dirty: false });
  await logSync('pull', 'created', inserted.id, googleId, null);
}

interface ListEventsPage {
  items?: GoogleEventItem[];
  nextPageToken?: string;
  nextSyncToken?: string;
}

async function runPullOnce(
  account: Account,
  accessToken: string,
  syncToken: string | undefined
): Promise<'ok' | 'fullSyncRequired'> {
  const isFull = !syncToken;
  const windowStart = new Date(Date.now() - WINDOW_DAYS * 24 * 3600_000);
  let pageToken: string | undefined;
  let nextSyncToken: string | undefined;

  do {
    // syncToken is incompatible with timeMin/timeMax/privateExtendedProperty/
    // q/iCalUID/orderBy/sharedExtendedProperty — sending both 400s. Full sync
    // (no token yet) uses timeMin instead; there's no timeMax, so a later
    // full sync still finds arbitrarily-far-future fixed events.
    const params = new URLSearchParams({ singleEvents: 'true', showDeleted: 'true', maxResults: '2500' });
    if (syncToken) {
      params.set('syncToken', syncToken);
    } else {
      params.set('timeMin', windowStart.toISOString());
    }
    if (pageToken) params.set('pageToken', pageToken);

    const res = await googleFetch(
      `/calendars/${encodeURIComponent(account.calendar_id)}/events?${params.toString()}`,
      { method: 'GET' },
      accessToken
    );

    if (res.status === 410) return 'fullSyncRequired';
    if (!res.ok) {
      const detail = `list failed: ${res.status} ${await res.text()}`;
      await logSync('pull', 'error', null, null, detail);
      await db.from('google_calendar_account').update({ last_error: detail }).eq('id', true);
      return 'ok';
    }

    const page = (await res.json()) as ListEventsPage;
    for (const item of page.items ?? []) {
      await applyPulledItem(item, account.calendar_id, windowStart);
    }
    pageToken = page.nextPageToken;
    if (page.nextSyncToken) nextSyncToken = page.nextSyncToken;
  } while (pageToken);

  const now = new Date().toISOString();
  await db
    .from('google_calendar_account')
    .update({
      sync_token: nextSyncToken ?? syncToken ?? null,
      last_sync_at: now,
      last_full_sync_at: isFull ? now : account.last_full_sync_at,
      last_error: null,
    })
    .eq('id', true);
  return 'ok';
}

async function runPull(account: Account, accessToken: string): Promise<void> {
  let syncToken = account.sync_token ?? undefined;
  // At most one retry: a full sync (no syncToken) can't itself 410.
  for (let attempt = 0; attempt < 2; attempt++) {
    const result = await runPullOnce(account, accessToken, syncToken);
    if (result === 'fullSyncRequired') {
      // Do NOT wipe local events (unlike Google's own sample code) — events
      // not sourced from Google live here too. Reconciliation on the retry
      // is by google_event_id, same as every other pull.
      syncToken = undefined;
      continue;
    }
    return;
  }
}

// --- entry point -----------------------------------------------------------

async function runSync(): Promise<void> {
  await pruneLog();
  const account = await getAccount();
  if (!account || !account.refresh_token) return; // not connected yet

  const accessToken = await ensureAccessToken(account);
  if (!accessToken) {
    await db
      .from('google_calendar_account')
      .update({ last_error: 'could not obtain an access token (check refresh_token / client secrets)' })
      .eq('id', true);
    return;
  }

  await runPush(account, accessToken);
  await runPull(account, accessToken);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const presented = req.headers.get('x-khaos-cron-secret') ?? '';
  if (!CRON_SECRET || presented !== CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 });
  }

  const work = runSync().catch((err) => console.error('sync run failed', err));
  const runtime = (globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
  if (runtime?.waitUntil) {
    runtime.waitUntil(work);
  } else {
    await work;
  }

  return new Response('ok', { status: 200 });
});

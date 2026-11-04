// Wires public.moments to a callback via Realtime, falling back to a poll —
// the Supabase-dependent half of the DB-change-detection feature, kept
// separate from changeWatcher.ts's pure buffering/gating logic so it can be
// unit-tested against a fake client (momentFeed.test.ts) instead of a real
// Supabase project.
//
// Each call gets its OWN Realtime topic ('db-change-feed-<n>'), so calls are
// independent: @supabase/realtime-js's RealtimeClient.channel(topic) returns
// the *existing* channel for a topic instead of creating a new one, and
// RealtimeChannel.on() throws synchronously if that channel is already
// joined/joining and the listener type is 'postgres_changes'. With a shared
// fixed topic, a second live feed hit exactly that throw inside a useEffect,
// with no error boundary to catch it — the whole React tree unmounted. The
// shell now runs a single agent, so a single feed (see
// lib/chat/chatAgentContext), which is what actually fixed that crash; this
// keeps the module safe to call more than once anyway, and leaves the
// StrictMode remount and any future second caller unable to resurrect it.
// Distinct topics also mean removeChannel() in one call's stop() only ever
// tears down its own channel.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MomentRow } from './changeWatcher';

const MOMENT_COLUMNS =
  'id, moment_type, value, previous_value, authored_by, created_at, task_id, section_id, project_id, routine_id';

// How long to wait for the Realtime channel to reach SUBSCRIBED before
// falling back to polling — Realtime may simply not be enabled on the
// project, and this is what makes the feature degrade instead of going
// silent forever.
export const DEFAULT_SUBSCRIBE_GRACE_MS = 5000;
export const DEFAULT_MOMENT_POLL_INTERVAL_MS = 60000;

let topicCounter = 0;

export interface MomentFeedHandle {
  stop(): void;
}

export function subscribeToMomentFeed(
  client: SupabaseClient,
  params: {
    onRows: (rows: MomentRow[]) => void;
    subscribeGraceMs?: number;
    pollIntervalMs?: number;
  }
): MomentFeedHandle {
  const {
    onRows,
    subscribeGraceMs = DEFAULT_SUBSCRIBE_GRACE_MS,
    pollIntervalMs = DEFAULT_MOMENT_POLL_INTERVAL_MS,
  } = params;

  let cancelled = false;
  let subscribed = false;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let cursor = new Date().toISOString();

  const topic = `db-change-feed-${++topicCounter}`;
  const channel = client
    .channel(topic)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'moments' },
      (payload) => {
        if (cancelled) return;
        onRows([payload.new as unknown as MomentRow]);
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') subscribed = true;
    });

  const subscribeGraceTimer = setTimeout(() => {
    if (cancelled || subscribed) return;
    pollTimer = setInterval(async () => {
      const since = cursor;
      const { data, error } = await client
        .from('moments')
        .select(MOMENT_COLUMNS)
        .gt('created_at', since)
        .order('created_at', { ascending: true })
        .limit(200);
      if (cancelled || error || !data?.length) return;
      cursor = (data as unknown as MomentRow[])[data.length - 1].created_at;
      onRows(data as unknown as MomentRow[]);
    }, pollIntervalMs);
  }, subscribeGraceMs);

  return {
    stop() {
      cancelled = true;
      clearTimeout(subscribeGraceTimer);
      if (pollTimer) clearInterval(pollTimer);
      client.removeChannel(channel);
    },
  };
}

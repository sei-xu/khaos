import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { subscribeToMomentFeed } from '../lib/chat/momentFeed';
import {
  ChangeBuffer,
  canNudge,
  formatDbChangePrefix,
  DEFAULT_SILENCE_MS,
  DEFAULT_COOLDOWN_MINUTES,
  DEFAULT_MAX_PER_HOUR,
  DEFAULT_TURN_GRACE_MS,
  type MomentRow,
} from '../lib/chat/changeWatcher';

const FLUSH_CHECK_INTERVAL_MS = 1000;

function getCooldownMs(): number {
  const raw = import.meta.env.VITE_NUDGE_COOLDOWN_MINUTES;
  const minutes = raw ? parseFloat(raw) : NaN;
  return (
    (Number.isFinite(minutes) && minutes > 0
      ? minutes
      : DEFAULT_COOLDOWN_MINUTES) *
    60 *
    1000
  );
}

// Watches public.moments (via Realtime, falling back to a poll) and calls
// onNudge with a compact "[DB Change: ...]" summary once a batch of
// user-caused moments settles and clears the nudge-worthy gate — see
// changeWatcher.ts for the actual buffering/gating logic, kept pure and
// unit-tested there. This hook only wires that logic to Supabase and to the
// chat turn in flight.
export function useDbChangeFeed(params: {
  enabled: boolean;
  isTurnInFlight: boolean;
  onNudge: (prefixedContent: string) => void;
}): void {
  const { enabled, isTurnInFlight, onNudge } = params;

  const isTurnInFlightRef = useRef(isTurnInFlight);
  const turnEndedAtRef = useRef<number | null>(null);
  const onNudgeRef = useRef(onNudge);

  useEffect(() => {
    onNudgeRef.current = onNudge;
  }, [onNudge]);

  useEffect(() => {
    if (isTurnInFlightRef.current && !isTurnInFlight) {
      turnEndedAtRef.current = Date.now();
    }
    isTurnInFlightRef.current = isTurnInFlight;
  }, [isTurnInFlight]);

  useEffect(() => {
    if (!enabled) return;

    const buffer = new ChangeBuffer();
    const lastNudgeAtRef = { current: null as number | null };
    const nudgeTimestampsRef = { current: [] as number[] };
    let cancelled = false;

    function isSuppressed(): boolean {
      if (isTurnInFlightRef.current) return true;
      const endedAt = turnEndedAtRef.current;
      return endedAt !== null && Date.now() - endedAt < DEFAULT_TURN_GRACE_MS;
    }

    function handleRows(rows: MomentRow[]) {
      if (cancelled || isSuppressed()) return;
      buffer.push(rows, Date.now());
    }

    const feed = subscribeToMomentFeed(supabase, { onRows: handleRows });

    const flushTimer = setInterval(async () => {
      if (cancelled || !buffer.shouldFlush(Date.now(), DEFAULT_SILENCE_MS)) {
        return;
      }
      const batch = buffer.takeWorthyBatch();
      if (!batch) return;

      if (
        !canNudge({
          lastNudgeAtMs: lastNudgeAtRef.current,
          nudgeTimestampsMs: nudgeTimestampsRef.current,
          nowMs: Date.now(),
          cooldownMs: getCooldownMs(),
          maxPerHour: DEFAULT_MAX_PER_HOUR,
        })
      ) {
        return;
      }

      // Whoever inserts this last_moment_id first is the instance that runs
      // the nudge turn — a duplicate-key error means another tab/instance
      // (or this hook's own second mount) already claimed this exact batch.
      const { error: claimError } = await supabase
        .from('assistant_nudges')
        .insert({ last_moment_id: batch.lastMomentId });
      if (claimError || cancelled) return;

      const now = Date.now();
      lastNudgeAtRef.current = now;
      nudgeTimestampsRef.current = [
        ...nudgeTimestampsRef.current.filter((t) => t > now - 60 * 60 * 1000),
        now,
      ];
      onNudgeRef.current(formatDbChangePrefix(batch.rows));
    }, FLUSH_CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(flushTimer);
      feed.stop();
    };
  }, [enabled]);
}

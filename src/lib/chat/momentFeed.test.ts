import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { subscribeToMomentFeed } from './momentFeed';
import type { MomentRow } from './changeWatcher';

// Mirrors the real @supabase/realtime-js semantics that caused the crash:
// RealtimeClient.channel(topic) reuses an existing channel for the same
// topic instead of creating a new one, and RealtimeChannel.on() throws if
// the channel is already joined/joining and the listener type is
// 'postgres_changes'. A fake that didn't reproduce both of these would let
// a regression (e.g. reusing a fixed topic again) pass unnoticed.
type Handler = (payload: unknown) => void;

class FakeChannel {
  state: 'closed' | 'joining' | 'joined' = 'closed';
  handlers: Handler[] = [];
  constructor(public topic: string) {}

  on(type: string, _filter: unknown, handler: Handler): this {
    if (
      type === 'postgres_changes' &&
      (this.state === 'joined' || this.state === 'joining')
    ) {
      throw new Error(
        `tried to call channel.on() for ${this.topic} after channel.subscribe()`
      );
    }
    this.handlers.push(handler);
    return this;
  }

  // Stands in for an INSERT arriving on this channel and nothing else, which
  // is how the per-call isolation gets checked.
  emitInsert(row: MomentRow): void {
    for (const handler of this.handlers) handler({ new: row });
  }

  subscribe(callback?: (status: string) => void): this {
    this.state = 'joining';
    queueMicrotask(() => {
      this.state = 'joined';
      callback?.('SUBSCRIBED');
    });
    return this;
  }
}

class FakeRealtimeClient {
  channels = new Map<string, FakeChannel>();

  channel(topic: string): FakeChannel {
    const existing = this.channels.get(topic);
    if (existing) return existing;
    const created = new FakeChannel(topic);
    this.channels.set(topic, created);
    return created;
  }

  removeChannel(channel: FakeChannel): void {
    if (this.channels.get(channel.topic) === channel) {
      this.channels.delete(channel.topic);
    }
  }
}

class FakeSupabaseClient {
  realtime = new FakeRealtimeClient();

  channel(topic: string) {
    return this.realtime.channel(topic);
  }

  removeChannel(channel: FakeChannel) {
    return this.realtime.removeChannel(channel);
  }

  from() {
    return {
      select: () => ({
        gt: () => ({
          order: () => ({
            limit: async () => ({ data: [] as MomentRow[], error: null }),
          }),
        }),
      }),
    };
  }
}

function fakeClient(): FakeSupabaseClient {
  return new FakeSupabaseClient();
}

function moment(overrides: Partial<MomentRow> = {}): MomentRow {
  return {
    id: 'm1',
    moment_type: 'status',
    value: 'done',
    previous_value: 'todo',
    authored_by: 'user',
    created_at: '2026-10-28T00:00:00Z',
    task_id: 'task-1',
    section_id: null,
    project_id: null,
    routine_id: null,
    ...overrides,
  };
}

describe('FakeSupabaseClient (sanity)', () => {
  it('reproduces the real throw-on-shared-topic bug', async () => {
    const client = fakeClient();
    const a = client.channel('db-change-feed');
    a.on('postgres_changes', {}, () => {});
    a.subscribe();
    await Promise.resolve();
    await Promise.resolve();
    expect(a.state).toBe('joined');

    const b = client.channel('db-change-feed');
    expect(b).toBe(a);
    expect(() => b.on('postgres_changes', {}, () => {})).toThrow();
  });
});

describe('subscribeToMomentFeed', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lets two concurrent subscriptions coexist without throwing', () => {
    const client = fakeClient();
    expect(() => {
      const first = subscribeToMomentFeed(client as unknown as SupabaseClient, {
        onRows: () => {},
      });
      const second = subscribeToMomentFeed(
        client as unknown as SupabaseClient,
        { onRows: () => {} }
      );
      first.stop();
      second.stop();
    }).not.toThrow();
  });

  it('gives each subscription its own Realtime topic', () => {
    const client = fakeClient();
    const first = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: () => {},
    });
    const second = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: () => {},
    });

    expect(client.realtime.channels.size).toBe(2);
    first.stop();
    second.stop();
  });

  it('does not remove the other subscription channel on stop', () => {
    const client = fakeClient();
    const first = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: () => {},
    });
    const second = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: () => {},
    });

    const topicsBeforeStop = new Set(client.realtime.channels.keys());

    first.stop();
    expect(client.realtime.channels.size).toBe(1);
    const [remainingTopic] = client.realtime.channels.keys();
    expect(topicsBeforeStop.has(remainingTopic)).toBe(true);

    second.stop();
    expect(client.realtime.channels.size).toBe(0);
  });

  it('still works if a second subscription races in before the first channel is SUBSCRIBED', async () => {
    const client = fakeClient();
    const firstRows: MomentRow[][] = [];
    const secondRows: MomentRow[][] = [];
    const first = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: (r) => firstRows.push(r),
    });
    const second = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: (r) => secondRows.push(r),
    });

    await vi.advanceTimersByTimeAsync(0);

    // Both subscriptions are live on their own channel — the second one
    // calling .on() while the first was still 'joining' is exactly what
    // threw with a shared topic.
    const channels = [...client.realtime.channels.values()];
    expect(channels).toHaveLength(2);
    expect(channels.map((c) => c.state)).toEqual(['joined', 'joined']);

    // And each one only hears its own channel: no crosstalk, so the two
    // feeds can't double-report the same INSERT to one callback.
    channels[0].emitInsert(moment({ id: 'm-first' }));
    channels[1].emitInsert(moment({ id: 'm-second' }));
    expect(firstRows).toEqual([[moment({ id: 'm-first' })]]);
    expect(secondRows).toEqual([[moment({ id: 'm-second' })]]);

    first.stop();
    second.stop();
  });

  it('falls back to polling if the channel never reaches SUBSCRIBED within the grace window', async () => {
    const client = fakeClient();
    // Override subscribe to never call back with SUBSCRIBED.
    const original = FakeRealtimeClient.prototype.channel;
    client.realtime.channel = function (topic: string) {
      const ch = original.call(this, topic);
      ch.subscribe = function (this: FakeChannel) {
        this.state = 'joining';
        return this;
      };
      return ch;
    };

    const pollSpy = vi.fn(async () => ({ data: [], error: null }));
    client.from = () => ({
      select: () => ({
        gt: () => ({
          order: () => ({
            limit: pollSpy,
          }),
        }),
      }),
    });

    const handle = subscribeToMomentFeed(client as unknown as SupabaseClient, {
      onRows: () => {},
      subscribeGraceMs: 1000,
      pollIntervalMs: 500,
    });

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(500);
    expect(pollSpy).toHaveBeenCalled();

    handle.stop();
  });
});

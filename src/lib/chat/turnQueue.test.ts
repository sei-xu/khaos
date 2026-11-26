import { describe, it, expect, vi } from 'vitest';
import { TurnQueue } from './turnQueue';

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('TurnQueue', () => {
  it('drains in FIFO order', async () => {
    const queue = new TurnQueue<string>();
    const order: string[] = [];
    queue.enqueue('a', 'A');
    queue.enqueue('b', 'B');
    queue.enqueue('c', 'C');

    await queue.drain(async (payload) => {
      order.push(payload);
    });

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('an empty queue resolves immediately without calling run', async () => {
    const queue = new TurnQueue<string>();
    const run = vi.fn();
    await queue.drain(run);
    expect(run).not.toHaveBeenCalled();
  });

  it('enqueuing while a drain is already in flight does not lose or reorder items', async () => {
    const queue = new TurnQueue<string>();
    const order: string[] = [];
    const first = deferred<void>();

    queue.enqueue('a', 'A');
    const drainPromise = queue.drain(async (payload) => {
      order.push(payload);
      if (payload === 'A') {
        // While the first item is still running, more arrive.
        queue.enqueue('b', 'B');
        queue.enqueue('c', 'C');
        await first.promise;
      }
    });

    // Let the microtask queue advance so A's handler has registered B/C.
    await Promise.resolve();
    await Promise.resolve();
    first.resolve();
    await drainPromise;

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('runs exactly one turn at a time even if drain() is called again before the first finishes', async () => {
    const queue = new TurnQueue<string>();
    let concurrent = 0;
    let maxConcurrent = 0;
    queue.enqueue('a', 'A');
    queue.enqueue('b', 'B');

    const run = async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise((r) => setTimeout(r, 0));
      concurrent--;
    };

    const p1 = queue.drain(run);
    const p2 = queue.drain(run); // reentrant call — should be a no-op

    await Promise.all([p1, p2]);
    expect(maxConcurrent).toBe(1);
  });

  it('a failing turn does not stop the rest of the queue from draining', async () => {
    const queue = new TurnQueue<string>();
    const order: string[] = [];
    queue.enqueue('a', 'A');
    queue.enqueue('b', 'B');
    queue.enqueue('c', 'C');

    await queue.drain(async (payload) => {
      order.push(payload);
      if (payload === 'B') throw new Error('boom');
    });

    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('exposes size and pendingIds for UI "queued" markers', async () => {
    const queue = new TurnQueue<string>();
    queue.enqueue('a', 'A');
    queue.enqueue('b', 'B');
    expect(queue.size).toBe(2);
    expect(queue.pendingIds).toEqual(['a', 'b']);

    const gate = deferred<void>();
    const drainPromise = queue.drain(async () => {
      await gate.promise;
    });
    // First item has been shifted out for running; only 'b' remains pending.
    await Promise.resolve();
    expect(queue.pendingIds).toEqual(['b']);
    gate.resolve();
    await drainPromise;
  });
});

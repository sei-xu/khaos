// Serial FIFO queue for chat turns (useChatAgent.ts). Before this, a second
// message typed while a turn was in flight was silently discarded (see
// sendMessage's old `if (isSending) return`); three producers — the user,
// the session-opening bootstrap turn, and the DB-change nudge — raced the
// same runTurn()/saveHistory() path and could overwrite each other.
//
// This queue doesn't run anything itself — drain() is handed the actual
// "run one turn" function by the caller, so it stays free of React/Supabase
// and is unit-testable with a fake run().

interface QueueItem<T> {
  id: string;
  payload: T;
}

export class TurnQueue<T> {
  private items: QueueItem<T>[] = [];
  private draining = false;

  enqueue(id: string, payload: T): void {
    this.items.push({ id, payload });
  }

  get size(): number {
    return this.items.length;
  }

  get pendingIds(): string[] {
    return this.items.map((item) => item.id);
  }

  get isDraining(): boolean {
    return this.draining;
  }

  // Serially awaits `run` for each item in FIFO order, including items
  // enqueued after drain() started (the loop re-checks this.items on every
  // iteration instead of snapshotting it). Re-entrant: if a drain is
  // already in progress, this call is a no-op and returns once that drain
  // empties the queue — callers can call drain() after every enqueue
  // without worrying about running two loops at once. A rejected `run`
  // is swallowed so one failing turn doesn't halt the rest.
  async drain(run: (payload: T) => Promise<void>): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      while (this.items.length > 0) {
        const next = this.items.shift();
        if (!next) break;
        try {
          await run(next.payload);
        } catch {
          // run() owns reporting its own errors; the queue's job is just
          // to keep draining the rest.
        }
      }
    } finally {
      this.draining = false;
    }
  }
}

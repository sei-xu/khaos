// Pure (no React) controller behind useDebouncedField — a local draft that
// commits after a quiet window, while staying immune to the server's own
// echo of a stale value landing mid-edit. See useDebouncedField.ts for the
// React wrapper and the SectionColumn/ProjectDetailPage name inputs for the
// bug this exists to fix: a value prop driven straight by a refetch snaps
// back over whatever the user is still typing.
export interface DebouncedFieldController<T> {
  // The React wrapper outlives any single render, so it re-points the
  // controller at the current render's callback instead of letting it hold
  // the closure it was created with (which keeps seeing that render's
  // props — see useDebouncedField.ts).
  setCommit(next: (value: T) => void | Promise<unknown>): void;
  set(next: T): void;
  flush(): void;
  // Pure query, no mutation — callable from a render body (e.g.
  // useDebouncedField) without touching the controller's own state. See
  // useDebouncedField.ts.
  shouldAccept(): boolean;
  cancel(resetTo: T): void;
}

export function createDebouncedField<T>({
  value,
  commit: initialCommit,
  delay = 500,
}: {
  value: T;
  // May return a promise (e.g. mutateAsync) — inFlight clears when the
  // commit actually settles, never from matching the server's echoed
  // value (see shouldAccept below).
  commit: (next: T) => void | Promise<unknown>;
  delay?: number;
}): DebouncedFieldController<T> {
  let commit = initialCommit;
  let draft = value;
  let dirty = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function runCommit(next: T) {
    inFlight = true;
    const settle = () => {
      inFlight = false;
    };
    let result: void | Promise<unknown>;
    try {
      result = commit(next);
    } catch (error) {
      console.error(error);
      settle();
      return;
    }
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      (result as Promise<unknown>).then(settle, settle);
    } else {
      settle();
    }
  }

  function set(next: T) {
    draft = next;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      dirty = false;
      runCommit(next);
    }, delay);
  }

  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    runCommit(draft);
  }

  // While a commit is in flight (or the draft is still dirty), an external
  // value is the server echoing something we already know is stale — drop
  // it. inFlight itself is cleared by runCommit once the commit settles, so
  // a failed mutation (rolled back cache) or a server-side rewrite of the
  // value can no longer leave this stuck forever.
  function shouldAccept(): boolean {
    return !dirty && !inFlight;
  }

  function cancel(resetTo: T) {
    clearTimeout(timer);
    dirty = false;
    inFlight = false;
    draft = resetTo;
  }

  return {
    setCommit: (next: (value: T) => void | Promise<unknown>) => {
      commit = next;
    },
    set,
    flush,
    shouldAccept,
    cancel,
  };
}

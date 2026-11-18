// Pure (no React) controller behind useDebouncedField — a local draft that
// commits after a quiet window, while staying immune to the server's own
// echo of a stale value landing mid-edit. See useDebouncedField.ts for the
// React wrapper and the SectionColumn/ProjectDetailPage name inputs for the
// bug this exists to fix: a value prop driven straight by a refetch snaps
// back over whatever the user is still typing.
export interface DebouncedFieldController<T> {
  getDraft(): T;
  // The React wrapper outlives any single render, so it re-points the
  // controller at the current render's callback instead of letting it hold
  // the closure it was created with (which keeps seeing that render's
  // props — see useDebouncedField.ts).
  setCommit(next: (value: T) => void | Promise<unknown>): void;
  set(next: T): void;
  flush(): void;
  receiveExternal(next: T): void;
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
  // value (see receiveExternal below).
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
    const result = commit(next);
    const settle = () => {
      inFlight = false;
    };
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
  function receiveExternal(next: T) {
    if (dirty) return; // actively editing, uncommitted — never accept an echo
    if (inFlight) return;
    draft = next;
  }

  function cancel(resetTo: T) {
    clearTimeout(timer);
    dirty = false;
    inFlight = false;
    draft = resetTo;
  }

  return {
    getDraft: () => draft,
    setCommit: (next: (value: T) => void | Promise<unknown>) => {
      commit = next;
    },
    set,
    flush,
    receiveExternal,
    cancel,
  };
}

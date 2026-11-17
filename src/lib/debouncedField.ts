// Pure (no React) controller behind useDebouncedField — a local draft that
// commits after a quiet window, while staying immune to the server's own
// echo of a stale value landing mid-edit. See useDebouncedField.ts for the
// React wrapper and the SectionColumn/ProjectDetailPage name inputs for the
// bug this exists to fix: a value prop driven straight by a refetch snaps
// back over whatever the user is still typing.
export interface DebouncedFieldController<T> {
  getDraft(): T;
  set(next: T): void;
  flush(): void;
  receiveExternal(next: T): void;
  cancel(resetTo: T): void;
}

export function createDebouncedField<T>({
  value,
  commit,
  delay = 500,
}: {
  value: T;
  commit: (next: T) => void;
  delay?: number;
}): DebouncedFieldController<T> {
  let draft = value;
  let lastCommitted = value;
  let dirty = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function set(next: T) {
    draft = next;
    dirty = true;
    clearTimeout(timer);
    timer = setTimeout(() => {
      dirty = false;
      inFlight = true;
      lastCommitted = next;
      commit(next);
    }, delay);
  }

  function flush() {
    clearTimeout(timer);
    if (!dirty) return;
    dirty = false;
    inFlight = true;
    lastCommitted = draft;
    commit(draft);
  }

  // While a commit is in flight (or the draft is still dirty), an external
  // value is the server echoing something we already know is stale — drop
  // it. Only once the echo catches up to what we actually committed do we
  // hand control back to the server.
  function receiveExternal(next: T) {
    if (dirty) return; // actively editing, uncommitted — never accept an echo
    if (inFlight) {
      if (next === lastCommitted) {
        inFlight = false;
        draft = next;
      }
      return;
    }
    draft = next;
    lastCommitted = next;
  }

  function cancel(resetTo: T) {
    clearTimeout(timer);
    dirty = false;
    inFlight = false;
    draft = resetTo;
    lastCommitted = resetTo;
  }

  return { getDraft: () => draft, set, flush, receiveExternal, cancel };
}

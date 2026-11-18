import { useEffect, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { createDebouncedField } from '../lib/debouncedField';

export interface DebouncedField<T> {
  draft: T;
  set: (next: T) => void;
  flush: () => void;
  cancel: () => void;
}

export interface DebouncedTextField extends DebouncedField<string> {
  // Covers the keyboard contract every plain-text debounced input repeats:
  // Enter commits + blurs, Escape discards the draft + blurs. Spread
  // straight onto an <input> — only offered by the string variant below,
  // since it binds `draft` straight to an input's `value`.
  bind: {
    value: string;
    onChange: (e: ChangeEvent<HTMLInputElement>) => void;
    onBlur: () => void;
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  };
}

// Local draft + debounced commit — lets a text field feel instant while
// typing without firing a mutation (and, for section/project names, a DB
// `renamed` moment) on every keystroke. Flushes on unmount so nothing is
// lost when the user tabs away or closes the modal/navigates.
//
// The controller is created once via useState's lazy initializer (never
// updated again) rather than useRef — reading `.current` outside an effect
// or handler trips the react-hooks/refs rule, so a plain state value that
// just happens to never change is the cleaner fit here.
export function useDebouncedField<T>(
  value: T,
  commit: (next: T) => void | Promise<unknown>,
  delay = 500
): DebouncedField<T> {
  const [controller] = useState(() =>
    createDebouncedField({ value, commit, delay })
  );

  // The controller is created once, so it would otherwise keep calling the
  // first render's `commit` closure — which keeps seeing that render's
  // props forever. In ProjectDetailPage the first render happens while the
  // projects query is still loading, so `project` is undefined in it and
  // every later rename would be committed by a closure that does nothing.
  // Re-point it at the current callback after each render; every commit
  // path (timer, blur/Enter, unmount cleanup) runs after this effect.
  useEffect(() => {
    controller.setCommit(commit);
  });
  const [draft, setDraft] = useState(value);

  // Adjust state during render (React's documented pattern for deriving
  // state from a prop change) rather than in an effect — an effect would
  // fire a second, cascading render for what's really just "this value
  // changed, update the draft to match." `shouldAccept` is a pure query —
  // it never mutates the controller, so a render React throws away (e.g.
  // under StrictMode or concurrent rendering) can't leave the controller's
  // own draft out of sync with what actually got committed as state. The
  // controller's draft is only ever mutated from set/flush/cancel below,
  // all of which run inside handlers, never during render.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (controller.shouldAccept()) {
      setDraft(value);
    }
  }

  useEffect(() => {
    return () => controller.flush();
  }, [controller]);

  function set(next: T) {
    controller.set(next);
    setDraft(next);
  }

  function flush() {
    // No setDraft here: `draft` already matches whatever flush commits —
    // every path that can make it dirty (set, above) already kept the two
    // in lockstep, so re-reading the controller's own draft back into state
    // would only risk reintroducing the staleness this hook avoids above.
    controller.flush();
  }

  function cancel() {
    controller.cancel(value);
    setDraft(value);
  }

  return { draft, set, flush, cancel };
}

// Thin wrapper for the common text-input case: same debounced draft, plus
// a `bind` spreadable straight onto an <input>. Kept separate from the
// generic hook above so `bind` — which assumes a string draft — can't be
// reached from a non-string field.
export function useDebouncedTextField(
  value: string,
  commit: (next: string) => void | Promise<unknown>,
  delay = 500
): DebouncedTextField {
  const field = useDebouncedField(value, commit, delay);

  const bind = {
    value: field.draft,
    onChange: (e: ChangeEvent<HTMLInputElement>) => field.set(e.target.value),
    onBlur: field.flush,
    onKeyDown: (e: KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        field.flush();
        e.currentTarget.blur();
      } else if (e.key === 'Escape') {
        field.cancel();
        e.currentTarget.blur();
      }
    },
  };

  return { ...field, bind };
}

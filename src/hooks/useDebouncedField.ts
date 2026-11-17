import { useEffect, useState } from 'react';
import { createDebouncedField } from '../lib/debouncedField';

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
  commit: (next: T) => void,
  delay = 500
) {
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
  // changed, update the draft to match."
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    controller.receiveExternal(value);
    setDraft(controller.getDraft());
  }

  useEffect(() => {
    return () => controller.flush();
  }, [controller]);

  function set(next: T) {
    controller.set(next);
    setDraft(next);
  }

  function flush() {
    controller.flush();
    setDraft(controller.getDraft());
  }

  function cancel() {
    controller.cancel(value);
    setDraft(value);
  }

  return [draft, set, flush, cancel] as const;
}

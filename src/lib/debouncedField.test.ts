import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createDebouncedField } from './debouncedField';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('createDebouncedField', () => {
  it('commits once, only after the quiet window following the last set', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: '', commit, delay: 500 });

    field.set('P');
    vi.advanceTimersByTime(100);
    field.set('Pl');
    vi.advanceTimersByTime(100);
    field.set('Pla');

    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('Pla');
  });

  it('restarts the debounce window on every set', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: '', commit, delay: 500 });

    field.set('a');
    vi.advanceTimersByTime(499);
    field.set('ab');
    vi.advanceTimersByTime(499);
    expect(commit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('ab');
  });

  it('flush commits immediately and cancels the pending timer', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: '', commit, delay: 500 });

    field.set('abc');
    field.flush();
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit).toHaveBeenCalledWith('abc');

    vi.advanceTimersByTime(1000);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('flush with no dirty edits commits nothing', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.flush();
    expect(commit).not.toHaveBeenCalled();
  });

  it('shouldAccept is true while the draft is clean', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    expect(field.shouldAccept()).toBe(true);
  });

  it('shouldAccept is false while dirty or a commit is in flight', () => {
    // Every real call site commits asynchronously (mutateAsync) so inFlight
    // stays true until the promise settles — mirror that contract here.
    const commit = vi.fn(() => new Promise<void>(() => {}));
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    expect(field.shouldAccept()).toBe(false); // dirty

    field.flush(); // commit fires, now in flight
    expect(commit).toHaveBeenCalledWith('abcd');
    expect(field.shouldAccept()).toBe(false); // in flight
  });

  it('shouldAccept is true again once the commit settles', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    field.flush();
    expect(commit).toHaveBeenCalledWith('abcd');
    expect(field.shouldAccept()).toBe(true);
  });

  it('commits through the callback set last, not the one it was built with', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const field = createDebouncedField({
      value: '',
      commit: stale,
      delay: 500,
    });

    field.setCommit(fresh);
    field.set('abc');
    vi.advanceTimersByTime(500);

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledWith('abc');
  });

  it('cancel discards the pending edit and commits nothing', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    field.cancel('abc');
    expect(field.shouldAccept()).toBe(true);

    vi.advanceTimersByTime(1000);
    expect(commit).not.toHaveBeenCalled();
  });
});

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

  it('applies an external value while the draft is clean', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.receiveExternal('xyz');
    expect(field.getDraft()).toBe('xyz');
  });

  it('ignores an external value while dirty or a commit is in flight', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    field.receiveExternal('abc'); // stale server echo mid-edit
    expect(field.getDraft()).toBe('abcd');

    vi.advanceTimersByTime(500); // commit fires, now in flight
    expect(commit).toHaveBeenCalledWith('abcd');
    field.receiveExternal('abc'); // still the old echo
    expect(field.getDraft()).toBe('abcd');
  });

  it('resumes following the server once the echo matches the last commit', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    vi.advanceTimersByTime(500);
    expect(commit).toHaveBeenCalledWith('abcd');

    field.receiveExternal('abcd'); // echo caught up
    expect(field.getDraft()).toBe('abcd');

    field.receiveExternal('abcde'); // server-side change now flows through
    expect(field.getDraft()).toBe('abcde');
  });

  it('cancel discards the pending edit and commits nothing', () => {
    const commit = vi.fn();
    const field = createDebouncedField({ value: 'abc', commit, delay: 500 });

    field.set('abcd');
    field.cancel('abc');
    expect(field.getDraft()).toBe('abc');

    vi.advanceTimersByTime(1000);
    expect(commit).not.toHaveBeenCalled();
  });
});

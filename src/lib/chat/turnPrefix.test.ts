import { describe, it, expect } from 'vitest';
import { classifyTurnPrefix, parseDbChangeItems } from './turnPrefix';

describe('classifyTurnPrefix', () => {
  it('REGRESSION: a [DB Change: ...] batch with two moments does not leak a residue', () => {
    // The old implementation stripped this with a non-greedy regex that
    // stopped at the FIRST "]" in the string — which is the one closing
    // "[user]" on the first moment, not the one closing the whole prefix.
    // That left `"; task 1: created (Foo) [user]]"` behind as a user bubble.
    const text =
      '[DB Change: task a: status (todo->done) [user]; task 1: created (Foo) [user]]';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('db-change');
    expect(result.rest).toBe('');
  });

  it('REGRESSION: a single moment does not leave a trailing "]"', () => {
    const text = '[DB Change: task a: status (todo->done) [user]]';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('db-change');
    expect(result.rest).toBe('');
  });

  it('recognizes [Temporal Context: ...]', () => {
    const text = '[Temporal Context: current_time is 2026-01-01, timezone is UTC]\nhi';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('temporal-context');
    expect(result.rest).toBe('hi');
  });

  it('recognizes [UI Context: ...]', () => {
    const text = '[UI Context: user is currently looking at task abc]\nhi';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('ui-context');
    expect(result.rest).toBe('hi');
  });

  it('recognizes [Session Bootstrap: ...]', () => {
    const text = '[Session Bootstrap: This is the first turn]';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('session-bootstrap');
    expect(result.rest).toBe('');
  });

  it('preserves real user text that follows a prefix', () => {
    const text =
      '[Temporal Context: current_time is 2026-01-01, timezone is UTC]\n[UI Context: user is currently looking at task abc]\nwhat is overdue?';
    const result = classifyTurnPrefix(text);
    expect(result.rest).toBe('what is overdue?');
  });

  it('leaves text with no recognized prefix untouched', () => {
    const text = 'just a normal message with [brackets] inside';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('plain');
    expect(result.rest).toBe(text);
  });

  it('a DB Change batch stacked with a real user message strips only the prefix', () => {
    const text = '[DB Change: task a: created (Foo) [user]]\nactually, mark it done too';
    const result = classifyTurnPrefix(text);
    expect(result.type).toBe('db-change');
    expect(result.rest).toBe('actually, mark it done too');
  });
});

describe('parseDbChangeItems', () => {
  it('parses entity type, id, moment type and transition out of each item', () => {
    const items = parseDbChangeItems(
      'task a1: status (todo->done) [user]; project p1: created (Foo) [user]'
    );
    expect(items).toEqual([
      {
        entityType: 'task',
        entityId: 'a1',
        momentType: 'status',
        transition: 'todo->done',
        authoredBy: 'user',
      },
      {
        entityType: 'project',
        entityId: 'p1',
        momentType: 'created',
        transition: 'Foo',
        authoredBy: 'user',
      },
    ]);
  });

  it('handles a moment with no transition value', () => {
    const items = parseDbChangeItems('task a1: deleted [user]');
    expect(items).toEqual([
      {
        entityType: 'task',
        entityId: 'a1',
        momentType: 'deleted',
        transition: null,
        authoredBy: 'user',
      },
    ]);
  });
});

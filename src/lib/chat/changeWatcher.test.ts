import { describe, it, expect } from 'vitest';
import {
  isNudgeWorthy,
  ChangeBuffer,
  canNudge,
  formatDbChangePrefix,
  type MomentRow,
} from './changeWatcher';

function moment(overrides: Partial<MomentRow> = {}): MomentRow {
  return {
    id: 'm1',
    moment_type: 'status',
    value: 'done',
    previous_value: 'todo',
    authored_by: 'user',
    created_at: '2026-10-24T00:00:00Z',
    task_id: 'task-1',
    section_id: null,
    project_id: null,
    routine_id: null,
    ...overrides,
  };
}

describe('isNudgeWorthy', () => {
  it('treats status -> done/cancelled as worthy', () => {
    expect(isNudgeWorthy(moment({ moment_type: 'status', value: 'done' }))).toBe(
      true
    );
    expect(
      isNudgeWorthy(moment({ moment_type: 'status', value: 'cancelled' }))
    ).toBe(true);
  });

  it('does not treat other status transitions as worthy', () => {
    expect(
      isNudgeWorthy(moment({ moment_type: 'status', value: 'in_progress' }))
    ).toBe(false);
    expect(isNudgeWorthy(moment({ moment_type: 'status', value: 'todo' }))).toBe(
      false
    );
  });

  it('treats created/today/backlog/deleted as always worthy', () => {
    for (const moment_type of ['created', 'today', 'backlog', 'deleted']) {
      expect(isNudgeWorthy(moment({ moment_type, value: null }))).toBe(true);
    }
  });

  it('does not treat due/estimate/priority/renamed/moved/item/note as worthy', () => {
    for (const moment_type of [
      'due',
      'estimate',
      'priority',
      'renamed',
      'moved',
      'item',
      'note',
      'notToday',
      'scheduled',
      'target',
      'started',
      'stopped',
      'definition',
    ]) {
      expect(isNudgeWorthy(moment({ moment_type, value: 'x' }))).toBe(false);
    }
  });
});

describe('ChangeBuffer', () => {
  it('ignores assistant-authored rows', () => {
    const buf = new ChangeBuffer();
    buf.push([moment({ authored_by: 'assistant' })], 0);
    expect(buf.isEmpty()).toBe(true);
  });

  it('buffers user/system rows and reports silence correctly', () => {
    const buf = new ChangeBuffer();
    buf.push([moment()], 1000);
    expect(buf.isEmpty()).toBe(false);
    expect(buf.shouldFlush(1000 + 7999, 8000)).toBe(false);
    expect(buf.shouldFlush(1000 + 8000, 8000)).toBe(true);
  });

  it('resets the silence window on every push', () => {
    const buf = new ChangeBuffer();
    buf.push([moment({ id: 'm1' })], 0);
    buf.push([moment({ id: 'm2' })], 5000);
    expect(buf.shouldFlush(5000 + 7999, 8000)).toBe(false);
    expect(buf.shouldFlush(5000 + 8000, 8000)).toBe(true);
  });

  it('takeWorthyBatch returns null and clears the buffer when nothing is worthy', () => {
    const buf = new ChangeBuffer();
    buf.push(
      [moment({ moment_type: 'due', value: '2026-11-01', id: 'm1' })],
      0
    );
    expect(buf.takeWorthyBatch()).toBeNull();
    expect(buf.isEmpty()).toBe(true);
  });

  it('takeWorthyBatch returns every buffered row (not just the worthy ones) when at least one is worthy', () => {
    const buf = new ChangeBuffer();
    buf.push(
      [
        moment({ id: 'm1', moment_type: 'due', value: '2026-11-01' }),
        moment({ id: 'm2', moment_type: 'status', value: 'done' }),
      ],
      0
    );
    const batch = buf.takeWorthyBatch();
    expect(batch).not.toBeNull();
    expect(batch?.rows.map((r) => r.id)).toEqual(['m1', 'm2']);
    expect(batch?.lastMomentId).toBe('m2');
    expect(buf.isEmpty()).toBe(true);
  });
});

describe('canNudge', () => {
  it('blocks within the cooldown window', () => {
    expect(
      canNudge({
        lastNudgeAtMs: 0,
        nudgeTimestampsMs: [],
        nowMs: 5 * 60 * 1000,
        cooldownMs: 10 * 60 * 1000,
        maxPerHour: 6,
      })
    ).toBe(false);
  });

  it('allows once the cooldown has elapsed', () => {
    expect(
      canNudge({
        lastNudgeAtMs: 0,
        nudgeTimestampsMs: [0],
        nowMs: 10 * 60 * 1000,
        cooldownMs: 10 * 60 * 1000,
        maxPerHour: 6,
      })
    ).toBe(true);
  });

  it('blocks once the hourly cap is reached, counting only the last hour', () => {
    const now = 60 * 60 * 1000;
    const timestamps = [1, 1, 1, 1, 1, 1]; // 6 nudges, all within the last hour
    expect(
      canNudge({
        lastNudgeAtMs: now - 1,
        nudgeTimestampsMs: timestamps,
        nowMs: now,
        cooldownMs: 0,
        maxPerHour: 6,
      })
    ).toBe(false);
  });

  it('does not count nudges older than an hour against the cap', () => {
    const now = 2 * 60 * 60 * 1000;
    const staleTimestamps = [0, 0, 0, 0, 0, 0]; // 2 hours old
    expect(
      canNudge({
        lastNudgeAtMs: now - 1,
        nudgeTimestampsMs: staleTimestamps,
        nowMs: now,
        cooldownMs: 0,
        maxPerHour: 6,
      })
    ).toBe(true);
  });

  it('allows the very first nudge', () => {
    expect(
      canNudge({
        lastNudgeAtMs: null,
        nudgeTimestampsMs: [],
        nowMs: 0,
        cooldownMs: 10 * 60 * 1000,
        maxPerHour: 6,
      })
    ).toBe(true);
  });
});

describe('formatDbChangePrefix', () => {
  it('renders a compact, parseable summary of the batch', () => {
    const text = formatDbChangePrefix([
      moment({
        id: 'm1',
        moment_type: 'status',
        value: 'done',
        previous_value: 'todo',
        task_id: 'task-1',
        authored_by: 'user',
      }),
    ]);
    expect(text.startsWith('[DB Change:')).toBe(true);
    expect(text.endsWith(']')).toBe(true);
    expect(text).toContain('task task-1');
    expect(text).toContain('status');
    expect(text).toContain('todo->done');
    expect(text).toContain('[user]');
  });

  it('falls back to the bare value when there is no previous_value', () => {
    const text = formatDbChangePrefix([
      moment({
        moment_type: 'created',
        value: null,
        previous_value: null,
        task_id: 'task-2',
      }),
    ]);
    expect(text).toContain('task task-2');
    expect(text).toContain('created');
  });
});

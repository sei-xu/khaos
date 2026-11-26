import { describe, it, expect } from 'vitest';
import {
  presentBadges,
  pickBadgesForWidth,
  isCancelledName,
  NAME_FLOOR_CH,
  type TaskBadgeData,
} from './taskBadges';

function data(overrides: Partial<TaskBadgeData> = {}): TaskBadgeData {
  return {
    priority: 'medium',
    estimateMinutes: null,
    seqBefore: 0,
    seqAfter: 0,
    target: null,
    scheduledAt: null,
    due: null,
    ...overrides,
  };
}

describe('presentBadges', () => {
  it('returns no badges when every field is null/zero', () => {
    expect(presentBadges(data({ priority: null }), 'row')).toEqual([]);
  });

  it('includes exactly the kinds backed by a real value, in canonical order', () => {
    const badges = presentBadges(
      data({
        priority: 'high',
        estimateMinutes: 30,
        seqBefore: 2,
        seqAfter: 0,
        target: '["2026-08-01 00:00:00+00",)',
        scheduledAt: '2026-08-01T10:00:00Z',
        due: '2026-08-02T00:00:00Z',
      }),
      'row'
    );
    expect(badges.map((b) => b.kind)).toEqual([
      'priority',
      'estimate',
      'seqBefore',
      'target',
      'scheduled',
      'due',
    ]);
  });

  it('carries the count for sequence badges', () => {
    const badges = presentBadges(data({ seqBefore: 3, seqAfter: 5 }), 'row');
    expect(badges.find((b) => b.kind === 'seqBefore')?.count).toBe(3);
    expect(badges.find((b) => b.kind === 'seqAfter')?.count).toBe(5);
  });

  it('restricts the candidate set for a narrower density', () => {
    const badges = presentBadges(
      data({
        priority: 'high',
        estimateMinutes: 30,
        seqBefore: 2,
        due: '2026-08-02T00:00:00Z',
      }),
      'inline'
    );
    expect(badges.map((b) => b.kind)).toEqual(['priority', 'due']);
  });
});

describe('pickBadgesForWidth', () => {
  const full = data({
    priority: 'high',
    estimateMinutes: 30,
    seqBefore: 2,
    seqAfter: 1,
    target: '["2026-08-01 00:00:00+00",)',
    scheduledAt: '2026-08-01T10:00:00Z',
    due: '2026-08-02T00:00:00Z',
  });

  it('keeps every badge when width is generous', () => {
    const kept = pickBadgesForWidth(full, 120, 'row');
    expect(kept.map((b) => b.kind)).toEqual([
      'priority',
      'estimate',
      'seqBefore',
      'seqAfter',
      'target',
      'scheduled',
      'due',
    ]);
  });

  it('drops estimate and both sequence counters first as width shrinks', () => {
    const kept = pickBadgesForWidth(full, NAME_FLOOR_CH + 32, 'row');
    expect(kept.map((b) => b.kind)).toEqual(['priority', 'target', 'due']);
  });

  it('drops scheduled before target, and target before priority/due', () => {
    const keptWide = pickBadgesForWidth(full, 120, 'row').map((b) => b.kind);
    const keptNarrower = pickBadgesForWidth(full, 55, 'row').map((b) => b.kind);
    const keptNarrowest = pickBadgesForWidth(full, 40, 'row').map(
      (b) => b.kind
    );

    expect(keptWide).toContain('scheduled');

    expect(keptNarrower).not.toContain('scheduled');
    expect(keptNarrower).toContain('target');

    expect(keptNarrowest).not.toContain('target');
    expect(keptNarrowest).toContain('priority');
    expect(keptNarrowest).toContain('due');
  });

  it('only considers badges that are actually present', () => {
    const sparse = data({ priority: 'low', due: '2026-08-02T00:00:00Z' });
    const kept = pickBadgesForWidth(sparse, 1000, 'row');
    expect(kept.map((b) => b.kind)).toEqual(['priority', 'due']);
  });

  it('protects the name floor: keeps the full set exactly at the threshold, drops one badge just below it', () => {
    const atThreshold = pickBadgesForWidth(full, 74, 'row');
    expect(atThreshold).toHaveLength(7);

    const belowThreshold = pickBadgesForWidth(full, 73, 'row');
    expect(belowThreshold).toHaveLength(6);
    expect(belowThreshold.map((b) => b.kind)).not.toContain('estimate');
  });
});

describe('isCancelledName', () => {
  it('is true only for cancelled status', () => {
    expect(isCancelledName('cancelled')).toBe(true);
    expect(isCancelledName('done')).toBe(false);
    expect(isCancelledName('todo')).toBe(false);
    expect(isCancelledName(null)).toBe(false);
  });
});

import { describe, it, expect, vi } from 'vitest';
import { plannedOccurrences, type RoutineInput } from './occurrences';

const TZ = 'America/Sao_Paulo';

function routine(overrides: Partial<RoutineInput> = {}): RoutineInput {
  return {
    id: 'r1',
    name: 'Routine',
    frequency: 'daily',
    preferred_time: null,
    estimate: null,
    active: true,
    task_id: null,
    field_id: null,
    ...overrides,
  };
}

// 2026-10-26 is a Monday in America/Sao_Paulo.
const MONDAY = new Date('2026-10-26T03:00:00Z'); // local midnight
function daysLater(n: number): Date {
  return new Date(MONDAY.getTime() + n * 86400000);
}

const WINDOW_END = daysLater(14); // 14-day fixed window used by most tests

function isoDowsOf(occurrences: { start: Date }[]): number[] {
  return occurrences
    .map((o) => {
      const local = new Intl.DateTimeFormat('en-US', {
        timeZone: TZ,
        weekday: 'short',
      }).format(o.start);
      return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(local);
    })
    .sort((a, b) => a - b);
}

describe('plannedOccurrences — frequency coverage over a 14-day window', () => {
  it('daily produces one occurrence every day', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily' })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ).toHaveLength(14);
  });

  it('weekday produces occurrences only Mon-Fri', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'weekday' })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ).toHaveLength(10); // 2 full weeks * 5 weekdays
    for (const dow of isoDowsOf(occ)) expect(dow).toBeLessThanOrEqual(4);
  });

  it('weekend produces occurrences only Sat-Sun', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'weekend' })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ).toHaveLength(4); // 2 full weeks * 2 weekend days
    for (const dow of isoDowsOf(occ)) expect(dow).toBeGreaterThanOrEqual(5);
  });

  it('every_2_days produces a stable alternating pattern', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'every_2_days' })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ.length).toBeGreaterThan(0);
    expect(occ.length).toBeLessThanOrEqual(7);
    // Gaps between consecutive occurrences are always 2 days.
    for (let i = 1; i < occ.length; i++) {
      const gapDays = Math.round(
        (occ[i].start.getTime() - occ[i - 1].start.getTime()) / 86400000
      );
      expect(gapDays).toBe(2);
    }
  });

  it.each([1, 2, 3, 4, 5])(
    '%ix_week produces exactly %i occurrences per week',
    (n) => {
      const occ = plannedOccurrences(
        [routine({ frequency: `${n}x_week` })],
        MONDAY,
        WINDOW_END,
        TZ
      );
      expect(occ).toHaveLength(n * 2);
    }
  );

  it('1x_month and 2x_month each land within days 1-28', () => {
    const occ1 = plannedOccurrences(
      [routine({ frequency: '1x_month' })],
      MONDAY,
      daysLater(60),
      TZ
    );
    const occ2 = plannedOccurrences(
      [routine({ frequency: '2x_month' })],
      MONDAY,
      daysLater(60),
      TZ
    );
    expect(occ1.length).toBeGreaterThan(0);
    expect(occ2.length).toBeGreaterThan(0);
    for (const o of [...occ1, ...occ2]) {
      const day = Number(
        new Intl.DateTimeFormat('en-US', {
          timeZone: TZ,
          day: 'numeric',
        }).format(o.start)
      );
      expect(day).toBeLessThanOrEqual(28);
    }
  });

  it('does not always pile every 1x_week / 4x_week routine onto Monday-Thursday', () => {
    const routines = Array.from({ length: 6 }, (_, i) =>
      routine({ id: `w1-${i}`, frequency: '1x_week' })
    );
    const occ = plannedOccurrences(routines, MONDAY, WINDOW_END, TZ);
    const daysUsed = new Set(
      isoDowsOf(occ.filter((o) => o.start.getTime() < daysLater(7).getTime()))
    );
    // With 6 different routine ids spread via hashing, they should not all
    // collapse onto a single weekday.
    expect(daysUsed.size).toBeGreaterThan(1);
  });

  it('does not always pile every 1x_month / 2x_month routine onto day 1', () => {
    const routines = Array.from({ length: 8 }, (_, i) =>
      routine({ id: `m1-${i}`, frequency: '1x_month' })
    );
    const occ = plannedOccurrences(routines, MONDAY, daysLater(31), TZ);
    const daysUsed = new Set(
      occ.map((o) =>
        Number(
          new Intl.DateTimeFormat('en-US', {
            timeZone: TZ,
            day: 'numeric',
          }).format(o.start)
        )
      )
    );
    expect(daysUsed.size).toBeGreaterThan(1);
  });

  it('unknown/free-text frequency yields zero occurrences and warns, never throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const occ = plannedOccurrences(
      [routine({ frequency: '0 9 * * 1-5', name: 'Cron habit' })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ).toHaveLength(0);
    expect(warn).toHaveBeenCalled();
    expect(warn.mock.calls[0].join(' ')).toContain('Cron habit');
    warn.mockRestore();
  });

  it('inactive routine generates nothing', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily', active: false })],
      MONDAY,
      WINDOW_END,
      TZ
    );
    expect(occ).toHaveLength(0);
  });
});

describe('plannedOccurrences — time-of-day window', () => {
  it.each([
    ['morning', 8, 0],
    ['afternoon', 14, 0],
    ['evening', 19, 0],
    ['night', 21, 30],
    ['anytime', 9, 0],
    [null, 9, 0],
  ] as const)('preferred_time=%s starts at local %i:%i', (pref, hh, mm) => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily', preferred_time: pref })],
      MONDAY,
      daysLater(1),
      TZ
    );
    expect(occ).toHaveLength(1);
    const local = new Intl.DateTimeFormat('en-GB', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(occ[0].start);
    const expected = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    expect(local).toBe(expected);
  });

  it('missing estimate defaults the occurrence duration to 30 minutes', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily', estimate: null })],
      MONDAY,
      daysLater(1),
      TZ
    );
    expect(occ[0].end.getTime() - occ[0].start.getTime()).toBe(30 * 60000);
  });

  it('honors an explicit estimate', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily', estimate: 90 })],
      MONDAY,
      daysLater(1),
      TZ
    );
    expect(occ[0].end.getTime() - occ[0].start.getTime()).toBe(90 * 60000);
  });

  it('end is always strictly after start (duration_must_be_bounded)', () => {
    const occ = plannedOccurrences(
      [routine({ frequency: 'daily', estimate: 0 })],
      MONDAY,
      daysLater(3),
      TZ
    );
    for (const o of occ)
      expect(o.end.getTime()).toBeGreaterThan(o.start.getTime());
  });
});

describe('plannedOccurrences — determinism / dedup', () => {
  it('calling twice with the same window yields the exact same start instants', () => {
    const routines = [
      routine({ id: 'a', frequency: '3x_week' }),
      routine({ id: 'b', frequency: '2x_month' }),
      routine({ id: 'c', frequency: 'every_2_days' }),
    ];
    const first = plannedOccurrences(routines, MONDAY, WINDOW_END, TZ);
    const second = plannedOccurrences(routines, MONDAY, WINDOW_END, TZ);
    expect(first.map((o) => o.start.getTime())).toEqual(
      second.map((o) => o.start.getTime())
    );
  });
});

describe('plannedOccurrences — habit status / reschedule on skip', () => {
  it('a skipped Nx_week occurrence is made up on a later, otherwise-free day the same week', () => {
    const r = routine({
      id: 'gym',
      frequency: '4x_week',
      preferred_time: 'morning',
    });
    const base = plannedOccurrences([r], MONDAY, WINDOW_END, TZ);
    const skippedOccurrence = base[0]; // first occurrence that week
    const withMakeup = plannedOccurrences([r], MONDAY, WINDOW_END, TZ, [
      { routine_id: 'gym', start: skippedOccurrence.start, status: 'skipped' },
    ]);
    expect(withMakeup.length).toBe(base.length + 1);
    const baseStarts = new Set(base.map((o) => o.start.getTime()));
    const extra = withMakeup.find((o) => !baseStarts.has(o.start.getTime()));
    expect(extra).toBeDefined();
    expect(extra!.start.getTime()).toBeGreaterThan(
      skippedOccurrence.start.getTime()
    );
  });

  it('a done or partial occurrence never triggers a makeup', () => {
    const r = routine({ id: 'gym2', frequency: '4x_week' });
    const base = plannedOccurrences([r], MONDAY, WINDOW_END, TZ);
    for (const status of ['done', 'partial'] as const) {
      const occ = plannedOccurrences([r], MONDAY, WINDOW_END, TZ, [
        { routine_id: 'gym2', start: base[0].start, status },
      ]);
      expect(occ).toHaveLength(base.length);
    }
  });
});

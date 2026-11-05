import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { materializeRoutines } from './materialize';

const TZ = 'America/Sao_Paulo';
// 2026-10-26 is a Monday; local midnight in Sao Paulo.
const FROM = new Date('2026-10-26T03:00:00Z');
const TO = new Date(FROM.getTime() + 7 * 86400000);

interface EventRow {
  id: string;
  routine_id: string;
  duration: string;
  routine_status: string | null;
  routine_day: string | null;
}

// Minimal stand-in for the PostgREST builder: every filter method returns the
// builder, awaiting it resolves to the canned rows. The two `existing` queries
// are told apart by their upper bound (`.lt` on duration vs `.lte` on
// routine_day); each returns the rows a real query would match.
// `insertResult`, when given, overrides the default always-succeeds insert:
// called once per `.insert()` with the row(s) of that call and a 1-based
// call index (1 = the batch attempt, 2+ = the row-by-row fallback, each
// with a single-row array), so a test can fail the batch and then steer
// individual rows.
function fakeDb(
  events: EventRow[],
  insertResult?: (
    rows: Record<string, unknown>[],
    call: number
  ) => { error: { code?: string; message: string } | null }
) {
  const inserted: Record<string, unknown>[] = [];
  let insertCalls = 0;
  const builder = (table: string) => {
    let byRoutineDay = false;
    const b: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'is', 'in', 'gte', 'lt', 'or'])
      b[m] = () => b;
    b.lte = () => {
      byRoutineDay = true;
      return b;
    };
    b.insert = (
      rowOrRows: Record<string, unknown> | Record<string, unknown>[]
    ) => {
      insertCalls++;
      const rows = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      if (insertResult) {
        const { error } = insertResult(rows, insertCalls);
        if (!error) inserted.push(...rows);
        return Promise.resolve({ error });
      }
      inserted.push(...rows);
      return Promise.resolve({ error: null });
    };
    b.then = (resolve: (v: unknown) => unknown) => {
      if (table === 'routines')
        return resolve({
          data: [
            {
              id: 'r1',
              name: 'Gym',
              frequency: 'daily',
              preferred_time: 'morning',
              estimate: null,
              active: true,
              task_id: null,
              field_id: null,
            },
          ],
          error: null,
        });
      const rows = events.filter((e) =>
        byRoutineDay
          ? e.routine_day !== null
          : e.duration.startsWith('["2026-10-2') ||
            e.duration.startsWith('["2026-11-0')
      );
      return resolve({ data: rows, error: null });
    };
    return b;
  };
  return {
    db: { from: builder } as unknown as SupabaseClient,
    inserted,
  };
}

describe('materializeRoutines de-dup', () => {
  it('writes routine_day, the planned local day, on every insert', async () => {
    const { db, inserted } = fakeDb([]);
    const result = await materializeRoutines(db, {
      from: FROM,
      to: TO,
      timeZone: TZ,
    });
    expect(result.created).toBe(7);
    expect(inserted.map((r) => r.routine_day)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('does not recreate a day whose occurrence Google dragged to another day', async () => {
    // Planned for Tuesday 10-27, dragged to Thursday 10-29 afternoon in
    // Google: duration says Thursday, routine_day still says Tuesday.
    const { db, inserted } = fakeDb([
      {
        id: 'e1',
        routine_id: 'r1',
        duration: '["2026-10-29 17:00:00+00","2026-10-29 18:00:00+00")',
        routine_status: null,
        routine_day: '2026-10-27',
      },
    ]);
    const result = await materializeRoutines(db, {
      from: FROM,
      to: TO,
      timeZone: TZ,
    });
    // Tuesday is occupied by the moved row, so it is skipped...
    expect(inserted.map((r) => r.routine_day)).not.toContain('2026-10-27');
    expect(result.skipped).toBe(1);
    // ...and the other six days are still created.
    expect(result.created).toBe(6);
  });

  it('still finds a row Google moved out of the duration window', async () => {
    // Dragged a month out: only the routine_day lookup can find it.
    const { db, inserted } = fakeDb([
      {
        id: 'e3',
        routine_id: 'r1',
        duration: '["2026-12-15 17:00:00+00","2026-12-15 18:00:00+00")',
        routine_status: null,
        routine_day: '2026-10-27',
      },
    ]);
    await materializeRoutines(db, { from: FROM, to: TO, timeZone: TZ });
    expect(inserted.map((r) => r.routine_day)).not.toContain('2026-10-27');
    expect(inserted).toHaveLength(6);
  });

  it('falls back to the duration day for a row without routine_day', async () => {
    const { db, inserted } = fakeDb([
      {
        id: 'e2',
        routine_id: 'r1',
        duration: '["2026-10-28 11:00:00+00","2026-10-28 12:00:00+00")',
        routine_status: null,
        routine_day: null,
      },
    ]);
    await materializeRoutines(db, { from: FROM, to: TO, timeZone: TZ });
    expect(inserted.map((r) => r.routine_day)).not.toContain('2026-10-28');
    expect(inserted).toHaveLength(6);
  });

  it('falls back to row-by-row when the batch insert 23505s, skipping only the duplicate', async () => {
    const { db, inserted } = fakeDb([], (rows, call) => {
      if (call === 1) return { error: { code: '23505', message: 'dup' } };
      // Row-by-row calls happen in `toInsert` order; the first (10-26)
      // collides, the rest succeed.
      if (rows[0].routine_day === '2026-10-26')
        return { error: { code: '23505', message: 'dup' } };
      return { error: null };
    });
    const result = await materializeRoutines(db, {
      from: FROM,
      to: TO,
      timeZone: TZ,
    });
    expect(result.created).toBe(6);
    expect(result.skipped).toBe(1);
    expect(result.errors).toBe(0);
    expect(inserted.map((r) => r.routine_day)).not.toContain('2026-10-26');
  });

  it('falls back to row-by-row on a non-23505 batch error, reporting that one row via onInsertError', async () => {
    const { db } = fakeDb([], (rows, call) => {
      if (call === 1)
        return { error: { code: '23514', message: 'check violation' } };
      if (rows[0].routine_day === '2026-10-26')
        return { error: { code: '23514', message: 'check violation' } };
      return { error: null };
    });
    const reported: Array<{ day: string; message: string }> = [];
    const result = await materializeRoutines(db, {
      from: FROM,
      to: TO,
      timeZone: TZ,
      onInsertError: (occ, message) =>
        reported.push({ day: occ.start.toISOString(), message }),
    });
    expect(result.created).toBe(6);
    expect(result.skipped).toBe(0);
    expect(result.errors).toBe(1);
    expect(reported).toHaveLength(1);
    expect(reported[0].message).toBe('check violation');
  });
});

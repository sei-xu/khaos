import { describe, it, expect } from 'vitest';
import {
  isDryHour,
  findDryWindows,
  suggestDeparture,
  clothingBand,
  clothingAdvice,
  DRY_RAIN_PROB_MAX,
  DRY_PRECIP_MM_MAX,
  COLD_MAX_C,
  HOT_MIN_C,
} from './advice';
import type { HourPoint } from './forecast';

function hour(overrides: Partial<HourPoint> = {}): HourPoint {
  return {
    time: '2026-11-26T12:00',
    temperature: 20,
    apparentTemperature: 20,
    precipitationProbability: 0,
    precipitationMm: 0,
    weatherCode: 1,
    ...overrides,
  };
}

describe('isDryHour', () => {
  it('treats probability right at the threshold as NOT dry, just under as dry', () => {
    expect(
      isDryHour(hour({ precipitationProbability: DRY_RAIN_PROB_MAX - 1 }))
    ).toBe(true);
    expect(
      isDryHour(hour({ precipitationProbability: DRY_RAIN_PROB_MAX }))
    ).toBe(false);
    expect(
      isDryHour(hour({ precipitationProbability: DRY_RAIN_PROB_MAX + 1 }))
    ).toBe(false);
  });

  it('treats mm right at the threshold as NOT dry, just under as dry', () => {
    expect(isDryHour(hour({ precipitationMm: DRY_PRECIP_MM_MAX - 0.1 }))).toBe(
      true
    );
    expect(isDryHour(hour({ precipitationMm: DRY_PRECIP_MM_MAX }))).toBe(false);
  });

  it('treats null probability/mm as dry (no data = assume clear)', () => {
    expect(
      isDryHour(hour({ precipitationProbability: null, precipitationMm: null }))
    ).toBe(true);
  });
});

describe('findDryWindows', () => {
  it('returns a single window covering all contiguous dry hours', () => {
    const hours = [
      hour({ time: 'T00', precipitationProbability: 10 }),
      hour({ time: 'T01', precipitationProbability: 10 }),
      hour({ time: 'T02', precipitationProbability: 10 }),
    ];
    const windows = findDryWindows(hours);
    expect(windows).toHaveLength(1);
    expect(windows[0]).toEqual({ startIndex: 0, endIndex: 2 });
  });

  it('splits into multiple windows around a wet hour', () => {
    const hours = [
      hour({ precipitationProbability: 10 }),
      hour({ precipitationProbability: 90 }),
      hour({ precipitationProbability: 10 }),
      hour({ precipitationProbability: 10 }),
    ];
    const windows = findDryWindows(hours);
    expect(windows).toEqual([
      { startIndex: 0, endIndex: 0 },
      { startIndex: 2, endIndex: 3 },
    ]);
  });

  it('returns no windows when the whole day is wet', () => {
    const hours = [
      hour({ precipitationProbability: 90 }),
      hour({ precipitationProbability: 90 }),
    ];
    expect(findDryWindows(hours)).toEqual([]);
  });
});

describe('suggestDeparture', () => {
  it('picks the dry window ending closest to, and before, the target', () => {
    const windows = [
      { startIndex: 0, endIndex: 2 },
      { startIndex: 5, endIndex: 7 },
    ];
    expect(suggestDeparture(windows, 8)).toEqual({
      startIndex: 5,
      endIndex: 7,
    });
  });

  it('falls back to the closest window when none ends before the target', () => {
    const windows = [
      { startIndex: 10, endIndex: 12 },
      { startIndex: 20, endIndex: 22 },
    ];
    // target is before every window — the earliest one is "closest"
    expect(suggestDeparture(windows, 2)).toEqual({
      startIndex: 10,
      endIndex: 12,
    });
  });

  it('returns null when there are no dry windows at all', () => {
    expect(suggestDeparture([], 5)).toBeNull();
  });
});

describe('clothingBand', () => {
  it('bands at the cold/hot boundaries', () => {
    expect(clothingBand(COLD_MAX_C - 0.1)).toBe('frio');
    expect(clothingBand(COLD_MAX_C)).toBe('ameno');
    expect(clothingBand(HOT_MIN_C - 0.1)).toBe('ameno');
    expect(clothingBand(HOT_MIN_C)).toBe('calor');
  });
});

describe('clothingAdvice', () => {
  it('adds a rain mention only when rain is probable', () => {
    const dry = clothingAdvice(10, false);
    const wet = clothingAdvice(10, true);
    expect(dry).not.toMatch(/chuva/i);
    expect(wet).toMatch(/chuva/i);
  });

  it('gives a distinct message per band', () => {
    expect(clothingAdvice(5, false)).not.toBe(clothingAdvice(30, false));
    expect(clothingAdvice(20, false)).not.toBe(clothingAdvice(30, false));
  });
});

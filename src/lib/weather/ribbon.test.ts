import { describe, it, expect } from 'vitest';
import { valueToX, buildRibbonPoints } from './ribbon';

describe('valueToX', () => {
  it('places the series minimum and maximum at the two edges', () => {
    expect(valueToX(10, 10, 30, 100)).toBe(0);
    expect(valueToX(30, 10, 30, 100)).toBe(100);
    expect(valueToX(20, 10, 30, 100)).toBe(50);
  });

  it('clamps a value outside [min, max]', () => {
    expect(valueToX(-5, 10, 30, 100)).toBe(0);
    expect(valueToX(50, 10, 30, 100)).toBe(100);
  });

  it('returns the midpoint for a flat series instead of dividing by zero', () => {
    expect(valueToX(20, 20, 20, 100)).toBe(50);
  });
});

describe('buildRibbonPoints', () => {
  it('maps each value to x against the series min/max, keeping y as given', () => {
    const points = buildRibbonPoints([10, 20, 30], [0, 10, 20], 100);
    expect(points).toEqual([
      { y: 0, x: 0 },
      { y: 10, x: 50 },
      { y: 20, x: 100 },
    ]);
  });

  it('handles a single-point series without dividing by zero', () => {
    const points = buildRibbonPoints([42], [0], 100);
    expect(points).toEqual([{ y: 0, x: 50 }]);
  });

  it('keeps a missing point as x: null instead of inventing a position', () => {
    const points = buildRibbonPoints([10, null, 30], [0, 10, 20], 100);
    expect(points).toEqual([
      { y: 0, x: 0 },
      { y: 10, x: null },
      { y: 20, x: 100 },
    ]);
  });

  it('returns every x as null when the whole series is missing', () => {
    const points = buildRibbonPoints([null, null], [0, 10], 100);
    expect(points).toEqual([
      { y: 0, x: null },
      { y: 10, x: null },
    ]);
  });
});

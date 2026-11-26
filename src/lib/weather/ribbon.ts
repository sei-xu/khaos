// Pure geometry for the calendar's background weather ribbon: maps a value
// (temperature or rain probability) onto a horizontal offset within the
// day column, given the series' own min/max. No SVG/DOM — WeatherRibbon.tsx
// turns these points into a <path>.
export function valueToX(
  value: number,
  min: number,
  max: number,
  width: number
): number {
  if (max === min) return width / 2;
  const clamped = Math.min(max, Math.max(min, value));
  return ((clamped - min) / (max - min)) * width;
}

export interface RibbonPoint {
  y: number;
  x: number | null;
}

// `values[i]` pairs with `ys[i]` (the hour's vertical position); a null
// value stays x: null rather than being guessed from neighbors.
export function buildRibbonPoints(
  values: (number | null)[],
  ys: number[],
  width: number
): RibbonPoint[] {
  const present = values.filter((v): v is number => v !== null);
  if (!present.length) {
    return values.map((_, i) => ({ y: ys[i], x: null }));
  }
  const min = Math.min(...present);
  const max = Math.max(...present);
  return values.map((v, i) => ({
    y: ys[i],
    x: v === null ? null : valueToX(v, min, max, width),
  }));
}

// Pure recommendation logic over a forecast's hourly series: dry windows,
// a departure suggestion anchored on an event's start, and a clothing band
// from apparent temperature + rain. No fetch, no timezone handling — the
// caller (digest block, get_weather_forecast tool, calendar) already has
// hours in the order/timezone it cares about and passes plain indices.
import type { HourPoint } from './forecast';

// A "dry" hour: rain probability strictly below this percent AND
// precipitation strictly below this many mm. At-threshold counts as wet —
// picked so the digest/calendar never calls a 40%-chance hour "dry".
export const DRY_RAIN_PROB_MAX = 40;
export const DRY_PRECIP_MM_MAX = 0.2;

// Apparent-temperature bands (°C) for the clothing suggestion.
export const COLD_MAX_C = 15; // below this: frio
export const HOT_MIN_C = 25; // at/above this: calor (between: ameno)

export function isDryHour(hour: HourPoint): boolean {
  const prob = hour.precipitationProbability ?? 0;
  const mm = hour.precipitationMm ?? 0;
  return prob < DRY_RAIN_PROB_MAX && mm < DRY_PRECIP_MM_MAX;
}

// Mirror of the dry-hour rain gate for a single probability reading: the
// digest, the calendar chip and the get_weather_forecast tool all call an
// hour/day "rain probable" at exactly the threshold isDryHour() uses, so the
// number lives here once instead of as a literal 40 at each call site.
export function isRainProbable(
  probabilityPercent: number | null | undefined
): boolean {
  return (probabilityPercent ?? 0) >= DRY_RAIN_PROB_MAX;
}

export interface DryWindow {
  startIndex: number;
  endIndex: number;
}

// Contiguous runs of dry hours, by position in the given array (callers
// pass an already hour-ordered slice, so adjacency in the array means
// adjacency in time).
export function findDryWindows(hours: HourPoint[]): DryWindow[] {
  const windows: DryWindow[] = [];
  let start: number | null = null;
  for (let i = 0; i < hours.length; i++) {
    if (isDryHour(hours[i])) {
      if (start === null) start = i;
    } else if (start !== null) {
      windows.push({ startIndex: start, endIndex: i - 1 });
      start = null;
    }
  }
  if (start !== null)
    windows.push({ startIndex: start, endIndex: hours.length - 1 });
  return windows;
}

// Best window to leave in, given a target hour index (e.g. an event's
// start). Prefers the dry window ending soonest before the target — leaving
// as late as safely possible — and falls back to the closest window overall
// (by start distance) when none ends in time.
export function suggestDeparture(
  windows: DryWindow[],
  targetIndex: number
): DryWindow | null {
  if (!windows.length) return null;
  const before = windows.filter((w) => w.endIndex <= targetIndex);
  if (before.length) {
    return before.reduce((best, w) => (w.endIndex > best.endIndex ? w : best));
  }
  return windows.reduce((best, w) =>
    Math.abs(w.startIndex - targetIndex) <
    Math.abs(best.startIndex - targetIndex)
      ? w
      : best
  );
}

export type ClothingBand = 'frio' | 'ameno' | 'calor';

export function clothingBand(apparentTempC: number): ClothingBand {
  if (apparentTempC < COLD_MAX_C) return 'frio';
  if (apparentTempC >= HOT_MIN_C) return 'calor';
  return 'ameno';
}

const BASE_ADVICE: Record<ClothingBand, string> = {
  frio: 'Vista uma camada extra (casaco) — está frio.',
  ameno: 'Roupa leve, sem casaco — temperatura amena.',
  calor: 'Roupas leves e respiráveis — está quente.',
};

export function clothingAdvice(
  apparentTempC: number,
  rainProbable: boolean
): string {
  const base = BASE_ADVICE[clothingBand(apparentTempC)];
  return rainProbable ? `${base} Leve guarda-chuva ou capa de chuva.` : base;
}

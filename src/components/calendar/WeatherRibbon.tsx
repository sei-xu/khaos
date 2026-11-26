import { buildRibbonPoints } from '../../lib/weather/ribbon';
import type { HourPoint } from '../../lib/weather/forecast';

// Background-only (pointer-events-none, behind the event blocks), only
// drawn for the current day's column — see CalendarView. Two wavy lines
// along the 24 hours: temperature hugs the left edge and bulges right with
// higher values, rain probability hugs the right edge and bulges left —
// "one on each side" per the backlog item's request. A percentage-unit
// viewBox (0–100 wide) lets the SVG stretch to the column's real pixel
// width without recomputing geometry here.
const MAX_DISPLACEMENT = 32; // of the 100-unit viewBox width
const VIEWBOX_WIDTH = 100;

interface WeatherRibbonProps {
  hours: HourPoint[]; // expected: 24 entries, midnight to 23:00
  hourHeight: number;
  dayHeight: number;
}

function toPath(points: { x: number | null; y: number }[]): string {
  const present = points.filter(
    (p): p is { x: number; y: number } => p.x !== null
  );
  if (present.length < 2) return '';
  return present
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(2)},${p.y.toFixed(2)}`)
    .join(' ');
}

export default function WeatherRibbon({
  hours,
  hourHeight,
  dayHeight,
}: WeatherRibbonProps) {
  if (!hours.length) return null;

  const ys = hours.map((_, i) => i * hourHeight + hourHeight / 2);
  const temps = hours.map((h) => h.temperature);
  const rain = hours.map((h) => h.precipitationProbability);

  const tempPoints = buildRibbonPoints(temps, ys, MAX_DISPLACEMENT);
  const rainPoints = buildRibbonPoints(rain, ys, MAX_DISPLACEMENT).map((p) => ({
    ...p,
    x: p.x === null ? null : VIEWBOX_WIDTH - p.x,
  }));

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width="100%"
      height={dayHeight}
      viewBox={`0 0 ${VIEWBOX_WIDTH} ${dayHeight}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d={toPath(tempPoints)}
        fill="none"
        strokeWidth={1.5}
        style={{ stroke: 'var(--color-eros-400)', opacity: 0.35 }}
      />
      <path
        d={toPath(rainPoints)}
        fill="none"
        strokeWidth={1.5}
        style={{ stroke: 'var(--color-pontus-400)', opacity: 0.35 }}
      />
    </svg>
  );
}

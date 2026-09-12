import clsx from 'clsx';

interface KhaosIconProps {
  /** Icon container size (e.g., 'h-6 w-6', 'h-13 w-13' or custom Tailwind utility classes) */
  size?: string;
  /** Asterisk glyph size, expressed the same way callers already pass it
   * (a Tailwind text-size class) -- converted to an explicit pixel size
   * for the icon's own container via TEXT_SIZE_PX below, rather than
   * relying on font-size/line-height/em math. */
  fontSize?: string;
  /** Color of the asterisk character (e.g., 'text-eros-400') */
  color?: string;
  /** Background color of the circle (e.g., 'bg-nyx-700', 'bg-eros-500/15') */
  bgColor?: string;
  /** Determines whether the icon should rotate continuously */
  spin?: boolean;
  /** Extra classes */
  className?: string;
}

// Standard Tailwind text-size scale. The icon needs a real, explicit
// pixel box -- not an inherited font-size/line-height/em chain -- so
// rotation has an unambiguous center independent of text metrics.
const TEXT_SIZE_PX: Record<string, number> = {
  'text-xs': 12,
  'text-sm': 14,
  'text-base': 16,
  'text-lg': 18,
  'text-xl': 20,
  'text-2xl': 24,
  'text-3xl': 30,
  'text-4xl': 36,
  'text-5xl': 48,
  'text-6xl': 60,
  'text-7xl': 72,
  'text-8xl': 96,
  'text-9xl': 128,
};

export default function KhaosIcon({
  size = 'h-7 w-7',
  fontSize = 'text-xl',
  color = 'text-eros-400',
  bgColor = 'bg-transparent',
  spin = false,
  className = '',
}: KhaosIconProps) {
  const iconPx = TEXT_SIZE_PX[fontSize] ?? 20;

  return (
    <div
      className={clsx(
        'flex shrink-0 items-center justify-center rounded-full select-none',
        size,
        bgColor,
        className
      )}
    >
      {/* A dedicated container for the icon itself, sized in real px via
          inline style -- not em, not a Tailwind text-size class, not
          anything that pulls in a font's own line-height. Width and
          height are set to the exact same number, so this box is
          guaranteed square regardless of what font-size classes or
          line-height defaults are in play anywhere in the ancestor
          chain. Spin lives here too (not the outer div): some callers
          also pass animate-pulse via className on the outer div (the
          Vortex hero icon spins and pulses at once), and both would
          collide fighting over the same `animation` property on one
          element if they shared it. */}
      <div
        className={clsx(
          'flex items-center justify-center',
          color,
          spin ? 'animate-spin-slow' : ''
        )}
        style={{ width: iconPx, height: iconPx }}
      >
        {/* Same "✷" glyph as ever, but drawn via SVG text with explicit
            anchor points instead of plain inline text. A font glyph's
            baseline-based box (how CSS/flex centers text) isn't the same
            as its visual ink center -- textAnchor="middle" +
            dominantBaseline="central" pin the actual rendered shape to
            the SVG's own (50,50) coordinate, so rotating this square SVG
            (filling its square, explicitly-sized parent) rotates around
            the glyph's real visual center. */}
        <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden="true">
          <text
            x="50"
            y="50"
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="90"
            fill="currentColor"
          >
            ✷
          </text>
        </svg>
      </div>
    </div>
  );
}

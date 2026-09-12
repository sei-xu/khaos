import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import clsx from 'clsx';
import type { ReactNode } from 'react';
import KhaosIcon from '../../components/common/KhaosIcon';
import KhaoticText from '../../components/common/KhaoticText';

// Shared chrome for the Khaos Vault (/dev/vortex/*) — deliberately outside
// AppShell (no sidebar, no chat, no nav bar). The only wayfinding is a
// corner placard (logo + roman-numeral nav) and one subtle exit mark.
// Kept in sync by hand with VaultIndexPage's own CHAMBERS list -- seven
// fixed items, low churn, not worth a shared-import refactor yet.
const CHAMBER_NAV = [
  { index: 'I', name: 'The Pantheon', to: '/dev/vortex/pantheon' },
  { index: 'II', name: 'The Chorus', to: '/dev/vortex/chorus' },
  { index: 'III', name: 'The Wellspring', to: '/dev/vortex/wellspring' },
  { index: 'IV', name: 'The Forge', to: '/dev/vortex/forge' },
  { index: 'V', name: 'The Sigils', to: '/dev/vortex/sigils' },
  { index: 'VI', name: 'The Threshold', to: '/dev/vortex/threshold' },
  { index: 'VII', name: 'The Emblem', to: '/dev/vortex/emblem' },
];

export function MuseumFrame({
  currentIndex,
  exitTo = '/',
  children,
}: {
  currentIndex?: string;
  exitTo?: string;
  children: ReactNode;
}) {
  return (
    <div className="bg-nyx-900 relative min-h-screen">
      <Link
        to={exitTo}
        aria-label="Exit"
        className="text-nyx-700 hover:text-nyx-300 fixed top-6 right-6 z-10 transition-colors duration-300"
      >
        <X size={18} strokeWidth={1.5} />
      </Link>

      <div className="fixed top-6 left-6 z-10 flex items-center gap-4">
        <Link
          to="/dev/vortex"
          className="text-nyx-700 hover:text-nyx-300 flex items-center gap-2 font-mono text-[10px] tracking-[0.35em] uppercase transition-colors duration-300"
        >
          {/* Gave up chasing the spin here -- swapped to Tailwind's
              built-in animate-pulse instead of the custom rotation.
              Nudged down 1px: the glyph's own ink sits slightly high in
              its box, which read as misaligned against the title text
              next to it. */}
          <KhaosIcon
            size="h-7 w-7"
            fontSize="text-2xl"
            color="text-nyx-400"
            className="relative top-px animate-pulse"
          />
          khaos vortex
        </Link>

        <nav className="flex items-center gap-5">
          {CHAMBER_NAV.map((c) => (
            <div key={c.index} className="group flex items-center">
              <Link
                to={c.to}
                className={`font-serif text-sm transition-colors duration-300 ${
                  c.index === currentIndex
                    ? 'text-nyx-300'
                    : 'text-nyx-700 hover:text-nyx-400'
                }`}
              >
                {c.index}
              </Link>
              <Link
                to={c.to}
                className="font-serif text-nyx-400 hover:text-nyx-200 max-w-0 overflow-hidden text-sm whitespace-nowrap opacity-0 transition-all duration-300 group-hover:ml-2 group-hover:max-w-xs group-hover:opacity-100"
              >
                {c.name}
              </Link>
            </div>
          ))}
        </nav>
      </div>

      {children}
    </div>
  );
}

export function Section({
  title,
  children,
  nowrap = false,
}: {
  title: string;
  children: ReactNode;
  // Some sections read better as one continuous row (e.g. every status
  // or priority value together) than wrapped across lines -- opt in
  // per-section rather than changing the shared default.
  nowrap?: boolean;
}) {
  return (
    <section className="border-nyx-700 mb-10 border-t pt-6">
      <h2 className="text-nyx-400 mb-5 font-mono text-[10px] tracking-[0.25em] uppercase">
        {title}
      </h2>
      <div
        className={clsx(
          'flex items-center gap-5',
          // Padding compensates for focus rings / active borders on the
          // first and last item -- without it, overflow-x-auto's edge
          // sits flush against the content and clips them.
          nowrap ? 'flex-nowrap overflow-x-auto px-1 py-1' : 'flex-wrap'
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function Swatch({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-2">
      <span className="text-nyx-400 font-mono text-[10px]">{label}</span>
      {children}
    </div>
  );
}

interface ChamberProps {
  index: string;
  name: string;
  tagline: string;
  children: ReactNode;
  // Every chamber title runs KhaoticText by default now -- kept as a
  // prop (rather than removed) only in case a future chamber needs to
  // opt out.
  chaotic?: boolean;
  // Standard chambers (just text / simple content) run max-w-4xl. Chambers
  // displaying wide content (e.g. large font specimens) opt into max-w-6xl
  // instead. The title block always stays at max-w-4xl regardless, even
  // inside a wide chamber.
  wide?: boolean;
}

export function Chamber({
  index,
  name,
  tagline,
  children,
  chaotic = true,
  wide = false,
}: ChamberProps) {
  return (
    <MuseumFrame currentIndex={index} exitTo="/dev/vortex">
      <div
        className={`mx-auto px-6 pt-16 pb-12 ${wide ? 'max-w-6xl' : 'max-w-4xl'}`}
      >
        <div className="mb-14 max-w-4xl">
          <h1 className="font-serif text-nyx-100 text-3xl">
            {chaotic ? (
              <KhaoticText text={name} family="serif" className="text-3xl" />
            ) : (
              name
            )}
          </h1>
          <p className="text-nyx-400 mt-2 font-mono text-[11px] tracking-widest uppercase">
            {tagline}
          </p>
        </div>
        {children}
      </div>
    </MuseumFrame>
  );
}

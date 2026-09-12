import { Link } from 'react-router-dom';
import { MuseumFrame } from './vaultUI';
import KhaosIcon from '../../components/common/KhaosIcon';
import KhaoticText from '../../components/common/KhaoticText';

// Entrance to the Khaos Vault — full-bleed, no sidebar, no chat, no nav
// menu. Wayfinding is a single corner placard and one exit mark; moving
// between chambers happens by reading the list below, the way a museum
// floor plan works, not a persistent menu bar.
//
// The hero title runs KhaoticText (family="serif") -- the chamber-row
// titles below it stay static so the chaos reads as a single flourish on
// the page, not scattered across every heading.

interface ChamberEntry {
  to: string;
  index: string;
  name: string;
  tagline: string;
  contains: string;
  // Which of the two Vortex parts this chamber opens (see PARTS below).
  // Set only on the first chamber of each part -- it marks where the
  // part heading renders, not a per-chamber label.
  partOpener?: keyof typeof PARTS;
}

// The Vortex in two parts: I-III raise the tokens from nothing (color,
// type, space), IV-VI are the gods' working of those tokens into real
// marks and tools. Named to match the chambers' own Greek-primordial
// register, not generic "Part I / Part II".
const PARTS = {
  cosmogony: { name: 'Cosmogony', tagline: 'Where the tokens are born' },
  theurgy: { name: 'Theurgy', tagline: "The gods' working of them" },
} as const;

const CHAMBERS: ChamberEntry[] = [
  {
    to: '/dev/vortex/pantheon',
    index: 'I',
    name: 'The Pantheon',
    tagline: 'Every color, named for what it descends from',
    contains: 'Nyx · Aether · Eros · Pontus · Gaia · Tartarus · Hypnos',
    partOpener: 'cosmogony',
  },
  {
    to: '/dev/vortex/chorus',
    index: 'II',
    name: 'The Chorus',
    tagline: 'The type scale, sung as harmonic intervals',
    contains: 'Label · Caption · Body · Display · Display-lg',
  },
  {
    to: '/dev/vortex/wellspring',
    index: 'III',
    name: 'The Wellspring',
    tagline: 'Where every token is born',
    contains: 'Radii · Shadows · Spacing',
  },
  {
    to: '/dev/vortex/forge',
    index: 'IV',
    name: 'The Forge',
    tagline: 'Tools built for the hand',
    contains: 'Buttons · Inputs · Selects',
    partOpener: 'theurgy',
  },
  {
    to: '/dev/vortex/sigils',
    index: 'V',
    name: 'The Sigils',
    tagline: 'Marks that carry meaning',
    contains: 'Status · Priority · Fields · Dates · Tags',
  },
  {
    to: '/dev/vortex/threshold',
    index: 'VI',
    name: 'The Threshold',
    tagline: 'Where the app pauses to ask',
    contains: 'Modals · Empty states',
  },
  {
    to: '/dev/vortex/emblem',
    index: 'VII',
    name: 'The Emblem',
    tagline: 'The icon, the logo, the chaos in the letters',
    contains: 'Icon · Logo · KhaoticText',
  },
];

export default function VaultIndexPage() {
  return (
    <MuseumFrame>
      <div className="mx-auto max-w-lg px-6 pt-40 pb-32">
        <div className="relative mb-24 text-center">
          <div
            className="vortex-gradient pointer-events-none absolute inset-[-6rem] -z-10 opacity-70 blur-3xl"
            aria-hidden="true"
          />
          <KhaosIcon
            size="h-24 w-24"
            fontSize="text-8xl"
            color="text-nyx-700"
            spin
            className="animate-pulse mx-auto mb-2"
          />
          <h1 className="text-nyx-300">
            <KhaoticText
              text="Khaos Vortex"
              family={['display', 'serif', 'mono']}
              className="text-4xl"
              shimmer
            />
          </h1>
          <p className="text-nyx-600 mx-auto mt-4 max-w-sm font-mono text-[11px] tracking-widest uppercase">
            every token, every component, exactly as it renders
          </p>
        </div>

        <div className="flex flex-col">
          {CHAMBERS.map((c) => (
            <div key={c.to}>
              {c.partOpener && (
                <div
                  className={`flex items-baseline gap-3 ${c.index === 'I' ? '' : 'mt-4'}`}
                >
                  <span className="text-nyx-500 font-serif text-lg tracking-wide">
                    {PARTS[c.partOpener].name}
                  </span>
                  <span className="text-nyx-700 font-mono text-[10px] tracking-widest uppercase">
                    {PARTS[c.partOpener].tagline}
                  </span>
                </div>
              )}
              <Link
                to={c.to}
                className="group border-nyx-700 hover:border-nyx-600 flex items-start gap-6 border-t py-8 transition-colors duration-300 last:border-b"
              >
                <span className="text-nyx-700 group-hover:text-nyx-400 w-20 shrink-0 font-serif text-right text-6xl leading-none transition-colors duration-300">
                  {c.index}
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-serif text-nyx-100 text-2xl">
                    {c.name}
                  </h2>
                  <p className="text-nyx-600 mt-1 text-sm">{c.tagline}</p>
                  <p className="text-nyx-700 mt-2 font-mono text-[10px] tracking-wide">
                    {c.contains}
                  </p>
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </MuseumFrame>
  );
}

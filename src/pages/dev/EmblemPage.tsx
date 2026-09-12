import KhaosIcon from '../../components/common/KhaosIcon';
import KhaoticText from '../../components/common/KhaoticText';
import { KhaosLogo, KhaosTitle } from '../../components/common/KhaosLogo';
import { Chamber, Section, Swatch } from './vaultUI';

// The brand-identity layer -- not a token, not a data mark, just what
// Khaos looks like when it names itself. BRN, scoped for Theurgy: the
// app icon, the app logo, and KhaoticText, given their own chamber since
// none of the existing six were really about this.

export default function EmblemPage() {
  return (
    <Chamber
      index="VII"
      name="The Emblem"
      tagline="The icon, the logo, the chaos in the letters"
    >
      <Section title="Icon">
        {/* KhaosIcon -- a single ✷ asterisk in a circle, size/color/spin
            all props. Used standalone in the corner placard and the
            password-gate screen. */}
        <Swatch label="default">
          <KhaosIcon />
        </Swatch>
        <Swatch label="spinning">
          <KhaosIcon spin />
        </Swatch>
        <Swatch label="large, muted (corner placard)">
          <KhaosIcon size="h-7 w-7" fontSize="text-2xl" color="text-nyx-400" spin />
        </Swatch>
        <Swatch label="hero (password gate)">
          <KhaosIcon size="h-20 w-20" fontSize="text-7xl" color="text-eros-400" spin />
        </Swatch>
        <Swatch label="favicon">
          <img src="/favicon.svg" alt="" className="h-7 w-7" />
        </Swatch>
      </Section>

      <Section title="Logo &amp; wordmark">
        {/* KhaosLogo pairs the icon with KhaosTitle (the wordmark, itself
            just KhaoticText locked to text="Khaos"). Used in the sidebar. */}
        <Swatch label="full logo (icon + wordmark)">
          <KhaosLogo />
        </Swatch>
        <Swatch label="wordmark alone">
          <KhaosTitle className="text-base" />
        </Swatch>
        <Swatch label="wordmark, large (password gate)">
          <KhaosTitle className="text-6xl" />
        </Swatch>
      </Section>

      <Section title="KhaoticText">
        {/* The randomized weight/width/family/italic title effect --
            every Vortex chamber title runs this by default (see Chamber's
            chaotic prop in vaultUI.tsx). */}
        <Swatch label="serif (chamber titles)">
          <KhaoticText text="The Emblem" family="serif" className="text-3xl" />
        </Swatch>
        <Swatch label="single-family (comparison only)">
          <KhaoticText text="Khaos" family="display" className="text-3xl" />
        </Swatch>
        <Swatch label="multi-family + shimmer (home hero)">
          <KhaoticText
            text="Khaos Vortex"
            family={['display', 'serif', 'mono']}
            className="text-4xl"
            shimmer
          />
        </Swatch>
      </Section>

      <div className="max-w-prose text-caption leading-relaxed">
        <p className="text-nyx-200 mb-3 font-semibold tracking-wide uppercase">
          What KhaoticText actually randomizes
        </p>
        <p className="text-nyx-400">
          Per character, independently: font weight, width (where the
          family has a width axis -- only Roboto Flex does), and a roughly
          1-in-4 chance of italic. The letters themselves never change,
          only their style, on a per-character timer -- it reads as a
          living title, not a glitch effect. <code className="text-eros-400">
            shimmer
          </code>{' '}
          layers a slow gradient-fill band traveling across the same
          text, used only on the home hero.
        </p>
      </div>
    </Chamber>
  );
}

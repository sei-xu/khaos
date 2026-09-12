import KhaosIcon from '../common/KhaosIcon'; // Ajusta o caminho relativo se necessário
import KhaoticText from './KhaoticText';

interface KhaosLogoProps {
  spinning?: boolean;
}

export function KhaosLogo({ spinning }: KhaosLogoProps) {
  return (
    <div className="flex items-center gap-2">
      <KhaosIcon
        size="h-5 w-5"
        color="text-eros-400"
        bgColor="bg-transparent"
        spin={spinning}
      />
      <KhaosTitle className="text-base" />
    </div>
  );
}

interface KhaosTitleProps {
  className?: string;
}

export function KhaosTitle({ className }: KhaosTitleProps) {
  return (
    <KhaoticText
      text="Khaos"
      family={['display', 'serif', 'mono']}
      className={`${className} text-nyx-100 tracking-widest capitalize`}
    />
  );
}

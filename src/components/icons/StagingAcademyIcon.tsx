import { forwardRef } from 'react';
import type { LucideProps } from 'lucide-react';

// Vector mark from the Staging Academy brand file (marca.ai, artboard 9),
// traced from the source PDF paths. Ported as a lucide-compatible icon
// component so it drops into FIELDS_CONFIG alongside the lucide-react set.
const StagingAcademyIcon = forwardRef<SVGSVGElement, LucideProps>(
  (
    {
      size = 24,
      color = 'currentColor',
      // Aceito e descartado: a marca é preenchida (`fill`), não traçada, então
      // uma espessura de traço não teria efeito nenhum. Fica desestruturado só
      // para não cair no `...rest` e virar atributo inútil no DOM. O prefixo
      // `_` é o que o argsIgnorePattern do eslint espera.
      strokeWidth: _strokeWidth,
      className,
      ...rest
    },
    ref
  ) => (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 300 300"
      fill="none"
      className={className}
      {...rest}
    >
      <path
        transform="matrix(1,0,0,-1,28.9617,134.646)"
        d="M0 0-9.72 13.882 250.888 14.214 261.796-1.364 147.66-81.283 139.668-69.87 240.848 .977 240.633 1.285Z"
        fill={color}
      />
      <path
        transform="matrix(1,0,0,-1,77.2495,203.2674)"
        d="M0 0-9.473 12.465 94.519 161.38H113.536V-54.846H99.603V145.564H99.226Z"
        fill={color}
      />
    </svg>
  )
);

StagingAcademyIcon.displayName = 'StagingAcademyIcon';

export default StagingAcademyIcon;

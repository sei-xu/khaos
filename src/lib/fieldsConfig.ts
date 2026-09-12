// Static per-field visual identity (icon + color), keyed by the field's
// `name` exactly as stored in the `fields` table. This mirrors a previous
// frontend's FIELDS_CONFIG, ported from Heroicons to lucide-react.
//
// Fields are user-managed rows in the DB (see ProjectsPage "New field"),
// so a field created outside this list — or renamed — falls back to
// DEFAULT_FIELD_META below rather than breaking the badge.
//
// Color model (ENT, Round 2): the 11 real fields form one full hue
// circle, anchored on Staging Academy's existing brand blue (#3772ff,
// hue ~222°) rather than an arbitrary starting point. The other 10 are
// spaced evenly around it (360°/11 ≈ 32.7° apart) in the order below,
// so adjacent fields in that list are adjacent in hue too.
//
// Saturation/lightness revised (still Round 2): the original pass pinned
// saturation at 100%, which read as neon/off-brand next to the rest of
// the app -- every deity accent color (Eros, Pontus, Gaia, Tartarus,
// Hypnos) sits around S 50-60%, nothing else in the palette is fully
// saturated. Rebuilt at S 55% / L 58% (same hues, unchanged spacing) to
// match that register. Lightness bumped further on the two hues that
// then failed WCAG AA against nyx-900 (Pessoal, Som) -- same "clear
// 4.5:1, nowhere else" rule as before. Staging Academy itself is
// unchanged and stays the one exception: it's a fixed existing brand
// color, not a value this system gets to tune, so it's also the one
// field still under AA (4.13:1) and still fully saturated.
import {
  Sparkles,
  Box,
  Scissors,
  User,
  GraduationCap,
  Layers,
  Radio,
  Code2,
  Folder,
  FileText,
  type LucideIcon,
  Brush,
} from 'lucide-react';
import StagingAcademyIcon from '../components/icons/StagingAcademyIcon';

export interface FieldMeta {
  icon: LucideIcon;
  color: string; // hex, kept for reference/debugging
  classes: {
    border: string;
    bg: string;
    text: string;
    muted: string;
  };
}

// Classes are written out as full literal strings, not built from a
// helper -- Tailwind's scanner needs the exact `border-[#hex]/20` text
// present in source to generate it; a template-built class name is
// invisible to it and silently produces no CSS.
export const FIELDS_CONFIG: Record<string, FieldMeta> = {
  Pessoal: {
    icon: User,
    color: '#d15f6c',
    classes: {
      border: 'border-[#d15f6c]/20',
      bg: 'bg-[#d15f6c]/10',
      text: 'text-[#d15f6c]',
      muted: 'text-[#d15f6c]/60',
    },
  },
  Pesquisa: {
    icon: GraduationCap,
    color: '#cf8c59',
    classes: {
      border: 'border-[#cf8c59]/20',
      bg: 'bg-[#cf8c59]/10',
      text: 'text-[#cf8c59]',
      muted: 'text-[#cf8c59]/60',
    },
  },
  // Was missing from the old 10-field list entirely -- the app has 11
  // real fields, this one just never got an entry.
  Textos: {
    icon: FileText,
    color: '#cfcd59',
    classes: {
      border: 'border-[#cfcd59]/20',
      bg: 'bg-[#cfcd59]/10',
      text: 'text-[#cfcd59]',
      muted: 'text-[#cfcd59]/60',
    },
  },
  Caligrafia: {
    icon: Brush,
    color: '#90cf59',
    classes: {
      border: 'border-[#90cf59]/20',
      bg: 'bg-[#90cf59]/10',
      text: 'text-[#90cf59]',
      muted: 'text-[#90cf59]/60',
    },
  },
  Artes: {
    icon: Sparkles,
    color: '#59cf61',
    classes: {
      border: 'border-[#59cf61]/20',
      bg: 'bg-[#59cf61]/10',
      text: 'text-[#59cf61]',
      muted: 'text-[#59cf61]/60',
    },
  },
  Design: {
    icon: Box,
    color: '#59cfa2',
    classes: {
      border: 'border-[#59cfa2]/20',
      bg: 'bg-[#59cfa2]/10',
      text: 'text-[#59cfa2]',
      muted: 'text-[#59cfa2]/60',
    },
  },
  Costura: {
    icon: Scissors,
    color: '#59bbcf',
    classes: {
      border: 'border-[#59bbcf]/20',
      bg: 'bg-[#59bbcf]/10',
      text: 'text-[#59bbcf]',
      muted: 'text-[#59bbcf]/60',
    },
  },
  'Staging Academy': {
    icon: StagingAcademyIcon,
    color: '#3772ff',
    classes: {
      border: 'border-[#3772ff]/20',
      bg: 'bg-[#3772ff]/10',
      text: 'text-[#3772ff]',
      muted: 'text-[#3772ff]/60',
    },
  },
  Som: {
    icon: Radio,
    color: '#8c73d6',
    classes: {
      border: 'border-[#8c73d6]/20',
      bg: 'bg-[#8c73d6]/10',
      text: 'text-[#8c73d6]',
      muted: 'text-[#8c73d6]/60',
    },
  },
  Imagem: {
    icon: Layers,
    color: '#b759cf',
    classes: {
      border: 'border-[#b759cf]/20',
      bg: 'bg-[#b759cf]/10',
      text: 'text-[#b759cf]',
      muted: 'text-[#b759cf]/60',
    },
  },
  Programação: {
    icon: Code2,
    color: '#cf59a8',
    classes: {
      border: 'border-[#cf59a8]/20',
      bg: 'bg-[#cf59a8]/10',
      text: 'text-[#cf59a8]',
      muted: 'text-[#cf59a8]/60',
    },
  },
};

// Telegram has no color or icons -- plain text/markdown only. One emoji
// per field, chosen to mirror the lucide icon above it, plus the name in
// caps (e.g. "📦 DESIGN"). Not yet wired into the telegram-bot/
// telegram-notify functions.
export const FIELD_EMOJI: Record<string, string> = {
  Pessoal: '🧑',
  Pesquisa: '🎓',
  Textos: '📄',
  Caligrafia: '🖌️',
  Artes: '✨',
  Design: '📦',
  Costura: '✂️',
  'Staging Academy': '🏫',
  Som: '🎧',
  Imagem: '🖼️',
  Programação: '💻',
};

// Used for any field name not present in FIELDS_CONFIG above (new fields
// created via the "New field" button aren't guaranteed to match this list).
export const DEFAULT_FIELD_META: FieldMeta = {
  icon: Folder,
  color: 'ink',
  classes: {
    border: 'border-nyx-600/40',
    bg: 'bg-nyx-700/40',
    text: 'text-nyx-300',
    muted: 'text-nyx-400/60',
  },
};

export function getFieldMeta(fieldName?: string | null): FieldMeta {
  if (!fieldName) return DEFAULT_FIELD_META;
  return FIELDS_CONFIG[fieldName] ?? DEFAULT_FIELD_META;
}

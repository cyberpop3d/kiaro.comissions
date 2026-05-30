import type { DesignConfig } from '@/lib/types';

const paletteVars: Record<DesignConfig['palette'], Record<string, string>> = {
  portfolio: {
    '--kiaro-bg-base': '#070908',
    '--kiaro-text-main': '#f4f3ec',
    '--kiaro-text-muted': 'rgba(244,243,236,.62)',
    '--kiaro-panel-rgb': '18, 21, 21',
    '--kiaro-line': 'rgba(255, 255, 255, .105)',
    '--kiaro-line-strong': 'rgba(255, 255, 255, .18)',
    '--kiaro-accent': '#f4f3ec',
    '--kiaro-accent-contrast': '#090b0b'
  },
  graphite: {
    '--kiaro-bg-base': '#08090b',
    '--kiaro-text-main': '#f2f4f7',
    '--kiaro-text-muted': 'rgba(242,244,247,.58)',
    '--kiaro-panel-rgb': '17, 19, 24',
    '--kiaro-line': 'rgba(255,255,255,.095)',
    '--kiaro-line-strong': 'rgba(255,255,255,.18)',
    '--kiaro-accent': '#d9dee7',
    '--kiaro-accent-contrast': '#08090b'
  },
  warm: {
    '--kiaro-bg-base': '#0b0907',
    '--kiaro-text-main': '#f5efe6',
    '--kiaro-text-muted': 'rgba(245,239,230,.60)',
    '--kiaro-panel-rgb': '24, 19, 15',
    '--kiaro-line': 'rgba(255,240,220,.105)',
    '--kiaro-line-strong': 'rgba(255,240,220,.20)',
    '--kiaro-accent': '#f2d8b1',
    '--kiaro-accent-contrast': '#120b06'
  },
  cyan: {
    '--kiaro-bg-base': '#05090b',
    '--kiaro-text-main': '#effcff',
    '--kiaro-text-muted': 'rgba(239,252,255,.60)',
    '--kiaro-panel-rgb': '10, 18, 22',
    '--kiaro-line': 'rgba(210,245,255,.11)',
    '--kiaro-line-strong': 'rgba(210,245,255,.22)',
    '--kiaro-accent': '#bff7ff',
    '--kiaro-accent-contrast': '#041013'
  },
  mono: {
    '--kiaro-bg-base': '#050505',
    '--kiaro-text-main': '#f6f6f6',
    '--kiaro-text-muted': 'rgba(246,246,246,.55)',
    '--kiaro-panel-rgb': '12, 12, 12',
    '--kiaro-line': 'rgba(255,255,255,.10)',
    '--kiaro-line-strong': 'rgba(255,255,255,.22)',
    '--kiaro-accent': '#ffffff',
    '--kiaro-accent-contrast': '#050505'
  }
};

const fontVars: Record<DesignConfig['fontFamily'], Record<string, string>> = {
  inter: { '--font-display': "'Inter Tight'", '--font-body': "'Inter'" },
  system: { '--font-display': 'system-ui', '--font-body': 'system-ui' },
  space: { '--font-display': "'Space Grotesk'", '--font-body': "'Inter'" },
  manrope: { '--font-display': "'Manrope'", '--font-body': "'Manrope'" },
  archivo: { '--font-display': "'Archivo'", '--font-body': "'Archivo'" }
};

export function applyDesignConfig(config: DesignConfig) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const palette = paletteVars[config.palette] || paletteVars.portfolio;
  const fonts = fontVars[config.fontFamily] || fontVars.inter;

  Object.entries({ ...palette, ...fonts }).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });

  if (config.accentColor?.trim()) {
    root.style.setProperty('--kiaro-accent', config.accentColor.trim());
  }

  root.dataset.buttonStyle = config.buttonStyle || 'pill';
  root.dataset.cardStyle = config.cardStyle || 'soft';
  root.dataset.backgroundMode = config.backgroundMode || 'subtle';
}

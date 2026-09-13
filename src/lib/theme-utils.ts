import React from 'react';
import { THEME_PRESETS } from '@/theme/themes';

export type ThemeTokens = {
  primary?: string;
  accent?: string;
  start?: string;
  end?: string;
  angle?: number;
  radius?: string;
  background?: string;
};

export function themeStyleFromPreset(name: string, isDarkMode?: boolean): React.CSSProperties | undefined {
  const preset = THEME_PRESETS.find(p => p.name === name);
  if (!preset) return undefined;
  
  const parseHsl = (val?: string) => {
    if (!val) return null;
    const parts = val.split(' ').map(s => s.trim());
    if (parts.length < 3) return null;
    const h = Number(parts[0]);
    const s = Number(parts[1].replace('%', ''));
    const l = Number(parts[2].replace('%', ''));
    if (Number.isNaN(h) || Number.isNaN(s) || Number.isNaN(l)) return null;
    return { h, s, l };
  };
  
  const lighten = (hsl: { h: number; s: number; l: number }, amount: number) => {
    const nl = Math.min(100, Math.max(0, hsl.l + amount));
    return `${hsl.h} ${hsl.s}% ${nl}%`;
  };
  
  const darken = (hsl: { h: number; s: number; l: number }, amount: number) => {
    const nl = Math.min(100, Math.max(0, hsl.l - amount));
    return `${hsl.h} ${hsl.s}% ${nl}%`;
  };
  
  // Real current mode, not the preset's own static `dark` field -- this
  // preset is a per-module ACCENT color (e.g. "Azure Sky" for
  // Opportunities), applied as a scoped inline-style override on top of
  // whatever the user's actual global light/dark choice is. Previously
  // this derived `isDark` from the preset alone and used it to also
  // hardcode --card/--foreground/--border/--popover/--background/
  // --sidebar-*, which silently reverted every page using this helper
  // (nearly every core CRM list/detail page) back to light-mode surface
  // colors whenever the preset didn't declare `dark: true` -- regardless
  // of the global dark-mode toggle. Those foundational tokens are already
  // correctly dark/light-aware via ThemeProvider + index.css's .dark
  // cascade, so this helper now only skins the module's accent color and
  // table-header tint, and leaves surface tokens alone.
  //
  // Callers should pass `isDarkMode` explicitly from useTheme().isDark --
  // that's a real React state value, so a component consuming it
  // re-renders (and recomputes this style) the instant dark mode toggles.
  // The DOM-read fallback below is a snapshot taken only whenever THIS
  // component happens to render; pages that don't otherwise re-render
  // after the toggle (most of them -- they don't consume theme context)
  // freeze on whatever mode was active at their last render, which is
  // often light (ThemeProvider adds the `dark` class in an effect that
  // runs after first paint, so a fresh page load's first render sees no
  // `dark` class yet and bakes light-mode colors in permanently).
  const isDark = typeof isDarkMode === 'boolean'
    ? isDarkMode
    : typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  const primaryParsed = parseHsl(preset.primary);

  const style: React.CSSProperties = {
    ['--primary' as any]: preset.primary,
    ['--accent' as any]: preset.accent,
    ['--gradient-primary' as any]: `linear-gradient(${preset.angle ?? 135}deg, hsl(${preset.start}) 0%, hsl(${preset.end}) 100%)`,
    ['--radius' as any]: preset.radius ?? '0.5rem',
    ['--ring' as any]: preset.primary || (preset as any).accent || '217 91% 60%',
  };

  if ((preset as any).titleStrip) {
    style['--table-header-background' as any] = (preset as any).titleStrip;
  }

  const thSep = primaryParsed ? (isDark ? lighten(primaryParsed, 10) : darken(primaryParsed, 5)) : undefined;
  const thBg = primaryParsed
    ? (isDark ? `${primaryParsed.h} 25% 20%` : lighten(primaryParsed, 45))
    : undefined;

  if (thSep) style['--table-header-separator' as any] = thSep;
  if (thBg) style['--table-header-background' as any] = thBg;

  return style;
}

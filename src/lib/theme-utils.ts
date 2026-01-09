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

export function themeStyleFromPreset(name: string): React.CSSProperties | undefined {
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
  
  const isDark = !!(preset as any).dark;
  const primaryParsed = parseHsl(preset.primary);
  
  const style: React.CSSProperties = {
    ['--primary' as any]: preset.primary,
    ['--accent' as any]: preset.accent,
    ['--gradient-primary' as any]: `linear-gradient(${preset.angle ?? 135}deg, hsl(${preset.start}) 0%, hsl(${preset.end}) 100%)`,
    ['--radius' as any]: preset.radius ?? '0.5rem',
  };
  
  if ((preset as any).bgStart && (preset as any).bgEnd) {
    style['--background' as any] = (preset as any).bgStart;
  }
  
  if ((preset as any).sidebarBackground) {
    style['--sidebar-background' as any] = (preset as any).sidebarBackground;
  }
  
  if ((preset as any).sidebarAccent) {
    style['--sidebar-accent' as any] = (preset as any).sidebarAccent;
  }
  
  if ((preset as any).titleStrip) {
    style['--table-header-background' as any] = (preset as any).titleStrip;
  }
  
  const thText = isDark ? '210 40% 98%' : '222.2 84% 4.9%';
  const thSep = primaryParsed ? (isDark ? lighten(primaryParsed, 10) : darken(primaryParsed, 5)) : undefined;
  const thBg = primaryParsed ? (isDark ? lighten(primaryParsed, 5) : lighten(primaryParsed, 45)) : undefined;
  
  const tableBg = isDark ? '222.2 84% 4.9%' : '0 0% 100%';
  const tableFg = isDark ? '210 40% 98%' : '222.2 84% 4.9%';
  
  style['--table-header-text' as any] = thText;
  if (thSep) style['--table-header-separator' as any] = thSep;
  if (thBg) style['--table-header-background' as any] = thBg;
  style['--table-background' as any] = tableBg;
  style['--table-foreground' as any] = tableFg;
  
  style['--ring' as any] = preset.primary || (preset as any).accent || '217 91% 60%';
  style['--foreground' as any] = isDark ? '210 40% 98%' : '222 47% 11%';
  
  const borderColor = primaryParsed ? (isDark ? lighten(primaryParsed, 50) : lighten(primaryParsed, 70)) : (isDark ? '217 32% 30%' : '214 32% 91%');
  style['--border' as any] = borderColor;
  style['--input' as any] = borderColor;
  
  const cardBg = isDark ? '222 47% 11%' : '0 0% 100%';
  const cardFg = isDark ? '210 40% 98%' : '222 47% 11%';
  const popoverBg = cardBg;
  const popoverFg = cardFg;
  
  style['--card' as any] = cardBg;
  style['--card-foreground' as any] = cardFg;
  style['--popover' as any] = popoverBg;
  style['--popover-foreground' as any] = popoverFg;
  
  return style;
}

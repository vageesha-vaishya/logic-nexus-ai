import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_PRESETS } from '@/theme/themes';

export type SavedTheme = {
  name: string;
  start: string;
  end: string;
  primary?: string;
  accent?: string;
  angle?: number; // gradient angle in degrees
  radius?: string; // e.g., "0.75rem"
  sidebarBackground?: string;
  sidebarAccent?: string;
  dark?: boolean;
  // Main page background gradient overrides
  bgStart?: string;
  bgEnd?: string;
  bgAngle?: number;
  createdAt: string;
};

type ThemeContextValue = {
  themes: SavedTheme[];
  activeThemeName: string | null;
  applyTheme: (t: { start: string; end: string; primary?: string; accent?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => void;
  saveTheme: (t: { name: string; start: string; end: string; primary?: string; accent?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => void;
  setActive: (name: string) => void;
  toggleDark: (enabled: boolean) => void;
};

const LS_THEMES_KEY = 'soslogicpro.themes';
const LS_ACTIVE_KEY = 'soslogicpro.activeThemeName';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const LS_DARK_KEY = 'soslogicpro.darkMode';

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_THEMES_KEY);
      const active = localStorage.getItem(LS_ACTIVE_KEY);
      const darkStored = localStorage.getItem(LS_DARK_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedTheme[]) : [];
      setThemes(parsed);
      setActiveThemeName(active);
      if (active) {
        const found = parsed.find(t => t.name === active);
        if (found) applyTheme(found);
      } else {
        // Apply Original Logistics theme by default when no active theme is set
        const preset = THEME_PRESETS.find(p => p.name === 'Original Logistics');
        if (preset) {
          applyTheme({
            start: preset.start,
            end: preset.end,
            primary: preset.primary,
            accent: preset.accent,
            angle: preset.angle,
            radius: preset.radius,
            sidebarBackground: preset.sidebarBackground,
            sidebarAccent: preset.sidebarAccent,
            dark: preset.dark,
            bgStart: preset.bgStart,
            bgEnd: preset.bgEnd,
            bgAngle: preset.bgAngle,
          });
        }
      }
      if (darkStored) {
        toggleDark(darkStored === 'true');
      }
    } catch {}
  }, []);

  const applyTheme = (t: { start: string; end: string; primary?: string; accent?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => {
    const root = document.documentElement;
    const angle = t.angle ?? 135;
    root.style.setProperty('--gradient-primary', `linear-gradient(${angle}deg, hsl(${t.start}) 0%, hsl(${t.end}) 100%)`);
    // Main page background gradient variable
    const bgAngle = t.bgAngle ?? angle;
    const bgStart = t.bgStart ?? t.start;
    const bgEnd = t.bgEnd ?? t.end;
    root.style.setProperty('--app-background', `linear-gradient(${bgAngle}deg, hsl(${bgStart}) 0%, hsl(${bgEnd}) 100%)`);
    if (t.primary) {
      root.style.setProperty('--primary', t.primary);
      root.style.setProperty('--sidebar-primary', t.primary);
      root.style.setProperty('--ring', t.primary);
    }
    if (t.accent) {
      root.style.setProperty('--accent', t.accent);
      root.style.setProperty('--sidebar-accent', t.accent);
    }
    if (t.sidebarBackground) {
      root.style.setProperty('--sidebar-background', t.sidebarBackground);
    }
    if (t.radius) {
      root.style.setProperty('--radius', t.radius);
    }
    root.style.setProperty('--shadow-primary', `0 10px 30px -10px hsl(${t.primary || '217 91% 60%'} / 0.3)`);
    if (typeof t.dark === 'boolean') {
      toggleDark(t.dark);
      localStorage.setItem(LS_DARK_KEY, String(t.dark));
    }
  };

  const saveTheme = (t: { name: string; start: string; end: string; primary?: string; accent?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => {
    const saved: SavedTheme = { ...t, createdAt: new Date().toISOString() };
    const next = [saved, ...themes.filter(x => x.name !== t.name)];
    setThemes(next);
    localStorage.setItem(LS_THEMES_KEY, JSON.stringify(next));
  };

  const setActive = (name: string) => {
    setActiveThemeName(name);
    localStorage.setItem(LS_ACTIVE_KEY, name);
    const found = themes.find(t => t.name === name);
    if (found) applyTheme(found);
  };

  const toggleDark = (enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem(LS_DARK_KEY, String(enabled));
  };

  const value = useMemo<ThemeContextValue>(() => ({ themes, activeThemeName, applyTheme, saveTheme, setActive, toggleDark }), [themes, activeThemeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
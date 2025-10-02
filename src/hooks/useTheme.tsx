import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

export type SavedTheme = {
  name: string;
  start: string;
  end: string;
  primary?: string;
  accent?: string;
  createdAt: string;
};

type ThemeContextValue = {
  themes: SavedTheme[];
  activeThemeName: string | null;
  applyTheme: (t: { start: string; end: string; primary?: string; accent?: string }) => void;
  saveTheme: (t: { name: string; start: string; end: string; primary?: string; accent?: string }) => void;
  setActive: (name: string) => void;
};

const LS_THEMES_KEY = 'soslogicpro.themes';
const LS_ACTIVE_KEY = 'soslogicpro.activeThemeName';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_THEMES_KEY);
      const active = localStorage.getItem(LS_ACTIVE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedTheme[]) : [];
      setThemes(parsed);
      setActiveThemeName(active);
      if (active) {
        const found = parsed.find(t => t.name === active);
        if (found) applyTheme(found);
      }
    } catch {}
  }, []);

  const applyTheme = (t: { start: string; end: string; primary?: string; accent?: string }) => {
    const root = document.documentElement;
    root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${t.start}) 0%, hsl(${t.end}) 100%)`);
    if (t.primary) {
      root.style.setProperty('--primary', t.primary);
      root.style.setProperty('--sidebar-primary', t.primary);
      root.style.setProperty('--ring', t.primary);
    }
    if (t.accent) {
      root.style.setProperty('--accent', t.accent);
      root.style.setProperty('--sidebar-accent', t.accent);
    }
    root.style.setProperty('--shadow-primary', `0 10px 30px -10px hsl(${t.primary || '217 91% 60%'} / 0.3)`);
  };

  const saveTheme = (t: { name: string; start: string; end: string; primary?: string; accent?: string }) => {
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

  const value = useMemo<ThemeContextValue>(() => ({ themes, activeThemeName, applyTheme, saveTheme, setActive }), [themes, activeThemeName]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
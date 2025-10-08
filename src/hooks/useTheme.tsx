import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { THEME_PRESETS } from '@/theme/themes';
import { useCRM } from '@/hooks/useCRM';

export type SavedTheme = {
  name: string;
  start: string;
  end: string;
  primary?: string;
  accent?: string;
  titleStrip?: string;
  tableHeaderText?: string;
  tableHeaderSeparator?: string;
  tableHeaderBackground?: string;
  tableBackground?: string;
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
  scope: 'platform' | 'tenant' | 'franchise' | 'user';
  setScope: (s: 'platform' | 'tenant' | 'franchise' | 'user') => void;
  applyTheme: (t: { start: string; end: string; primary?: string; accent?: string; titleStrip?: string; tableHeaderText?: string; tableHeaderSeparator?: string; tableHeaderBackground?: string; tableBackground?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => void;
  saveTheme: (t: { name: string; start: string; end: string; primary?: string; accent?: string; titleStrip?: string; tableHeaderText?: string; tableHeaderSeparator?: string; tableHeaderBackground?: string; tableBackground?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => Promise<void>;
  deleteTheme: (name: string) => Promise<void>;
  setActive: (name: string) => void;
  toggleDark: (enabled: boolean) => void;
};

const LS_THEMES_KEY = 'soslogicpro.themes';
const LS_ACTIVE_KEY = 'soslogicpro.activeThemeName';

const ThemeContext = createContext<ThemeContextValue | null>(null);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const [scope, setScope] = useState<'platform' | 'tenant' | 'franchise' | 'user'>('user');
  const LS_DARK_KEY = 'soslogicpro.darkMode';
  const { supabase, context } = useCRM();

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

  // Choose default scope based on current context
  useEffect(() => {
    if (context?.franchiseId) setScope('franchise');
    else if (context?.tenantId) setScope('tenant');
    else setScope('user');
  }, [context?.tenantId, context?.franchiseId]);

  // Load scoped themes from Supabase when scope or context changes
  useEffect(() => {
    (async () => {
      try {
        if (!supabase) return;
        // Cast to any to avoid typed relation errors for ui_themes
        let query: any = (supabase as any).from('ui_themes').select('name, tokens, is_default, scope');
        if (scope === 'user' && context?.userId) {
          query = query.eq('scope', 'user').eq('user_id', context.userId);
        } else if (scope === 'franchise' && context?.franchiseId) {
          query = query.eq('scope', 'franchise').eq('franchise_id', context.franchiseId);
        } else if (scope === 'tenant' && context?.tenantId) {
          query = query.eq('scope', 'tenant').eq('tenant_id', context.tenantId);
        } else if (scope === 'platform') {
          query = query.eq('scope', 'platform');
        } else {
          return; // insufficient context for scoped fetch
        }
        const { data, error } = await query;
        if (error) return;
        if (Array.isArray(data)) {
          const mapped: SavedTheme[] = data.map((row: any) => ({
            name: row.name,
            start: row.tokens.start,
            end: row.tokens.end,
            primary: row.tokens.primary,
            accent: row.tokens.accent,
            titleStrip: row.tokens.titleStrip,
            tableHeaderText: row.tokens.tableHeaderText,
            tableHeaderSeparator: row.tokens.tableHeaderSeparator,
            tableHeaderBackground: row.tokens.tableHeaderBackground,
            tableBackground: row.tokens.tableBackground,
            angle: row.tokens.angle,
            radius: row.tokens.radius,
            sidebarBackground: row.tokens.sidebarBackground,
            sidebarAccent: row.tokens.sidebarAccent,
            dark: row.tokens.dark,
            bgStart: row.tokens.bgStart,
            bgEnd: row.tokens.bgEnd,
            bgAngle: row.tokens.bgAngle,
            createdAt: new Date().toISOString(),
          }));
          setThemes(mapped);
          const def = data.find((row: any) => row.is_default);
          if (def) {
            setActiveThemeName(def.name);
            const found = mapped.find(t => t.name === def.name);
            if (found) applyTheme(found);
          }
        }
      } catch {
        // noop; keep local storage themes
      }
    })();
  }, [scope, context?.userId, context?.tenantId, context?.franchiseId]);

  const applyTheme = (t: { start: string; end: string; primary?: string; accent?: string; titleStrip?: string; tableHeaderText?: string; tableHeaderSeparator?: string; tableHeaderBackground?: string; tableBackground?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => {
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
    // Title strip color falls back to accent, then primary.
    const titleStrip = t.titleStrip || t.accent || t.primary;
    if (titleStrip) {
      root.style.setProperty('--title-strip', titleStrip);
    }
    // Table header / table defaults with dynamic computation
    const isDark = typeof t.dark === 'boolean' ? t.dark : document.documentElement.classList.contains('dark');

    const parseHsl = (value?: string) => {
      if (!value) return null as any;
      const m = value.match(/^(\s*\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
      if (!m) return null as any;
      return { h: Number(m[1]), s: Number(m[2]), l: Number(m[3]) };
    };
    const composeHsl = (h: number, s: number, l: number) => `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

    // Compute header background
    let computedHeaderBg = t.tableHeaderBackground;
    if (!computedHeaderBg) {
      if (isDark) {
        // Dark mode default header background (slate-800 range)
        computedHeaderBg = '222 47% 17%';
      } else {
        // Light mode: pastel tint derived from titleStrip/accent/primary
        const base = titleStrip || t.accent || t.primary || '197 71% 52%';
        const parsed = parseHsl(base);
        if (parsed) {
          computedHeaderBg = composeHsl(parsed.h, 35, 92);
        } else {
          computedHeaderBg = '197 35% 92%';
        }
      }
    }
    root.style.setProperty('--table-header-background', computedHeaderBg);

    // Compute table background
    const computedTableBg = t.tableBackground || (isDark ? '222 47% 11%' : '0 0% 100%');
    root.style.setProperty('--table-background', computedTableBg);

    // Auto-select header text by background lightness if not provided
    let computedHeaderText = t.tableHeaderText;
    if (!computedHeaderText) {
      const p = parseHsl(computedHeaderBg);
      if (p && p.l > 60) {
        computedHeaderText = '0 0% 10%';
      } else {
        computedHeaderText = '0 0% 100%';
      }
    }
    root.style.setProperty('--table-header-text', computedHeaderText);

    // Separator: opposite color with balanced alpha
    let computedSeparator = t.tableHeaderSeparator;
    if (!computedSeparator) {
      const p = parseHsl(computedHeaderBg);
      const isLightBg = p ? p.l > 60 : !isDark; // fallback assumption
      if (isLightBg) {
        computedSeparator = '0 0% 0% / 0.15'; // subtle black
      } else {
        computedSeparator = '0 0% 100% / 0.25'; // subtle white
      }
    }
    root.style.setProperty('--table-header-separator', computedSeparator);
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

  const saveTheme = async (t: { name: string; start: string; end: string; primary?: string; accent?: string; titleStrip?: string; tableHeaderText?: string; tableHeaderSeparator?: string; tableHeaderBackground?: string; tableBackground?: string; angle?: number; radius?: string; sidebarBackground?: string; sidebarAccent?: string; dark?: boolean; bgStart?: string; bgEnd?: string; bgAngle?: number }) => {
    const saved: SavedTheme = { ...t, createdAt: new Date().toISOString() };
    const next = [saved, ...themes.filter(x => x.name !== t.name)];
    setThemes(next);
    localStorage.setItem(LS_THEMES_KEY, JSON.stringify(next));
    try {
      if (!supabase) return;
      const tokens = {
        start: t.start,
        end: t.end,
        primary: t.primary,
        accent: t.accent,
        titleStrip: t.titleStrip,
        tableHeaderText: t.tableHeaderText,
        tableHeaderSeparator: t.tableHeaderSeparator,
        tableHeaderBackground: t.tableHeaderBackground,
        tableBackground: t.tableBackground,
        angle: t.angle,
        radius: t.radius,
        sidebarBackground: t.sidebarBackground,
        sidebarAccent: t.sidebarAccent,
        dark: t.dark,
        bgStart: t.bgStart,
        bgEnd: t.bgEnd,
        bgAngle: t.bgAngle,
      };
      const payload: any = { name: t.name, tokens, scope, is_active: true };
      if (scope === 'user') payload.user_id = context?.userId;
      if (scope === 'franchise') payload.franchise_id = context?.franchiseId;
      if (scope === 'tenant') payload.tenant_id = context?.tenantId;
      await (supabase as any).from('ui_themes').upsert(payload);
    } catch {}
  };

  const deleteTheme = async (name: string) => {
    const next = themes.filter(x => x.name !== name);
    setThemes(next);
    localStorage.setItem(LS_THEMES_KEY, JSON.stringify(next));
    try {
      if (!supabase) return;
      let q: any = (supabase as any).from('ui_themes').delete().eq('name', name).eq('scope', scope);
      if (scope === 'user') q = q.eq('user_id', context?.userId);
      if (scope === 'franchise') q = q.eq('franchise_id', context?.franchiseId);
      if (scope === 'tenant') q = q.eq('tenant_id', context?.tenantId);
      await q;
    } catch {}
  };

  const setActive = (name: string) => {
    setActiveThemeName(name);
    localStorage.setItem(LS_ACTIVE_KEY, name);
    const found = themes.find(t => t.name === name);
    if (found) applyTheme(found);
    // Mark default in Supabase for current scope
    (async () => {
      try {
        if (!supabase) return;
        let clear: any = (supabase as any).from('ui_themes').update({ is_default: false }).eq('scope', scope);
        if (scope === 'user') clear = clear.eq('user_id', context?.userId);
        if (scope === 'franchise') clear = clear.eq('franchise_id', context?.franchiseId);
        if (scope === 'tenant') clear = clear.eq('tenant_id', context?.tenantId);
        await clear;
        let set: any = (supabase as any).from('ui_themes').update({ is_default: true }).eq('name', name).eq('scope', scope);
        if (scope === 'user') set = set.eq('user_id', context?.userId);
        if (scope === 'franchise') set = set.eq('franchise_id', context?.franchiseId);
        if (scope === 'tenant') set = set.eq('tenant_id', context?.tenantId);
        await set;
      } catch {}
    })();
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

  const value = useMemo<ThemeContextValue>(() => ({ themes, activeThemeName, scope, setScope, applyTheme, saveTheme, deleteTheme, setActive, toggleDark }), [themes, activeThemeName, scope]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
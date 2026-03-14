import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
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
  tableForeground?: string;
  angle?: number; // gradient angle in degrees
  radius?: string; // e.g., "0.75rem"
  sidebarBackground?: string;
  sidebarAccent?: string;
  dark?: boolean;
  // Main page background gradient overrides
  bgStart?: string;
  bgEnd?: string;
  bgAngle?: number;
  // Kanban settings
  kanbanCardBg?: string;
  kanbanCardRadius?: string;
  stripColor?: string;
  stripOpacity?: number;
  stripWidth?: string;
  stripAngle?: string;
  headerBannerVisible?: boolean;
  headerBannerContent?: string;
  headerBannerColor?: string;
  headerBannerTextColor?: string;
  headerBannerHeight?: string;
  createdAt: string;
};

type ThemeContextValue = {
  themes: SavedTheme[];
  activeThemeName: string | null;
  isDark: boolean;
  scope: 'platform' | 'tenant' | 'franchise' | 'user';
  setScope: (s: 'platform' | 'tenant' | 'franchise' | 'user') => void;
  applyTheme: (t: Partial<SavedTheme>) => void;
  saveTheme: (t: Omit<SavedTheme, 'createdAt'>) => Promise<void>;
  deleteTheme: (name: string) => Promise<void>;
  setActive: (name: string) => void;
  toggleDark: (enabled: boolean) => void;
};

const LS_THEMES_KEY = 'soslogicpro.themes';
const LS_ACTIVE_KEY = 'soslogicpro.activeThemeName';
const LS_SCOPE_KEY = 'soslogicpro.themeScope';

const ThemeContext = createContext<ThemeContextValue | null>(null);

const normalizeHslToken = (value: string | undefined, fallback: string) => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().replace(/;$/, '');
  if (!trimmed) return fallback;
  const hslMatch = trimmed.match(/^hsl\((.+)\)$/i);
  if (hslMatch?.[1]) {
    const inner = hslMatch[1].trim();
    return inner || fallback;
  }
  return trimmed;
};

const buildPresetTheme = (preset: (typeof THEME_PRESETS)[number]): SavedTheme => ({
  name: preset.name,
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
  stripColor: normalizeHslToken((preset as any).stripColor ?? preset.accent ?? preset.primary, '267 78% 44%'),
  stripOpacity: typeof (preset as any).stripOpacity === 'number' ? (preset as any).stripOpacity : 0.2,
  stripWidth: (preset as any).stripWidth ?? '22px',
  stripAngle: (preset as any).stripAngle ?? '14deg',
  headerBannerVisible: typeof (preset as any).headerBannerVisible === 'boolean' ? (preset as any).headerBannerVisible : preset.name === 'Default Simple',
  headerBannerContent: (preset as any).headerBannerContent ?? 'System notification',
  headerBannerColor: normalizeHslToken((preset as any).headerBannerColor ?? preset.accent ?? preset.primary, '217 91% 60%'),
  headerBannerTextColor: normalizeHslToken((preset as any).headerBannerTextColor, '0 0% 100%'),
  headerBannerHeight: (preset as any).headerBannerHeight ?? '48px',
  createdAt: new Date().toISOString(),
});

const normalizeSavedThemeForStartup = (theme: SavedTheme): SavedTheme => {
  const isDefaultSimpleTheme = theme.name === 'Default Simple';
  return {
    ...theme,
    stripColor: normalizeHslToken(theme.stripColor || theme.accent || theme.primary, '267 78% 44%'),
    headerBannerVisible: isDefaultSimpleTheme
      ? true
      : typeof theme.headerBannerVisible === 'boolean'
        ? theme.headerBannerVisible
        : false,
    headerBannerContent: isDefaultSimpleTheme
      ? (typeof theme.headerBannerContent === 'string' && theme.headerBannerContent.trim() ? theme.headerBannerContent : 'System notification')
      : theme.headerBannerContent,
    headerBannerColor: normalizeHslToken(theme.headerBannerColor || theme.stripColor || theme.accent || theme.primary, '217 91% 60%'),
    headerBannerTextColor: normalizeHslToken(theme.headerBannerTextColor, '0 0% 100%'),
    headerBannerHeight: theme.headerBannerHeight || '48px',
  };
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themes, setThemes] = useState<SavedTheme[]>([]);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(false);
  const [scope, setScopeState] = useState<'platform' | 'tenant' | 'franchise' | 'user'>(() => {
    try {
      const stored = localStorage.getItem(LS_SCOPE_KEY);
      if (stored === 'platform' || stored === 'tenant' || stored === 'franchise' || stored === 'user') {
        return stored;
      }
    } catch {
      return 'user';
    }
    return 'user';
  });
  const [themesFetchDisabled, setThemesFetchDisabled] = useState(false);
  const LS_DARK_KEY = 'soslogicpro.darkMode';
  const { supabase, context } = useCRM();
  const setScope = useCallback((nextScope: 'platform' | 'tenant' | 'franchise' | 'user') => {
    setScopeState(nextScope);
    localStorage.setItem(LS_SCOPE_KEY, nextScope);
  }, []);

  // Define applyTheme before useEffect calls
  const applyTheme = useCallback((t: Partial<SavedTheme>) => {
    const root = document.documentElement;
    const angle = t.angle ?? 135;
    root.style.setProperty('--gradient-primary', `linear-gradient(${angle}deg, hsl(${t.start}) 0%, hsl(${t.end}) 100%)`);
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
    const titleStrip = t.titleStrip || t.accent || t.primary;
    if (titleStrip) {
      root.style.setProperty('--title-strip', titleStrip);
    }
    const isDark = typeof t.dark === 'boolean' ? t.dark : document.documentElement.classList.contains('dark');
    
    const parseHsl = (value?: string) => {
      if (!value) return null as any;
      const m = value.match(/^(\s*\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%/);
      if (!m) return null;
      return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
    };
    const lighten = (hsl: { h: number; s: number; l: number }, amount: number) => {
      const newL = Math.min(100, hsl.l + amount);
      return `${hsl.h} ${hsl.s}% ${newL}%`;
    };
    const darken = (hsl: { h: number; s: number; l: number }, amount: number) => {
      const newL = Math.max(0, hsl.l - amount);
      return `${hsl.h} ${hsl.s}% ${newL}%`;
    };
    const primaryParsed = parseHsl(t.primary);
    const accentParsed = parseHsl(t.accent);
    let thText = t.tableHeaderText;
    let thSep = t.tableHeaderSeparator;
    let thBg = t.tableHeaderBackground;
    let tableBg = t.tableBackground;
    let tableFg = t.tableForeground;
    if (!thText) {
      thText = isDark ? '210 40% 98%' : '222.2 84% 4.9%';
    }
    if (!thSep && primaryParsed) {
      thSep = isDark ? lighten(primaryParsed, 10) : darken(primaryParsed, 5);
    }
    if (!thBg) {
      if (primaryParsed) {
        thBg = isDark ? lighten(primaryParsed, 5) : lighten(primaryParsed, 45);
      }
    }
    if (!tableBg) {
      tableBg = isDark ? '222.2 84% 4.9%' : '0 0% 100%';
    }
    if (!tableFg) {
      tableFg = isDark ? '210 40% 98%' : '222.2 84% 4.9%';
    }
    // Apply CSS variables used by table components
    if (thText) root.style.setProperty('--table-header-text', thText);
    if (thSep) root.style.setProperty('--table-header-separator', thSep);
    if (thBg) root.style.setProperty('--table-header-background', thBg);
    if (tableBg) root.style.setProperty('--table-background', tableBg);
    if (tableFg) root.style.setProperty('--table-foreground', tableFg);
    if (t.radius) {
      root.style.setProperty('--radius', t.radius);
    }
    if (t.sidebarBackground) {
      root.style.setProperty('--sidebar-background', t.sidebarBackground);
    }
    if (t.sidebarAccent) {
      root.style.setProperty('--sidebar-accent', t.sidebarAccent);
    }
    if (t.kanbanCardBg) {
      root.style.setProperty('--kanban-card-bg', t.kanbanCardBg);
    }
    if (t.kanbanCardRadius) {
      root.style.setProperty('--kanban-card-radius', t.kanbanCardRadius);
    }
    const stripColor = normalizeHslToken(t.stripColor || t.accent || t.primary, '267 78% 44%');
    root.style.setProperty('--strip-color', `hsl(${stripColor})`);
    root.style.setProperty('--strip-opacity', `${typeof t.stripOpacity === 'number' ? t.stripOpacity : 0.2}`);
    root.style.setProperty('--strip-width', t.stripWidth || '22px');
    root.style.setProperty('--strip-angle', t.stripAngle || '14deg');
    root.style.setProperty('--strip-strategy', 'css');
    const isDefaultSimpleTheme = t.name === 'Default Simple';
    const existingBannerVisible = root.getAttribute('data-header-banner-visible') === '1'
      || getComputedStyle(root).getPropertyValue('--header-banner-visible').trim() === '1';
    const headerBannerVisible = isDefaultSimpleTheme
      ? true
      : typeof t.headerBannerVisible === 'boolean'
        ? t.headerBannerVisible
        : existingBannerVisible;
    const existingBannerContent = root.getAttribute('data-header-banner-content') || '';
    const headerBannerContent = isDefaultSimpleTheme
      ? (typeof t.headerBannerContent === 'string' && t.headerBannerContent.trim() ? t.headerBannerContent : 'System notification')
      : typeof t.headerBannerContent === 'string'
        ? t.headerBannerContent
        : existingBannerContent;
    const headerBannerColor = normalizeHslToken(t.headerBannerColor || t.accent || t.primary, '217 91% 60%');
    const headerBannerTextColor = normalizeHslToken(t.headerBannerTextColor, '0 0% 100%');
    const headerBannerHeight = t.headerBannerHeight || '48px';
    root.style.setProperty('--header-banner-visible', headerBannerVisible ? '1' : '0');
    root.style.setProperty('--header-banner-bg', `hsl(${headerBannerColor})`);
    root.style.setProperty('--header-banner-text', `hsl(${headerBannerTextColor})`);
    root.style.setProperty('--header-banner-height', headerBannerHeight);
    root.setAttribute('data-header-banner-visible', headerBannerVisible ? '1' : '0');
    root.setAttribute('data-header-banner-content', headerBannerContent);
  }, []);

  const toggleDark = useCallback((enabled: boolean) => {
    const root = document.documentElement;
    if (enabled) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    setIsDark(enabled);
    localStorage.setItem(LS_DARK_KEY, String(enabled));
  }, [LS_DARK_KEY]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_THEMES_KEY);
      const active = localStorage.getItem(LS_ACTIVE_KEY);
      const darkStored = localStorage.getItem(LS_DARK_KEY);
      const parsed = raw ? (JSON.parse(raw) as SavedTheme[]) : [];
      const normalized = parsed.map(normalizeSavedThemeForStartup);
      const normalizedRaw = JSON.stringify(normalized);
      if (raw !== normalizedRaw) {
        localStorage.setItem(LS_THEMES_KEY, normalizedRaw);
      }
      setThemes(normalized);
      setActiveThemeName(active);
      if (active) {
        const found = normalized.find(t => t.name === active)
          ?? (() => {
            const preset = THEME_PRESETS.find((p) => p.name === active);
            return preset ? buildPresetTheme(preset) : undefined;
          })();
        if (found) {
          applyTheme(found);
        } else {
          const fallbackPreset = THEME_PRESETS.find((p) => p.name === 'Default Simple');
          if (fallbackPreset) {
            const fallbackTheme = buildPresetTheme(fallbackPreset);
            setActiveThemeName(fallbackTheme.name);
            localStorage.setItem(LS_ACTIVE_KEY, fallbackTheme.name);
            applyTheme(fallbackTheme);
          }
        }
      } else {
        const preset = THEME_PRESETS.find(p => p.name === 'Default Simple');
        if (preset) {
          const fallbackTheme = buildPresetTheme(preset);
          setActiveThemeName(fallbackTheme.name);
          localStorage.setItem(LS_ACTIVE_KEY, fallbackTheme.name);
          applyTheme(fallbackTheme);
        }
      }
      if (darkStored !== null) {
        const enabled = darkStored === 'true';
        setIsDark(enabled);
        if (enabled) {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
      } else {
        // Default to light
        setIsDark(false);
        document.documentElement.classList.remove('dark');
      }
    } catch {
      // ignore
    }
  }, [LS_DARK_KEY])

  // Choose default scope based on current context
  useEffect(() => {
    const storedScope = localStorage.getItem(LS_SCOPE_KEY);
    if (storedScope === 'platform' || storedScope === 'tenant' || storedScope === 'franchise' || storedScope === 'user') {
      setScopeState(storedScope);
      return;
    }
    if (context?.franchiseId) {
      setScopeState('franchise');
      localStorage.setItem(LS_SCOPE_KEY, 'franchise');
      return;
    }
    if (context?.tenantId) {
      setScopeState('tenant');
      localStorage.setItem(LS_SCOPE_KEY, 'tenant');
      return;
    }
    setScopeState('user');
    localStorage.setItem(LS_SCOPE_KEY, 'user');
  }, [context?.tenantId, context?.franchiseId]);

  // Load scoped themes from Supabase when scope or context changes
  useEffect(() => {
    (async () => {
      try {
        if (!supabase || themesFetchDisabled) return;
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
        if (error) {
          // Silence noisy devtools network 404s by disabling future fetches until reload
          const status = (error as any)?.status ?? (error as any)?.code;
          if (status === 404 || String(error?.message || '').toLowerCase().includes('not found')) {
            setThemesFetchDisabled(true);
          }
          return;
        }
        if (Array.isArray(data)) {
          const dedupedRowsByName = new Map<string, { row: any; score: number }>();
          for (const row of data) {
            const tokens = row?.tokens ?? {};
            const score =
              (row?.is_default ? 100 : 0) +
              (tokens.headerBannerVisible ? 20 : 0) +
              (tokens.headerBannerContent ? 5 : 0) +
              (tokens.headerBannerColor ? 5 : 0) +
              (tokens.headerBannerTextColor ? 5 : 0) +
              (tokens.headerBannerHeight ? 5 : 0);
            const existing = dedupedRowsByName.get(row.name);
            if (!existing || score >= existing.score) {
              dedupedRowsByName.set(row.name, { row, score });
            }
          }
          const dedupedRows = Array.from(dedupedRowsByName.values()).map((entry) => entry.row);
          const mapped: SavedTheme[] = dedupedRows.map((row: any) => ({
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
            tableForeground: row.tokens.tableForeground,
            angle: row.tokens.angle,
            radius: row.tokens.radius,
            sidebarBackground: row.tokens.sidebarBackground,
            sidebarAccent: row.tokens.sidebarAccent,
            dark: row.tokens.dark,
            bgStart: row.tokens.bgStart,
            bgEnd: row.tokens.bgEnd,
            bgAngle: row.tokens.bgAngle,
            kanbanCardBg: row.tokens.kanbanCardBg,
            kanbanCardRadius: row.tokens.kanbanCardRadius,
            stripColor: normalizeHslToken(row.tokens.stripColor, row.tokens.accent || row.tokens.primary || '267 78% 44%'),
            stripOpacity: row.tokens.stripOpacity,
            stripWidth: row.tokens.stripWidth,
            stripAngle: row.tokens.stripAngle,
            headerBannerVisible: row.name === 'Default Simple'
              ? true
              : typeof row.tokens.headerBannerVisible === 'boolean'
                ? row.tokens.headerBannerVisible
                : undefined,
            headerBannerContent: row.name === 'Default Simple'
              ? ((typeof row.tokens.headerBannerContent === 'string' && row.tokens.headerBannerContent.trim())
                ? row.tokens.headerBannerContent
                : 'System notification')
              : typeof row.tokens.headerBannerContent === 'string'
                ? row.tokens.headerBannerContent
                : undefined,
            headerBannerColor: normalizeHslToken(row.tokens.headerBannerColor, row.tokens.accent || row.tokens.primary || '217 91% 60%'),
            headerBannerTextColor: normalizeHslToken(row.tokens.headerBannerTextColor, '0 0% 100%'),
            headerBannerHeight: row.tokens.headerBannerHeight,
            createdAt: new Date().toISOString(),
          }));
          setThemes(mapped);
          const storedActive = localStorage.getItem(LS_ACTIVE_KEY);
          const def = dedupedRows.find((row: any) => row.is_default)
            ?? (storedActive ? dedupedRows.find((row: any) => row.name === storedActive) : undefined);
          const fallback = mapped.find((theme) => theme.name === 'Default Simple') ?? mapped[0];
          const selected = def ? mapped.find((theme) => theme.name === def.name) : fallback;
          if (selected) {
            setActiveThemeName(selected.name);
            localStorage.setItem(LS_ACTIVE_KEY, selected.name);
            applyTheme(selected);
          }
        }
      } catch {
        // noop; keep local storage themes
      }
    })();
  }, [scope, context?.userId, context?.tenantId, context?.franchiseId, applyTheme, themesFetchDisabled]);

  const saveTheme = async (t: Omit<SavedTheme, 'createdAt'>) => {
    const saved: SavedTheme = {
      ...t,
      stripColor: normalizeHslToken(t.stripColor || t.accent || t.primary, '267 78% 44%'),
      headerBannerColor: normalizeHslToken(t.headerBannerColor || t.accent || t.primary, '217 91% 60%'),
      headerBannerTextColor: normalizeHslToken(t.headerBannerTextColor, '0 0% 100%'),
      createdAt: new Date().toISOString(),
    };
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
        tableForeground: t.tableForeground,
        angle: t.angle,
        radius: t.radius,
        sidebarBackground: t.sidebarBackground,
        sidebarAccent: t.sidebarAccent,
        dark: t.dark,
        bgStart: t.bgStart,
        bgEnd: t.bgEnd,
        bgAngle: t.bgAngle,
        kanbanCardBg: t.kanbanCardBg,
        kanbanCardRadius: t.kanbanCardRadius,
        stripColor: saved.stripColor,
        stripOpacity: t.stripOpacity,
        stripWidth: t.stripWidth,
        stripAngle: t.stripAngle,
        headerBannerVisible: t.headerBannerVisible,
        headerBannerContent: t.headerBannerContent,
        headerBannerColor: saved.headerBannerColor,
        headerBannerTextColor: saved.headerBannerTextColor,
        headerBannerHeight: t.headerBannerHeight,
      };
      const payload: any = { name: t.name, tokens, scope, is_active: true };
      if (scope === 'user') payload.user_id = context?.userId;
      if (scope === 'franchise') payload.franchise_id = context?.franchiseId;
      if (scope === 'tenant') payload.tenant_id = context?.tenantId;
      let removeExisting: any = (supabase as any).from('ui_themes').delete().eq('name', t.name).eq('scope', scope);
      if (scope === 'user') removeExisting = removeExisting.eq('user_id', context?.userId);
      if (scope === 'franchise') removeExisting = removeExisting.eq('franchise_id', context?.franchiseId);
      if (scope === 'tenant') removeExisting = removeExisting.eq('tenant_id', context?.tenantId);
      await removeExisting;
      await (supabase as any).from('ui_themes').insert(payload);
    } catch {
      // ignore
    }
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
    } catch {
      // ignore
    }
  };

  const setActive = (name: string) => {
    setActiveThemeName(name);
    localStorage.setItem(LS_ACTIVE_KEY, name);
    const found = themes.find(t => t.name === name)
      ?? (() => {
        const preset = THEME_PRESETS.find((p) => p.name === name);
        return preset ? buildPresetTheme(preset) : undefined;
      })();
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
      } catch {
        // ignore
      }
    })();
  };

  const value = useMemo<ThemeContextValue>(() => ({ themes, activeThemeName, isDark, scope, setScope, applyTheme, saveTheme, deleteTheme, setActive, toggleDark }), [themes, activeThemeName, isDark, scope, applyTheme, toggleDark]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

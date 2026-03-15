import { useCallback, useEffect, useMemo, useState } from 'react';
import { THEME_PRESETS } from '@/theme/themes';

export type CRMModuleKey = 'leads' | 'opportunities' | 'accounts' | 'contacts' | 'activities' | 'quotes';
export type CRMModuleViewMode = 'pipeline' | 'card' | 'grid' | 'list';

type ModuleState = {
  viewMode: CRMModuleViewMode;
  theme: string;
};

type PersistedModuleState = {
  version: 1;
  modules: Partial<Record<CRMModuleKey, ModuleState>>;
};

const STORAGE_KEY = 'crm.moduleNavigation.v1';
const DEFAULT_THEME = 'Azure Sky';
const VALID_VIEWS: CRMModuleViewMode[] = ['pipeline', 'card', 'grid', 'list'];
const VALID_THEME_NAMES = new Set(THEME_PRESETS.map((theme) => theme.name));

function parseStoredState(raw: string | null): PersistedModuleState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedModuleState;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function normalizeTheme(theme: string | undefined, fallback: string): string {
  if (theme && VALID_THEME_NAMES.has(theme)) {
    return theme;
  }
  if (VALID_THEME_NAMES.has(fallback)) {
    return fallback;
  }
  return DEFAULT_THEME;
}

function normalizeView(viewMode: string | undefined, fallback: CRMModuleViewMode): CRMModuleViewMode {
  if (viewMode && VALID_VIEWS.includes(viewMode as CRMModuleViewMode)) {
    return viewMode as CRMModuleViewMode;
  }
  return fallback;
}

export function useCRMModuleNavigationState(
  moduleKey: CRMModuleKey,
  defaults: Partial<ModuleState> = {},
) {
  const defaultView = defaults.viewMode ?? 'pipeline';
  const defaultTheme = defaults.theme ?? DEFAULT_THEME;
  const [state, setState] = useState<ModuleState>({
    viewMode: defaultView,
    theme: normalizeTheme(defaultTheme, DEFAULT_THEME),
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = parseStoredState(localStorage.getItem(STORAGE_KEY));
    const currentModule = stored?.modules?.[moduleKey];
    if (currentModule) {
      setState({
        viewMode: normalizeView(currentModule.viewMode, defaultView),
        theme: normalizeTheme(currentModule.theme, defaultTheme),
      });
    } else {
      setState({
        viewMode: normalizeView(defaultView, 'pipeline'),
        theme: normalizeTheme(defaultTheme, DEFAULT_THEME),
      });
    }
    setHydrated(true);
  }, [defaultTheme, defaultView, moduleKey]);

  useEffect(() => {
    if (!hydrated) return;
    const stored = parseStoredState(localStorage.getItem(STORAGE_KEY));
    const next: PersistedModuleState = {
      version: 1,
      modules: {
        ...(stored?.modules ?? {}),
        [moduleKey]: state,
      },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }, [hydrated, moduleKey, state]);

  const setViewMode = useCallback((viewMode: CRMModuleViewMode) => {
    setState((prev) => ({ ...prev, viewMode: normalizeView(viewMode, prev.viewMode) }));
  }, []);

  const setTheme = useCallback((theme: string) => {
    setState((prev) => ({ ...prev, theme: normalizeTheme(theme, prev.theme) }));
  }, []);

  return useMemo(
    () => ({
      viewMode: state.viewMode,
      theme: state.theme,
      hydrated,
      setViewMode,
      setTheme,
    }),
    [hydrated, setTheme, setViewMode, state.theme, state.viewMode],
  );
}

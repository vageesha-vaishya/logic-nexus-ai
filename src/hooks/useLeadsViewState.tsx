import { createContext, useContext, useEffect, useMemo, useReducer, useRef, useCallback } from 'react';

export type LeadsPrimaryView = 'pipeline' | 'card' | 'grid' | 'list';
export type LeadsPipelineTab = 'board' | 'analytics';

type LeadsWorkspaceFilters = {
  searchQuery: string;
  statusFilter: string;
  scoreFilter: string;
  ownerFilter: 'any' | 'unassigned' | 'me';
  nameQuery: string;
  nameOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  companyQuery: string;
  companyOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  emailQuery: string;
  emailOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  phoneQuery: string;
  phoneOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  sourceQuery: string;
  sourceOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  qualificationQuery: string;
  qualificationOp: 'contains' | 'equals' | 'startsWith' | 'endsWith';
  scoreMin: string;
  scoreMax: string;
  valueMin: string;
  valueMax: string;
  createdStart: string;
  createdEnd: string;
};

type LeadsPipelineState = {
  q: string;
  status: string[];
  tab: LeadsPipelineTab;
};

type LeadsSelectionState = {
  selectedIds: string[];
};

type LeadsScrollState = {
  workspaceScrollY: number;
  pipelineScrollY: number;
};

export type LeadsViewState = {
  version: 1;
  hydrated: boolean;
  hydrationSource: 'storage' | 'legacy' | 'default';
  view: LeadsPrimaryView;
  theme: string;
  workspace: LeadsWorkspaceFilters;
  pipeline: LeadsPipelineState;
  selection: LeadsSelectionState;
  scroll: LeadsScrollState;
};

const STORAGE_KEY = 'leads.viewState.v1';

const defaultWorkspace: LeadsWorkspaceFilters = {
  searchQuery: '',
  statusFilter: 'all',
  scoreFilter: 'all',
  ownerFilter: 'any',
  nameQuery: '',
  nameOp: 'contains',
  companyQuery: '',
  companyOp: 'contains',
  emailQuery: '',
  emailOp: 'contains',
  phoneQuery: '',
  phoneOp: 'contains',
  sourceQuery: '',
  sourceOp: 'contains',
  qualificationQuery: '',
  qualificationOp: 'contains',
  scoreMin: '',
  scoreMax: '',
  valueMin: '',
  valueMax: '',
  createdStart: '',
  createdEnd: '',
};

const defaultState: LeadsViewState = {
  version: 1,
  hydrated: false,
  hydrationSource: 'default',
  view: 'card',
  theme: 'SOS Brand',
  workspace: defaultWorkspace,
  pipeline: { q: '', status: [], tab: 'board' },
  selection: { selectedIds: [] },
  scroll: { workspaceScrollY: 0, pipelineScrollY: 0 },
};

type Action =
  | { type: 'hydrate'; payload: Partial<LeadsViewState> }
  | { type: 'setView'; payload: LeadsPrimaryView }
  | { type: 'setTheme'; payload: string }
  | { type: 'setWorkspace'; payload: Partial<LeadsWorkspaceFilters> }
  | { type: 'setPipeline'; payload: Partial<LeadsPipelineState> }
  | { type: 'setSelectedIds'; payload: string[] }
  | { type: 'setWorkspaceScrollY'; payload: number }
  | { type: 'setPipelineScrollY'; payload: number };

function reducer(state: LeadsViewState, action: Action): LeadsViewState {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        ...action.payload,
        version: 1,
        hydrated: true,
        hydrationSource: action.payload.hydrationSource ?? state.hydrationSource,
        workspace: { ...defaultWorkspace, ...(action.payload.workspace ?? {}) },
        pipeline: { ...state.pipeline, ...(action.payload.pipeline ?? {}) },
        selection: { ...state.selection, ...(action.payload.selection ?? {}) },
        scroll: { ...state.scroll, ...(action.payload.scroll ?? {}) },
      };
    case 'setView':
      return {
        ...state,
        view: action.payload,
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setTheme':
      return {
        ...state,
        theme: action.payload,
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setWorkspace':
      return {
        ...state,
        workspace: { ...state.workspace, ...action.payload },
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setPipeline':
      return {
        ...state,
        pipeline: { ...state.pipeline, ...action.payload },
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setSelectedIds':
      return {
        ...state,
        selection: { selectedIds: action.payload },
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setWorkspaceScrollY':
      return {
        ...state,
        scroll: { ...state.scroll, workspaceScrollY: action.payload },
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    case 'setPipelineScrollY':
      return {
        ...state,
        scroll: { ...state.scroll, pipelineScrollY: action.payload },
        hydrationSource: state.hydrationSource === 'default' ? 'storage' : state.hydrationSource,
      };
    default:
      return state;
  }
}

type LeadsViewStateContextValue = {
  state: LeadsViewState;
  setView: (v: LeadsPrimaryView) => void;
  setTheme: (t: string) => void;
  setWorkspace: (patch: Partial<LeadsWorkspaceFilters>) => void;
  setPipeline: (patch: Partial<LeadsPipelineState>) => void;
  setSelectedIds: (ids: string[]) => void;
  setWorkspaceScrollY: (y: number) => void;
  setPipelineScrollY: (y: number) => void;
};

const LeadsViewStateContext = createContext<LeadsViewStateContextValue | null>(null);

function safeParse(json: string | null): Partial<LeadsViewState> | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed as Partial<LeadsViewState>;
  } catch {
    return null;
  }
}

function safeStringify(value: any): string | null {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

export function LeadsViewStateProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, defaultState);
  const didHydrate = useRef(false);

  useEffect(() => {
    if (didHydrate.current) return;
    didHydrate.current = true;
    const raw = safeParse(localStorage.getItem(STORAGE_KEY));
    if (raw) {
      dispatch({ type: 'hydrate', payload: { ...raw, hydrationSource: 'storage' } });
      return;
    }

    const legacyView = localStorage.getItem('leadsViewMode');
    const legacyTheme = localStorage.getItem('leadsTheme');
    const payload: Partial<LeadsViewState> = {};
    if (legacyView && ['pipeline', 'card', 'grid', 'list'].includes(legacyView)) {
      payload.view = legacyView as LeadsPrimaryView;
    }
    if (legacyTheme) payload.theme = legacyTheme;
    payload.hydrationSource = legacyView || legacyTheme ? 'legacy' : 'default';
    dispatch({ type: 'hydrate', payload });
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const payload: LeadsViewState = {
      ...state,
      hydrated: true,
      version: 1,
    };
    const raw = safeStringify(payload);
    if (!raw) return;
    try {
      localStorage.setItem(STORAGE_KEY, raw);
    } catch {
      return;
    }
  }, [state]);

  // Memoize dispatchers separately to prevent re-renders
  const setView = useCallback((v: LeadsPrimaryView) => dispatch({ type: 'setView', payload: v }), []);
  const setThemeAction = useCallback((t: string) => dispatch({ type: 'setTheme', payload: t }), []);
  const setWorkspace = useCallback((patch: Partial<LeadsWorkspaceFilters>) => dispatch({ type: 'setWorkspace', payload: patch }), []);
  const setPipeline = useCallback((patch: Partial<LeadsPipelineState>) => dispatch({ type: 'setPipeline', payload: patch }), []);
  const setSelectedIds = useCallback((ids: string[]) => dispatch({ type: 'setSelectedIds', payload: ids }), []);
  const setWorkspaceScrollY = useCallback((y: number) => dispatch({ type: 'setWorkspaceScrollY', payload: y }), []);
  const setPipelineScrollY = useCallback((y: number) => dispatch({ type: 'setPipelineScrollY', payload: y }), []);

  const value = useMemo<LeadsViewStateContextValue>(
    () => ({
      state,
      setView,
      setTheme: setThemeAction,
      setWorkspace,
      setPipeline,
      setSelectedIds,
      setWorkspaceScrollY,
      setPipelineScrollY,
    }),
    [state, setView, setThemeAction, setWorkspace, setPipeline, setSelectedIds, setWorkspaceScrollY, setPipelineScrollY],
  );

  return <LeadsViewStateContext.Provider value={value}>{children}</LeadsViewStateContext.Provider>;
}

export function useLeadsViewState() {
  const ctx = useContext(LeadsViewStateContext);
  if (!ctx) throw new Error('useLeadsViewState must be used within LeadsViewStateProvider');
  return ctx;
}

import * as React from 'react';

type ActionsConfig = {
  left?: React.ReactNode[];
  right?: React.ReactNode[];
};

type StickyActionsContextValue = {
  actions: ActionsConfig;
  setActions: (config: ActionsConfig) => void;
  clearActions: () => void;
};

const StickyActionsContext = React.createContext<StickyActionsContextValue | null>(null);

export function StickyActionsProvider({ children }: { children: React.ReactNode }) {
  const [actions, setActionsState] = React.useState<ActionsConfig>({ left: [], right: [] });

  const setActions = React.useCallback((config: ActionsConfig) => {
    setActionsState({
      left: config.left ?? [],
      right: config.right ?? [],
    });
  }, []);

  const clearActions = React.useCallback(() => {
    setActionsState({ left: [], right: [] });
  }, []);

  const value = React.useMemo<StickyActionsContextValue>(() => ({ actions, setActions, clearActions }), [actions, setActions, clearActions]);

  return (
    <StickyActionsContext.Provider value={value}>{children}</StickyActionsContext.Provider>
  );
}

export function useStickyActions() {
  const ctx = React.useContext(StickyActionsContext);
  if (!ctx) {
    throw new Error('useStickyActions must be used within StickyActionsProvider');
  }
  return ctx;
}

export default StickyActionsContext;
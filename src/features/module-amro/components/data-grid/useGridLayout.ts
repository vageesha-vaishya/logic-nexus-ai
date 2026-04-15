/**
 * AMRO Grid Layout Hook
 *
 * Manages layout state for data grid with multiple view modes:
 * - grid-only: Full-width data grid
 * - split-view: Grid with right-side form panel (30-40% width)
 * - modal: Grid with detail in modal/dialog
 *
 * Handles responsive behavior:
 * - Desktop: Side panel for split-view
 * - Mobile: Bottom sheet / full-screen modal
 *
 * Maintains grid state during layout transitions.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';

export type GridLayoutMode = 'grid-only' | 'split-view' | 'modal';

export interface GridLayoutState {
  mode: GridLayoutMode;
  isPanelOpen: boolean;
  panelWidth: number;
  isMobile: boolean;
}

interface UseGridLayoutOptions {
  /** Initial layout mode */
  initialMode?: GridLayoutMode;
  /** Default panel width percentage (30-40%) */
  defaultPanelWidth?: number;
  /** Breakpoint for mobile detection */
  mobileBreakpoint?: number;
  /** Callback when layout mode changes */
  onModeChange?: (mode: GridLayoutMode) => void;
}

export function useGridLayout({
  initialMode = 'grid-only',
  defaultPanelWidth = 35,
  mobileBreakpoint = 768,
  onModeChange,
}: UseGridLayoutOptions = {}) {
  const [mode, setMode] = useState<GridLayoutMode>(initialMode);
  const [isPanelOpen, setIsPanelOpen] = useState(initialMode === 'split-view');
  const [panelWidth, setPanelWidth] = useState(defaultPanelWidth);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  // Set layout mode
  const setLayoutMode = useCallback(
    (newMode: GridLayoutMode) => {
      setMode(newMode);
      setIsPanelOpen(newMode === 'split-view');
      onModeChange?.(newMode);
    },
    [onModeChange]
  );

  // Toggle panel open/closed
  const togglePanel = useCallback(() => {
    setIsPanelOpen((prev) => {
      const next = !prev;
      if (!next && mode === 'split-view') {
        setMode('grid-only');
      } else if (next && mode === 'grid-only') {
        setMode('split-view');
      }
      return next;
    });
  }, [mode]);

  // Open panel with a record
  const openPanel = useCallback(
    (record?: Record<string, any>) => {
      if (isMobile) {
        setMode('modal');
      } else {
        setMode('split-view');
        setIsPanelOpen(true);
      }
    },
    [isMobile]
  );

  // Close panel
  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    setMode('grid-only');
  }, []);

  // Adjust panel width (percentage of viewport)
  const adjustPanelWidth = useCallback((width: number) => {
    setPanelWidth(Math.max(25, Math.min(50, width)));
  }, []);

  // Reset to default layout
  const resetLayout = useCallback(() => {
    setMode(initialMode);
    setIsPanelOpen(initialMode === 'split-view');
    setPanelWidth(defaultPanelWidth);
  }, [initialMode, defaultPanelWidth]);

  // Computed styles
  const layoutStyles = useMemo(() => {
    const panelWidthPx = `${panelWidth}vw`;

    return {
      container: isPanelOpen && !isMobile
        ? 'grid grid-cols-1 lg:grid-cols-[1fr_auto]'
        : 'block',
      grid: isPanelOpen && !isMobile
        ? 'min-w-0'
        : 'w-full',
      panel: {
        width: isMobile ? '100%' : panelWidthPx,
        minWidth: isMobile ? '100%' : '320px',
        maxWidth: isMobile ? '100%' : '45vw',
      },
    };
  }, [isPanelOpen, isMobile, panelWidth]);

  // Available layout modes
  const availableModes = useMemo((): Array<{
    mode: GridLayoutMode;
    label: string;
    icon: string;
    description: string;
  }> => [
    { mode: 'grid-only', label: 'Grid Only', icon: 'grid', description: 'Full-width data grid' },
    { mode: 'split-view', label: 'Split View', icon: 'split', description: 'Grid with side panel' },
    { mode: 'modal', label: 'Modal', icon: 'modal', description: 'Grid with modal overlay' },
  ], []);

  return {
    // State
    mode,
    isPanelOpen,
    panelWidth,
    isMobile,

    // Actions
    setLayoutMode,
    togglePanel,
    openPanel,
    closePanel,
    adjustPanelWidth,
    resetLayout,

    // Styles
    layoutStyles,

    // Config
    availableModes,
  };
}

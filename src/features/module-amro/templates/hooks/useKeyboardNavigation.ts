/**
 * Keyboard Navigation Hook for Work Package Templates Grid
 * 
 * Features:
 * - Full keyboard navigation support
 * - Arrow key navigation between rows
 * - Tab key navigation between cells
 * - Enter/Space to activate
 * - Escape to cancel
 * - Ctrl/Cmd shortcuts
 * - Focus management
 * - Screen reader announcements
 */

import { useState, useCallback, useEffect, useRef } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GridPosition {
  rowIndex: number;
  colIndex: number;
}

export interface KeyboardNavigationOptions {
  rowCount: number;
  columnCount: number;
  onRowActivate?: (rowIndex: number) => void;
  onRowSelect?: (rowIndex: number) => void;
  onCellActivate?: (rowIndex: number, colIndex: number) => void;
  onSelectAll?: () => void;
  onSearch?: () => void;
  onRefresh?: () => void;
  enabled?: boolean;
}

export interface UseKeyboardNavigationReturn {
  position: GridPosition;
  setPosition: (pos: GridPosition) => void;
  focusedElement: HTMLElement | null;
  announce: (message: string) => void;
  handleKeyDown: (e: React.KeyboardEvent) => void;
  resetPosition: () => void;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Hook to manage keyboard navigation in the grid
 */
export function useKeyboardNavigation({
  rowCount,
  columnCount,
  onRowActivate,
  onRowSelect,
  onCellActivate,
  onSelectAll,
  onSearch,
  onRefresh,
  enabled = true,
}: KeyboardNavigationOptions): UseKeyboardNavigationReturn {
  const [position, setPosition] = useState<GridPosition>({ rowIndex: 0, colIndex: 0 });
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const liveRegionRef = useRef<HTMLDivElement>(null);

  // Announce message to screen readers
  const announce = useCallback((message: string) => {
    if (liveRegionRef.current) {
      liveRegionRef.current.textContent = message;
      // Clear after announcement
      setTimeout(() => {
        if (liveRegionRef.current) {
          liveRegionRef.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  // Reset position to first row
  const resetPosition = useCallback(() => {
    setPosition({ rowIndex: 0, colIndex: 0 });
  }, []);

  // Focus a specific cell
  const focusCell = useCallback(
    (rowIndex: number, colIndex: number) => {
      if (!gridRef.current) return;

      const selector = `[data-row="${rowIndex}"][data-col="${colIndex}"]`;
      const element = gridRef.current.querySelector(selector) as HTMLElement;
      
      if (element) {
        element.focus();
        setFocusedElement(element);
      }
    },
    []
  );

  // Handle key down events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!enabled) return;

      const { key, shiftKey, ctrlKey, metaKey } = e;
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? metaKey : ctrlKey;

      let handled = false;

      // Navigation keys
      switch (key) {
        case 'ArrowUp':
          e.preventDefault();
          if (position.rowIndex > 0) {
            const newRow = position.rowIndex - 1;
            setPosition({ ...position, rowIndex: newRow });
            focusCell(newRow, position.colIndex);
            announce(`Row ${newRow + 1} of ${rowCount}`);
          }
          handled = true;
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (position.rowIndex < rowCount - 1) {
            const newRow = position.rowIndex + 1;
            setPosition({ ...position, rowIndex: newRow });
            focusCell(newRow, position.colIndex);
            announce(`Row ${newRow + 1} of ${rowCount}`);
          }
          handled = true;
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (position.colIndex > 0) {
            const newCol = position.colIndex - 1;
            setPosition({ ...position, colIndex: newCol });
            focusCell(position.rowIndex, newCol);
            announce(`Column ${newCol + 1} of ${columnCount}`);
          }
          handled = true;
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (position.colIndex < columnCount - 1) {
            const newCol = position.colIndex + 1;
            setPosition({ ...position, colIndex: newCol });
            focusCell(position.rowIndex, newCol);
            announce(`Column ${newCol + 1} of ${columnCount}`);
          }
          handled = true;
          break;

        case 'Home':
          e.preventDefault();
          if (ctrlKey || metaKey) {
            // Ctrl+Home: Go to first row
            setPosition({ rowIndex: 0, colIndex: position.colIndex });
            focusCell(0, position.colIndex);
            announce('First row');
          } else {
            // Home: Go to first column
            setPosition({ ...position, colIndex: 0 });
            focusCell(position.rowIndex, 0);
            announce('First column');
          }
          handled = true;
          break;

        case 'End':
          e.preventDefault();
          if (ctrlKey || metaKey) {
            // Ctrl+End: Go to last row
            setPosition({ rowIndex: rowCount - 1, colIndex: position.colIndex });
            focusCell(rowCount - 1, position.colIndex);
            announce('Last row');
          } else {
            // End: Go to last column
            setPosition({ ...position, colIndex: columnCount - 1 });
            focusCell(position.rowIndex, columnCount - 1);
            announce('Last column');
          }
          handled = true;
          break;

        case 'PageUp':
          e.preventDefault();
          // Page up: Move up 10 rows
          const newRowUp = Math.max(0, position.rowIndex - 10);
          setPosition({ ...position, rowIndex: newRowUp });
          focusCell(newRowUp, position.colIndex);
          announce(`Page up, row ${newRowUp + 1}`);
          handled = true;
          break;

        case 'PageDown':
          e.preventDefault();
          // Page down: Move down 10 rows
          const newRowDown = Math.min(rowCount - 1, position.rowIndex + 10);
          setPosition({ ...position, rowIndex: newRowDown });
          focusCell(newRowDown, position.colIndex);
          announce(`Page down, row ${newRowDown + 1}`);
          handled = true;
          break;

        // Action keys
        case 'Enter':
          e.preventDefault();
          if (shiftKey) {
            onRowActivate?.(position.rowIndex);
            announce('Row activated');
          } else {
            onCellActivate?.(position.rowIndex, position.colIndex);
            announce('Cell activated');
          }
          handled = true;
          break;

        case ' ':
          e.preventDefault();
          onRowSelect?.(position.rowIndex);
          announce('Row selected');
          handled = true;
          break;

        case 'Escape':
          e.preventDefault();
          // Escape: Deselect or close dialogs
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
          announce('Cancelled');
          handled = true;
          break;

        // Keyboard shortcuts
        case 'a':
          if (modKey) {
            e.preventDefault();
            onSelectAll?.();
            announce('All rows selected');
            handled = true;
          }
          break;

        case 'f':
          if (modKey) {
            e.preventDefault();
            onSearch?.();
            announce('Search focused');
            handled = true;
          }
          break;

        case 'r':
          if (modKey) {
            e.preventDefault();
            onRefresh?.();
            announce('Refreshing');
            handled = true;
          }
          break;

        case 'Delete':
          if (modKey) {
            e.preventDefault();
            // Trigger delete action
            document.dispatchEvent(new CustomEvent('grid-delete', {
              detail: { rowIndex: position.rowIndex },
            }));
            announce('Delete action triggered');
            handled = true;
          }
          break;

        case 'e':
          if (modKey) {
            e.preventDefault();
            // Trigger edit action
            document.dispatchEvent(new CustomEvent('grid-edit', {
              detail: { rowIndex: position.rowIndex },
            }));
            announce('Edit action triggered');
            handled = true;
          }
          break;

        case 'd':
          if (modKey) {
            e.preventDefault();
            // Trigger clone/duplicate action
            document.dispatchEvent(new CustomEvent('grid-clone', {
              detail: { rowIndex: position.rowIndex },
            }));
            announce('Clone action triggered');
            handled = true;
          }
          break;

        // Tab key (default behavior, but track position)
        case 'Tab':
          // Allow default tab behavior, but track focus
          setTimeout(() => {
            const activeElement = document.activeElement as HTMLElement;
            if (activeElement) {
              setFocusedElement(activeElement);
              const row = activeElement.getAttribute('data-row');
              const col = activeElement.getAttribute('data-col');
              if (row !== null && col !== null) {
                setPosition({
                  rowIndex: parseInt(row, 10),
                  colIndex: parseInt(col, 10),
                });
              }
            }
          }, 0);
          break;
      }

      return handled;
    },
    [
      enabled,
      position,
      rowCount,
      columnCount,
      focusCell,
      announce,
      onRowActivate,
      onRowSelect,
      onCellActivate,
      onSelectAll,
      onSearch,
      onRefresh,
    ]
  );

  // Update position when focus changes externally
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement as HTMLElement;
      if (activeElement && gridRef.current?.contains(activeElement)) {
        const row = activeElement.getAttribute('data-row');
        const col = activeElement.getAttribute('data-col');
        if (row !== null && col !== null) {
          setPosition({
            rowIndex: parseInt(row, 10),
            colIndex: parseInt(col, 10),
          });
        }
      }
    };

    document.addEventListener('focusin', handleFocusChange);
    return () => document.removeEventListener('focusin', handleFocusChange);
  }, []);

  return {
    position,
    setPosition,
    focusedElement,
    announce,
    handleKeyDown,
    resetPosition,
  };
}

/**
 * Hook to manage focus trap within a dialog or modal
 */
export function useFocusTrap(enabled: boolean = true) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        // Shift+Tab: If on first element, wrap to last
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab: If on last element, wrap to first
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    
    // Focus first element on mount
    firstElement?.focus();

    return () => {
      container.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);

  return containerRef;
}

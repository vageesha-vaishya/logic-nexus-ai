import { useCallback, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A hook to sync state with URL search parameters for filtering and pagination.
 * Supports optional localStorage persistence.
 */
export function useUrlFilters<T extends Record<string, any>>(
  defaultFilters: T,
  persistenceKey?: string
) {
  const [searchParams, setSearchParams] = useSearchParams();

  // Load from localStorage on mount if URL params are empty and persistenceKey is provided
  useEffect(() => {
    if (!persistenceKey) return;

    const hasUrlParams = Array.from(searchParams.keys()).length > 0;
    if (!hasUrlParams) {
      const saved = localStorage.getItem(persistenceKey);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          const newParams = new URLSearchParams();
          Object.entries(parsed).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
              newParams.set(key, String(value));
            }
          });
          setSearchParams(newParams, { replace: true });
        } catch (e) {
          console.error('Failed to parse saved filters', e);
        }
      }
    }
  }, [persistenceKey, searchParams, setSearchParams]);

  const filters = useMemo(() => {
    const currentFilters = { ...defaultFilters };
    
    // If we have URL params, they take precedence
    const keys = Array.from(searchParams.keys());
    if (keys.length > 0) {
      keys.forEach((key) => {
        const value = searchParams.get(key);
        if (value !== null && key in defaultFilters) {
          const defaultValue = defaultFilters[key];
          if (typeof defaultValue === 'number') {
            (currentFilters as any)[key] = Number(value);
          } else if (typeof defaultValue === 'boolean') {
            (currentFilters as any)[key] = value === 'true';
          } else {
            (currentFilters as any)[key] = value;
          }
        }
      });
    } 
    
    return currentFilters;
  }, [searchParams, defaultFilters]);

  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      setSearchParams(prev => {
        const updatedParams = new URLSearchParams(prev);
        
        Object.entries(newFilters).forEach(([key, value]) => {
          if (value === undefined || value === null || value === (defaultFilters as any)[key]) {
            updatedParams.delete(key);
          } else {
            updatedParams.set(key, String(value));
          }
        });
        
        // Save to localStorage
        if (persistenceKey) {
          const currentParamsObj: Record<string, any> = {};
          updatedParams.forEach((value, key) => {
             currentParamsObj[key] = value;
          });
          localStorage.setItem(persistenceKey, JSON.stringify(currentParamsObj));
        }

        return updatedParams;
      }, { replace: true });
    },
    [setSearchParams, defaultFilters, persistenceKey]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
    if (persistenceKey) {
      localStorage.removeItem(persistenceKey);
    }
  }, [setSearchParams, persistenceKey]);

  return { filters, setFilters, clearFilters };
}

import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * A hook to sync state with URL search parameters for filtering and pagination.
 */
export function useUrlFilters<T extends Record<string, string | number | boolean | undefined>>(
  defaultFilters: T
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => {
    const currentFilters = { ...defaultFilters };
    
    Object.keys(defaultFilters).forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) {
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

    return currentFilters;
  }, [searchParams, defaultFilters]);

  const setFilters = useCallback(
    (newFilters: Partial<T>) => {
      const updatedParams = new URLSearchParams(searchParams);
      
      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === undefined || value === null || value === defaultFilters[key]) {
          updatedParams.delete(key);
        } else {
          updatedParams.set(key, String(value));
        }
      });

      setSearchParams(updatedParams, { replace: true });
    },
    [searchParams, setSearchParams, defaultFilters]
  );

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: true });
  }, [setSearchParams]);

  return { filters, setFilters, clearFilters };
}

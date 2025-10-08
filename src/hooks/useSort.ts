import { useMemo, useState } from 'react';

export type SortDirection = 'asc' | 'desc';

export interface UseSortOptions<T> {
  initialField?: string;
  initialDirection?: SortDirection;
  accessors?: Record<string, (item: T) => any>;
}

function defaultAccessor<T extends Record<string, any>>(item: T, field?: string) {
  if (!field) return item;
  return item[field];
}

function compareValues(a: any, b: any) {
  const an = a == null ? '' : a;
  const bn = b == null ? '' : b;
  if (typeof an === 'number' && typeof bn === 'number') return an - bn;
  if (typeof an === 'boolean' && typeof bn === 'boolean') return (an ? 1 : 0) - (bn ? 1 : 0);
  // Attempt date comparison
  const ad = typeof an === 'string' && !isNaN(Date.parse(an)) ? Date.parse(an) : null;
  const bd = typeof bn === 'string' && !isNaN(Date.parse(b)) ? Date.parse(b) : null;
  if (ad !== null && bd !== null) return ad - bd;
  const as = an.toString().toLowerCase();
  const bs = bn.toString().toLowerCase();
  return as.localeCompare(bs);
}

export function useSort<T>(data: T[], options: UseSortOptions<T> = {}) {
  const [sortField, setSortField] = useState<string | undefined>(options.initialField);
  const [sortDirection, setSortDirection] = useState<SortDirection>(options.initialDirection || 'asc');

  const getValue = (item: T) => {
    const accessor = sortField && options.accessors && options.accessors[sortField];
    return accessor ? accessor(item) : defaultAccessor(item as any, sortField);
  };

  const sorted = useMemo(() => {
    if (!sortField) return data;
    const arr = [...data];
    arr.sort((a, b) => {
      const cmp = compareValues(getValue(a), getValue(b));
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [data, sortField, sortDirection]);

  const onSort = (field: string) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  return { sorted, sortField, sortDirection, onSort, setSortField, setSortDirection };
}
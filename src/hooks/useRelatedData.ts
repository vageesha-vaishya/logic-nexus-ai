import { useState, useEffect, useCallback, useRef } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

interface CacheItem<T> {
  data: T[];
  timestamp: number;
}

interface UseRelatedDataOptions {
  table: string;
  displayField: string;
  searchFields: string[];
  extraFields?: string[];
  pageSize?: number;
  cacheTime?: number; // milliseconds, default 5 minutes
  staleTime?: number; // milliseconds, default 1 hour (persistence)
}

interface UseRelatedDataResult<T> {
  data: T[];
  loading: boolean;
  loadingMore: boolean;
  error: Error | null;
  hasMore: boolean;
  search: (query: string) => void;
  loadMore: () => void;
  reload: () => void;
}

const CACHE_PREFIX = 'crm_related_cache_';

export function useRelatedData<T extends { id: string }>(
  options: UseRelatedDataOptions
): UseRelatedDataResult<T> {
  const { supabase } = useCRM();
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  const cacheRef = useRef<Map<string, CacheItem<T>>>(new Map());
  const abortControllerRef = useRef<AbortController | null>(null);
  
  const {
    table,
    displayField,
    searchFields,
    extraFields = [],
    pageSize = 50,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    staleTime = 60 * 60 * 1000 // 1 hour
  } = options;

  const getCacheKey = (query: string, pageNum: number) => `${table}_${query}_${pageNum}`;

  // Load from local storage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`${CACHE_PREFIX}${table}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Date.now() - parsed.timestamp < staleTime) {
          cacheRef.current = new Map(Object.entries(parsed.cache));
        } else {
          localStorage.removeItem(`${CACHE_PREFIX}${table}`);
        }
      }
    } catch (e) {
      console.warn('Failed to load cache from local storage', e);
    }
  }, [table, staleTime]);

  // Persist cache to local storage periodically
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const cacheObj = Object.fromEntries(cacheRef.current.entries());
        localStorage.setItem(`${CACHE_PREFIX}${table}`, JSON.stringify({
          timestamp: Date.now(),
          cache: cacheObj
        }));
      } catch (e) {
        console.warn('Failed to save cache to local storage', e);
      }
    }, 60000); // Save every minute

    return () => clearInterval(interval);
  }, [table]);

  const fetchData = useCallback(async (
    pageNum: number, 
    query: string, 
    isLoadMore: boolean = false,
    retryCount: number = 0
  ) => {
    const cacheKey = getCacheKey(query, pageNum);
    
    // Check memory cache first
    if (!isLoadMore && pageNum === 0 && cacheRef.current.has(cacheKey)) {
      const cached = cacheRef.current.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < cacheTime) {
        setData(cached.data);
        setHasMore(cached.data.length === pageSize);
        return;
      }
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const selectFields = [
        'id',
        displayField,
        ...searchFields,
        ...extraFields
      ].filter((v, i, a) => a.indexOf(v) === i).join(', ');

      let request = supabase
        .from(table as any)
        .select(selectFields)
        .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

      if (query) {
        const orQuery = searchFields.map(field => `${field}.ilike.%${query}%`).join(',');
        request = request.or(orQuery);
      }

      // Default ordering
      request = request.order(displayField, { ascending: true });

      const { data: result, error: supabaseError } = await request.abortSignal(abortControllerRef.current.signal);

      if (supabaseError) throw supabaseError;

      const newData = result as T[];
      
      if (isLoadMore) {
        setData(prev => {
          // Deduplicate
          const existingIds = new Set(prev.map(item => item.id));
          const uniqueNewData = newData.filter(item => !existingIds.has(item.id));
          return [...prev, ...uniqueNewData];
        });
      } else {
        setData(newData);
      }

      setHasMore(newData.length === pageSize);

      // Update cache
      if (pageNum === 0) {
        cacheRef.current.set(cacheKey, {
          data: newData,
          timestamp: Date.now()
        });
      }

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      console.error(`Error fetching ${table}:`, err);
      
      if (retryCount < 2) {
        console.log(`Retrying... (${retryCount + 1}/2)`);
        setTimeout(() => {
          fetchData(pageNum, query, isLoadMore, retryCount + 1);
        }, 1000 * (retryCount + 1));
        return;
      }

      setError(err);
      toast.error(`Failed to load ${table}. Please try again.`);
    } finally {
      if (isLoadMore) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  }, [supabase, table, displayField, searchFields, pageSize, cacheTime]);

  // Initial load
  useEffect(() => {
    fetchData(0, searchQuery);
  }, [fetchData, searchQuery]); // Re-fetch when search query changes

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchData(nextPage, searchQuery, true);
    }
  }, [loadingMore, hasMore, page, fetchData, searchQuery]);

  const search = useCallback((query: string) => {
    setSearchQuery(query);
    setPage(0);
    // Debouncing is handled by the caller or we can add it here.
    // Since this updates state which triggers useEffect, useEffect will handle the fetch.
  }, []);

  const reload = useCallback(() => {
    cacheRef.current.delete(getCacheKey(searchQuery, 0));
    setPage(0);
    fetchData(0, searchQuery);
  }, [fetchData, searchQuery]);

  return {
    data,
    loading,
    loadingMore,
    error,
    hasMore,
    search,
    loadMore,
    reload
  };
}

import { useCallback, useMemo, useState } from 'react';
import { generatePartInventoryRecords, type PartInventoryRecord } from './mockPartsInventoryData';
import type { PartsCatalogApi, PartsCatalogError, PartsCatalogQuery, PartsCatalogResponse } from './partsInventoryContracts';
import { PartsApiError, type PartsApiAuthDiagnostics } from './livePartsCatalogApi';

export type UsePartsCatalogStateOptions = {
  pageSize?: number;
  seed?: number;
  totalRecords?: number;
  simulateLatencyMs?: number;
  api?: PartsCatalogApi;
};

export type UsePartsCatalogStateResult = {
  records: PartInventoryRecord[];
  loading: boolean;
  error: PartsCatalogError | null;
  hasMore: boolean;
  total: number;
  page: number;
  dataSource: 'api' | 'fallback';
  fallbackAuthDiagnostics: PartsApiAuthDiagnostics | null;
  query: Omit<PartsCatalogQuery, 'page' | 'pageSize'>;
  setQuery: (query: Partial<Omit<PartsCatalogQuery, 'page' | 'pageSize'>>) => void;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
};

type CatalogFetchResult = {
  response: PartsCatalogResponse;
  dataSource: 'api' | 'fallback';
  fallbackAuthDiagnostics: PartsApiAuthDiagnostics | null;
};

function defaultCatalogSource(options: Required<Pick<UsePartsCatalogStateOptions, 'seed' | 'totalRecords'>>): PartInventoryRecord[] {
  return generatePartInventoryRecords({ count: options.totalRecords, seed: options.seed, includeExpired: true });
}

function shouldFallbackToLocalCatalog(cause: unknown): boolean {
  const message = cause instanceof Error ? cause.message : String(cause || '');
  return /401|unauthorized|forbidden|upstream unavailable|network|fetch failed/i.test(message);
}

export function usePartsCatalogState(options: UsePartsCatalogStateOptions = {}): UsePartsCatalogStateResult {
  const pageSize = options.pageSize ?? 50;
  const seed = options.seed ?? 57;
  const totalRecords = options.totalRecords ?? 2000;
  const simulateLatencyMs = options.simulateLatencyMs ?? 180;
  const source = useMemo(() => defaultCatalogSource({ seed, totalRecords }), [seed, totalRecords]);

  const [records, setRecords] = useState<PartInventoryRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<PartsCatalogError | null>(null);
  const [page, setPage] = useState(0);
  const [dataSource, setDataSource] = useState<'api' | 'fallback'>('fallback');
  const [fallbackAuthDiagnostics, setFallbackAuthDiagnostics] = useState<PartsApiAuthDiagnostics | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [query, setQueryState] = useState<Omit<PartsCatalogQuery, 'page' | 'pageSize'>>({
    search: '',
    status: 'all',
    criticality: 'all',
  });

  const filterSource = useCallback((list: PartInventoryRecord[]) => {
    const normalized = (query.search || '').trim().toLowerCase();
    return list.filter((record) => {
      if (query.status && query.status !== 'all' && record.status !== query.status) return false;
      if (query.criticality && query.criticality !== 'all' && record.criticality !== query.criticality) return false;
      if (!normalized) return true;
      return (
        record.part_number.toLowerCase().includes(normalized)
        || record.description.toLowerCase().includes(normalized)
        || record.supplier_name.toLowerCase().includes(normalized)
      );
    });
  }, [query.criticality, query.search, query.status]);

  const fetchPage = useCallback(async (nextPage: number): Promise<CatalogFetchResult> => {
    const pageQuery: PartsCatalogQuery = {
      page: nextPage,
      pageSize,
      search: query.search,
      status: query.status,
      criticality: query.criticality,
    };
    let fallbackDiagnostics: PartsApiAuthDiagnostics | null = null;
    if (options.api) {
      try {
        const response = await options.api.listParts(pageQuery);
        return { response, dataSource: 'api', fallbackAuthDiagnostics: null };
      } catch (cause) {
        if (!shouldFallbackToLocalCatalog(cause)) throw cause;
        fallbackDiagnostics = cause instanceof PartsApiError ? cause.authDiagnostics : null;
      }
    }
    const filtered = filterSource(source);
    const start = (nextPage - 1) * pageSize;
    const end = start + pageSize;
    await new Promise((resolve) => setTimeout(resolve, simulateLatencyMs));
    return {
      dataSource: 'fallback',
      fallbackAuthDiagnostics: fallbackDiagnostics,
      response: {
        items: filtered.slice(start, end),
        page: nextPage,
        pageSize,
        total: filtered.length,
        hasMore: end < filtered.length,
        requestId: `storybook-${nextPage}`,
      },
    };
  }, [filterSource, options.api, pageSize, query.criticality, query.search, query.status, simulateLatencyMs, source]);

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    setError(null);
    try {
      const nextPage = page + 1;
      const result = await fetchPage(nextPage);
      setDataSource(result.dataSource);
      setFallbackAuthDiagnostics(result.fallbackAuthDiagnostics);
      setPage(result.response.page);
      setHasMore(result.response.hasMore);
      setRecords((current) => [...current, ...result.response.items]);
    } catch (cause) {
      setError({
        code: 'UNKNOWN',
        message: cause instanceof Error ? cause.message : 'Unable to load parts catalog',
      });
    } finally {
      setLoading(false);
    }
  }, [fetchPage, hasMore, loading, page]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchPage(1);
      setDataSource(result.dataSource);
      setFallbackAuthDiagnostics(result.fallbackAuthDiagnostics);
      setPage(1);
      setHasMore(result.response.hasMore);
      setRecords(result.response.items);
    } catch (cause) {
      setError({
        code: 'UNKNOWN',
        message: cause instanceof Error ? cause.message : 'Unable to refresh parts catalog',
      });
      setRecords([]);
      setPage(0);
      setHasMore(false);
      setDataSource('fallback');
      setFallbackAuthDiagnostics(null);
    } finally {
      setLoading(false);
    }
  }, [fetchPage]);

  const setQuery = useCallback((next: Partial<Omit<PartsCatalogQuery, 'page' | 'pageSize'>>) => {
    setQueryState((current) => ({ ...current, ...next }));
    setRecords([]);
    setPage(0);
    setHasMore(true);
  }, []);

  const total = useMemo(() => {
    return filterSource(source).length;
  }, [filterSource, source]);

  return {
    records,
    loading,
    error,
    hasMore,
    total,
    page,
    dataSource,
    fallbackAuthDiagnostics,
    query,
    setQuery,
    loadMore,
    refresh,
  };
}

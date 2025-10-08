import { useMemo, useState, useEffect } from 'react';

export type PageSizeOption = number | 'ALL';

export interface UsePaginationOptions {
  initialPageSize?: PageSizeOption;
  pageSizeOptions?: PageSizeOption[];
}

export function usePagination<T>(data: T[], opts: UsePaginationOptions = {}) {
  const pageSizeOptions = opts.pageSizeOptions ?? [10, 20, 50, 100, 'ALL'];
  const [pageSize, setPageSize] = useState<PageSizeOption>(opts.initialPageSize ?? 20);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const sizeValue = pageSize === 'ALL' ? data.length || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil((data.length || 0) / sizeValue));

  useEffect(() => {
    // Clamp page if data or size changes
    if (currentPage > totalPages) setCurrentPage(totalPages);
    if (currentPage < 1) setCurrentPage(1);
  }, [totalPages]);

  const pageItems = useMemo(() => {
    if (pageSize === 'ALL') return data;
    const start = (currentPage - 1) * sizeValue;
    return data.slice(start, start + sizeValue);
  }, [data, currentPage, pageSize, sizeValue]);

  const nextPage = () => setCurrentPage((p) => Math.min(totalPages, p + 1));
  const prevPage = () => setCurrentPage((p) => Math.max(1, p - 1));
  const firstPage = () => setCurrentPage(1);
  const lastPage = () => setCurrentPage(totalPages);

  const canPrev = currentPage > 1;
  const canNext = currentPage < totalPages;

  return {
    pageItems,
    pageSize,
    setPageSize,
    pageSizeOptions,
    currentPage,
    setCurrentPage,
    totalPages,
    nextPage,
    prevPage,
    firstPage,
    lastPage,
    canPrev,
    canNext,
  };
}
/**
 * Grid Pagination Component
 * 
 * Features:
 * - Page navigation (First, Previous, Next, Last)
 * - Page number display
 * - Page size selector
 * - Item count display
 * - Keyboard navigation support
 * - Accessibility compliant
 */

import { useCallback, useMemo } from 'react';
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTemplateGridStore } from '../store/useTemplateGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

interface GridPaginationProps {
  totalCount: number;
  isLoading?: boolean;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100, 200];

// ── Utility Functions ──────────────────────────────────────────────────────────

function getPageNumbers(currentPage: number, totalPages: number): number[] {
  const pages: number[] = [];
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    // Show all pages
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    // Always show first page
    pages.push(1);

    let startPage = Math.max(2, currentPage - 1);
    let endPage = Math.min(totalPages - 1, currentPage + 1);

    // Adjust if at the start
    if (currentPage <= 3) {
      endPage = Math.min(totalPages - 1, 4);
    }

    // Adjust if at the end
    if (currentPage >= totalPages - 2) {
      startPage = Math.max(2, totalPages - 3);
    }

    // Add ellipsis before
    if (startPage > 2) {
      pages.push(-1); // -1 represents ellipsis
    }

    // Add middle pages
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    // Add ellipsis after
    if (endPage < totalPages - 1) {
      pages.push(-2); // -2 represents ellipsis
    }

    // Always show last page
    pages.push(totalPages);
  }

  return pages;
}

// ── Component ────────────────────────────────────────────────────────────────

export function GridPagination({ totalCount, isLoading = false }: GridPaginationProps) {
  const {
    pageIndex,
    pageSize,
    setPageIndex,
    setPageSize,
  } = useTemplateGridStore();

  // Calculate pagination
  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [totalCount, pageSize]
  );

  const currentPage = pageIndex + 1; // Convert to 1-based for display

  const startItem = totalCount === 0 ? 0 : pageIndex * pageSize + 1;
  const endItem = Math.min((pageIndex + 1) * pageSize, totalCount);

  // Navigation handlers
  const goToFirstPage = useCallback(() => {
    setPageIndex(0);
  }, [setPageIndex]);

  const goToPreviousPage = useCallback(() => {
    setPageIndex(Math.max(0, pageIndex - 1));
  }, [setPageIndex, pageIndex]);

  const goToNextPage = useCallback(() => {
    setPageIndex(Math.min(totalPages - 1, pageIndex + 1));
  }, [setPageIndex, pageIndex, totalPages]);

  const goToLastPage = useCallback(() => {
    setPageIndex(totalPages - 1);
  }, [setPageIndex, totalPages]);

  const goToPage = useCallback(
    (page: number) => {
      setPageIndex(page - 1); // Convert to 0-based
    },
    [setPageIndex]
  );

  // Handle page size change
  const handlePageSizeChange = useCallback(
    (value: string) => {
      const newSize = parseInt(value, 10);
      setPageSize(newSize);
      // Reset to first page when changing page size
      setPageIndex(0);
    },
    [setPageSize, setPageIndex]
  );

  // Get page numbers to display
  const pageNumbers = useMemo(
    () => getPageNumbers(currentPage, totalPages),
    [currentPage, totalPages]
  );

  // Don't show pagination if no data
  if (totalCount === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-card"
      role="navigation"
      aria-label="Pagination navigation"
    >
      {/* Left: Item count and page size */}
      <div className="flex items-center gap-4 w-full sm:w-auto">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Showing{' '}
          <span className="font-medium text-foreground">
            {startItem}-{endItem}
          </span>{' '}
          of{' '}
          <span className="font-medium text-foreground">
            {totalCount.toLocaleString()}
          </span>{' '}
          templates
        </p>

        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page:</span>
          <Select
            value={String(pageSize)}
            onValueChange={handlePageSizeChange}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[80px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
              <SelectItem value={String(totalCount)}>
                All ({totalCount})
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: Page navigation */}
      <div className="flex items-center gap-2">
        {/* First page */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToFirstPage}
          disabled={currentPage === 1 || isLoading}
          aria-label="Go to first page"
          className="h-8 w-8 p-0"
        >
          <ChevronFirst className="h-4 w-4" />
        </Button>

        {/* Previous page */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToPreviousPage}
          disabled={currentPage === 1 || isLoading}
          aria-label="Go to previous page"
          className="h-8 w-8 p-0"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>

        {/* Page numbers */}
        <div className="flex items-center gap-1">
          {pageNumbers.map((pageNum, index) => {
            // Ellipsis
            if (pageNum < 0) {
              return (
                <span
                  key={`ellipsis-${index}`}
                  className="px-2 text-muted-foreground"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }

            const isActive = pageNum === currentPage;

            return (
              <Button
                key={pageNum}
                variant={isActive ? 'default' : 'outline'}
                size="sm"
                onClick={() => goToPage(pageNum)}
                disabled={isLoading}
                aria-label={`Go to page ${pageNum}`}
                aria-current={isActive ? 'page' : undefined}
                className="h-8 w-8 p-0"
              >
                {pageNum}
              </Button>
            );
          })}
        </div>

        {/* Next page */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToNextPage}
          disabled={currentPage === totalPages || isLoading}
          aria-label="Go to next page"
          className="h-8 w-8 p-0"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>

        {/* Last page */}
        <Button
          variant="outline"
          size="sm"
          onClick={goToLastPage}
          disabled={currentPage === totalPages || isLoading}
          aria-label="Go to last page"
          className="h-8 w-8 p-0"
        >
          <ChevronLast className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

import {
  Pagination,
  PaginationContent,
  PaginationFirst,
  PaginationItem,
  PaginationLast,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { PageSizeOption } from '@/hooks/usePagination';

interface PaginationSizeBarProps {
  /** Label shown next to the page-size select, e.g. "Rows per page" or "Cards per page". */
  sizeLabel: string;
  /** Placeholder shown inside the page-size select before a value is chosen. */
  sizePlaceholder?: string;
  pageSize: PageSizeOption;
  onPageSizeChange: (value: PageSizeOption) => void;
  pageSizeOptions: PageSizeOption[];
  currentPage: number;
  totalPages: number;
  canPrev: boolean;
  canNext: boolean;
  onFirstPage: () => void;
  onPrevPage: () => void;
  onNextPage: () => void;
  onLastPage: () => void;
}

/**
 * Page-size selector + pagination nav, paired with the `usePagination` hook.
 * Extracted because Activities.tsx rendered this exact block twice (board
 * view and table view) with only the label text differing.
 */
export function PaginationSizeBar({
  sizeLabel,
  sizePlaceholder,
  pageSize,
  onPageSizeChange,
  pageSizeOptions,
  currentPage,
  totalPages,
  canPrev,
  canNext,
  onFirstPage,
  onPrevPage,
  onNextPage,
  onLastPage,
}: PaginationSizeBarProps) {
  return (
    <div className="mt-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <div className="text-xs text-muted-foreground">{sizeLabel}</div>
        <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(v === 'ALL' ? 'ALL' : Number(v))}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={sizePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {pageSizeOptions.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>{String(opt)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Pagination className="justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationFirst onClick={onFirstPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
          </PaginationItem>
          <PaginationItem>
            <PaginationPrevious onClick={onPrevPage} className={!canPrev ? 'pointer-events-none opacity-50' : ''} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink isActive size="default">Page {currentPage} of {totalPages}</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext onClick={onNextPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
          </PaginationItem>
          <PaginationItem>
            <PaginationLast onClick={onLastPage} className={!canNext ? 'pointer-events-none opacity-50' : ''} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

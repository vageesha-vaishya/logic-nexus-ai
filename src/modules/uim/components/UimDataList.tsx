import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, RefreshCcw, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AircraftDataTableFrame } from '@/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftDataTableFrame';
import { AircraftListingControls } from '@/features/module-amro/settings/pages/amro-settings-master-data/components/AircraftListingControls';

export type UimDataListColumn<TRecord> = {
  key: string;
  header: string;
  sortable?: boolean;
  widthClassName?: string;
  render: (record: TRecord) => string;
};

type UimDataListProps<TRecord> = {
  records: TRecord[];
  total: number;
  loading?: boolean;
  searchValue: string;
  onSearchChange: (value: string) => void;
  statusValue: string;
  onStatusChange: (value: string) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onRowClick: (record: TRecord) => void;
  onRowDoubleClick?: (record: TRecord) => void;
  columns: UimDataListColumn<TRecord>[];
  statusOptions?: Array<{ value: string; label: string }>;
  exportFileName: string;
  modeBadgeLabel?: string;
  onReplayNow?: () => void;
  replayLoading?: boolean;
  defaultVisibleColumnKeys?: string[];
  showFieldSelector?: boolean;
};

type SortState = { key: string; direction: 'asc' | 'desc' };

function loadVisibleColumns(
  storageKey: string,
  columns: UimDataListColumn<any>[],
  defaultVisibleColumnKeys?: string[],
): string[] {
  if (typeof window === 'undefined') return columns.map((column) => column.key);
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) || 'null');
    if (!Array.isArray(parsed)) {
      const known = new Set(columns.map((column) => column.key));
      const defaults = (defaultVisibleColumnKeys || []).filter((key) => known.has(key));
      return defaults.length > 0 ? defaults : columns.map((column) => column.key);
    }
    const known = new Set(columns.map((column) => column.key));
    const filtered = parsed.map((key) => String(key)).filter((key) => known.has(key));
    return filtered.length > 0 ? filtered : columns.map((column) => column.key);
  } catch {
    const known = new Set(columns.map((column) => column.key));
    const defaults = (defaultVisibleColumnKeys || []).filter((key) => known.has(key));
    return defaults.length > 0 ? defaults : columns.map((column) => column.key);
  }
}

function loadManualSelectionFlag(storageKey: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(`${storageKey}:meta`) || 'null');
    return Boolean(parsed?.manual);
  } catch {
    return false;
  }
}

function normalize(value: string): string {
  return String(value || '').toLowerCase();
}

export function UimDataList<TRecord>({
  records,
  total,
  loading = false,
  searchValue,
  onSearchChange,
  statusValue,
  onStatusChange,
  onClearFilters,
  onCreate,
  onRowClick,
  onRowDoubleClick,
  columns,
  statusOptions = [
    { value: 'all', label: 'All' },
    { value: 'active', label: 'Active' },
    { value: 'fulfilled', label: 'Fulfilled' },
    { value: 'cancelled', label: 'Cancelled' },
  ],
  exportFileName,
  modeBadgeLabel,
  onReplayNow,
  replayLoading = false,
  defaultVisibleColumnKeys = [],
  showFieldSelector = true,
}: UimDataListProps<TRecord>) {
  const [sortStates, setSortStates] = useState<SortState[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [columnSelectionError, setColumnSelectionError] = useState<string | null>(null);
  const columnStorageKey = `uim-data-list-visible-columns:v3:${exportFileName}`;
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(
    () => loadVisibleColumns(columnStorageKey, columns, defaultVisibleColumnKeys),
  );
  const [hasManualColumnSelection, setHasManualColumnSelection] = useState<boolean>(
    () => loadManualSelectionFlag(columnStorageKey),
  );

  useEffect(() => {
    const known = new Set(columns.map((column) => column.key));
    const filtered = visibleColumnKeys.filter((key) => known.has(key));
    const configuredDefaults = defaultVisibleColumnKeys.filter((key) => known.has(key));
    const fallback = configuredDefaults.length > 0 ? configuredDefaults : columns.map((column) => column.key);
    const normalized = hasManualColumnSelection
      ? (filtered.length > 0 ? filtered : fallback)
      : fallback;
    const hasChanged = normalized.length !== visibleColumnKeys.length
      || normalized.some((key, index) => key !== visibleColumnKeys[index]);
    if (hasChanged) {
      setVisibleColumnKeys(normalized);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(columnStorageKey, JSON.stringify(normalized));
      }
    }
  }, [columns, visibleColumnKeys, columnStorageKey, defaultVisibleColumnKeys, hasManualColumnSelection]);

  const visibleColumns = useMemo(
    () => columns.filter((column) => visibleColumnKeys.includes(column.key)),
    [columns, visibleColumnKeys],
  );

  const sorted = useMemo(() => {
    if (sortStates.length === 0) return records;
    const sortedRecords = [...records].sort((left, right) => {
      for (const state of sortStates) {
        const targetColumn = columns.find((column) => column.key === state.key);
        if (!targetColumn) continue;
        const l = normalize(targetColumn.render(left));
        const r = normalize(targetColumn.render(right));
        if (l === r) continue;
        const cmp = l > r ? 1 : -1;
        return state.direction === 'desc' ? cmp * -1 : cmp;
      }
      return 0;
    });
    return sortedRecords;
  }, [records, sortStates, columns]);

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, maxPage);
  const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const exportCsv = () => {
    const targetColumns = visibleColumns.length > 0 ? visibleColumns : columns;
    const headerLine = targetColumns.map((column) => `"${column.header.replace(/"/g, '""')}"`).join(',');
    const body = sorted.map((record) =>
      targetColumns.map((column) => `"${column.render(record).replace(/"/g, '""')}"`).join(','),
    );
    const csv = [headerLine, ...body].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = exportFileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const summaryText = `${sorted.length}/${total} records`;
  const selectedCount = (visibleColumns.length > 0 ? visibleColumns.length : columns.length);
  const totalCount = columns.length;

  const applyColumnSelection = (nextKeys: string[]) => {
    const known = new Set(columns.map((column) => column.key));
    const sanitized = nextKeys.filter((key) => known.has(key));
    if (sanitized.length === 0) {
      setColumnSelectionError('At least one field must remain visible.');
      return;
    }
    setColumnSelectionError(null);
    setVisibleColumnKeys(sanitized);
    setHasManualColumnSelection(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(columnStorageKey, JSON.stringify(sanitized));
      window.localStorage.setItem(`${columnStorageKey}:meta`, JSON.stringify({ manual: true }));
    }
  };

  return (
    <div data-testid="uim-data-list">
      <AircraftDataTableFrame
        controls={(
          <AircraftListingControls
            searchValue={searchValue}
            onSearchChange={onSearchChange}
            searchPlaceholder="Search records"
            searchAriaLabel="Search UIM records"
            statusValue={statusValue}
            onStatusChange={onStatusChange}
            statusAriaLabel="Filter UIM records by status"
            statusOptions={statusOptions}
            clearFiltersLabel="Clear filters"
            onClearFilters={() => {
              setPage(1);
              onClearFilters();
            }}
            createLabel="Add"
            createAriaLabel="Create new record"
            onCreate={onCreate}
            createLoading={loading}
            resultSummaryText={summaryText}
          />
        )}
        beforeContent={(
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[hsl(var(--mdm-template-border))] bg-background/60 px-3 py-2">
            <div className="flex items-center gap-2">
              {modeBadgeLabel ? <Badge variant="secondary">{modeBadgeLabel}</Badge> : null}
              {searchValue ? <Badge variant="secondary">Query: {searchValue}</Badge> : null}
              {statusValue !== 'all' ? <Badge variant="secondary">Status: {statusValue}</Badge> : null}
            </div>
            <div className="flex items-center gap-2">
              {showFieldSelector ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" variant="outline" size="sm" className="h-8">
                      <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                      Fields
                      <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                        {selectedCount}/{totalCount}
                      </Badge>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-[320px]">
                    <DropdownMenuLabel>Select visible fields</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {columns.map((column) => {
                      const checked = visibleColumnKeys.includes(column.key);
                      return (
                        <DropdownMenuCheckboxItem
                          key={column.key}
                          checked={checked}
                          onCheckedChange={(nextChecked) => {
                            const nextKeys = nextChecked === true
                              ? [...visibleColumnKeys, column.key]
                              : visibleColumnKeys.filter((key) => key !== column.key);
                            applyColumnSelection(nextKeys);
                          }}
                          onSelect={(event) => event.preventDefault()}
                        >
                          {column.header}
                        </DropdownMenuCheckboxItem>
                      );
                    })}
                    {columnSelectionError ? (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1 text-xs text-destructive">{columnSelectionError}</div>
                      </>
                    ) : null}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        applyColumnSelection(columns.map((column) => column.key));
                      }}
                    >
                      Reset to default fields
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : null}
              {onReplayNow ? (
                <Button type="button" size="sm" variant="outline" onClick={onReplayNow} disabled={replayLoading}>
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  {replayLoading ? 'Replaying...' : 'Replay Now'}
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="outline" onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              {(visibleColumns.length > 0 ? visibleColumns : columns).map((column) => {
                const sortIndex = sortStates.findIndex((state) => state.key === column.key);
                const isSorted = sortIndex >= 0;
                const direction = isSorted ? sortStates[sortIndex]?.direction : null;
                const icon = !column.sortable ? null : !isSorted ? <ArrowUpDown className="h-3.5 w-3.5" /> : direction === 'asc'
                  ? <ArrowUp className="h-3.5 w-3.5" />
                  : <ArrowDown className="h-3.5 w-3.5" />;
                return (
                  <TableHead key={column.key} className={column.widthClassName}>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${column.sortable ? 'hover:text-foreground' : ''}`}
                      onClick={(event) => {
                        if (!column.sortable) return;
                        setSortStates((current) => {
                          const existing = current.find((state) => state.key === column.key);
                          const nextDirection: 'asc' | 'desc' = existing?.direction === 'asc' ? 'desc' : 'asc';
                          if (event.shiftKey) {
                            const without = current.filter((state) => state.key !== column.key);
                            return [...without, { key: column.key, direction: nextDirection }];
                          }
                          return [{ key: column.key, direction: nextDirection }];
                        });
                      }}
                    >
                      <span>{column.header}</span>
                      {icon}
                      {isSorted ? <span className="text-[10px] text-muted-foreground">#{sortIndex + 1}</span> : null}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={(visibleColumns.length > 0 ? visibleColumns : columns).length} className="text-sm text-muted-foreground">
                  {loading ? 'Loading records...' : 'No records found'}
                </TableCell>
              </TableRow>
            ) : paged.map((record, index) => (
              <TableRow
                key={`record-${index}`}
                className="cursor-pointer hover:bg-primary/5"
                onClick={() => onRowClick(record)}
                onDoubleClick={() => onRowDoubleClick?.(record)}
              >
                {(visibleColumns.length > 0 ? visibleColumns : columns).map((column) => (
                  <TableCell key={column.key}>{column.render(record)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-[hsl(var(--mdm-template-border))] px-3 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            Page {clampedPage} of {maxPage}
            <span>|</span>
            <label className="inline-flex items-center gap-1">
              <span>Rows</span>
              <select
                className="rounded border bg-background px-1 py-0.5 text-xs"
                value={pageSize}
                onChange={(event) => {
                  setPage(1);
                  setPageSize(Number(event.target.value));
                }}
              >
                {[10, 25, 50, 100].map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={clampedPage <= 1}>
              Prev
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setPage((p) => Math.min(maxPage, p + 1))} disabled={clampedPage >= maxPage}>
              Next
            </Button>
          </div>
        </div>
      </AircraftDataTableFrame>
    </div>
  );
}

export default UimDataList;

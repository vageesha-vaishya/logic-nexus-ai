import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Download, RefreshCcw } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  columns: UimDataListColumn<TRecord>[];
  statusOptions?: Array<{ value: string; label: string }>;
  exportFileName: string;
  modeBadgeLabel?: string;
  onReplayNow?: () => void;
  replayLoading?: boolean;
};

type SortState = { key: string; direction: 'asc' | 'desc' } | null;

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
}: UimDataListProps<TRecord>) {
  const [sortState, setSortState] = useState<SortState>(null);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const sorted = useMemo(() => {
    if (!sortState) return records;
    const targetColumn = columns.find((column) => column.key === sortState.key);
    if (!targetColumn) return records;
    const sortedRecords = [...records].sort((left, right) => {
      const l = normalize(targetColumn.render(left));
      const r = normalize(targetColumn.render(right));
      if (l === r) return 0;
      return l > r ? 1 : -1;
    });
    return sortState.direction === 'desc' ? sortedRecords.reverse() : sortedRecords;
  }, [records, sortState, columns]);

  const maxPage = Math.max(1, Math.ceil(sorted.length / pageSize));
  const clampedPage = Math.min(page, maxPage);
  const paged = sorted.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const exportCsv = () => {
    const headerLine = columns.map((column) => `"${column.header.replace(/"/g, '""')}"`).join(',');
    const body = sorted.map((record) =>
      columns.map((column) => `"${column.render(record).replace(/"/g, '""')}"`).join(','),
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
              {columns.map((column) => {
                const isSorted = sortState?.key === column.key;
                const icon = !column.sortable ? null : !isSorted ? <ArrowUpDown className="h-3.5 w-3.5" /> : sortState?.direction === 'asc'
                  ? <ArrowUp className="h-3.5 w-3.5" />
                  : <ArrowDown className="h-3.5 w-3.5" />;
                return (
                  <TableHead key={column.key} className={column.widthClassName}>
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1 ${column.sortable ? 'hover:text-foreground' : ''}`}
                      onClick={() => {
                        if (!column.sortable) return;
                        setSortState((current) => {
                          if (!current || current.key !== column.key) return { key: column.key, direction: 'asc' };
                          return { key: column.key, direction: current.direction === 'asc' ? 'desc' : 'asc' };
                        });
                      }}
                    >
                      <span>{column.header}</span>
                      {icon}
                    </button>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-sm text-muted-foreground">
                  {loading ? 'Loading records...' : 'No records found'}
                </TableCell>
              </TableRow>
            ) : paged.map((record, index) => (
              <TableRow
                key={`record-${index}`}
                className="cursor-pointer hover:bg-primary/5"
                onClick={() => onRowClick(record)}
              >
                {columns.map((column) => (
                  <TableCell key={column.key}>{column.render(record)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div className="flex items-center justify-between border-t border-[hsl(var(--mdm-template-border))] px-3 py-2">
          <span className="text-xs text-muted-foreground">
            Page {clampedPage} of {maxPage}
          </span>
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

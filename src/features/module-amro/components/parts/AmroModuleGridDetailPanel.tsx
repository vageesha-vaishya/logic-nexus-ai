import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { AmroHeaderCell, AmroTableMessageRow, amroTableClassNames } from './amroTableStandards';

export type AmroGridColumn<T> = {
  key: string;
  label: string;
  className?: string;
  render: (row: T) => JSX.Element | string | number;
};

export function AmroModuleGridDetailPanel<T extends { id: string }>({
  rows,
  columns,
  loading,
  emptyMessage,
  selectedId,
  onSelect,
  detailTitle = 'Record Detail',
  renderDetail,
}: {
  rows: T[];
  columns: AmroGridColumn<T>[];
  loading: boolean;
  emptyMessage: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
  detailTitle?: string;
  renderDetail: (row: T | null) => JSX.Element;
}): JSX.Element {
  const selectedRow = useMemo(() => rows.find((row) => row.id === selectedId) || null, [rows, selectedId]);
  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.35fr_1fr]">
      <div className={amroTableClassNames.container}>
        <table className={amroTableClassNames.table}>
          <thead className={amroTableClassNames.thead}>
            <tr>{columns.map((column) => <AmroHeaderCell key={column.key} className={column.className}>{column.label}</AmroHeaderCell>)}</tr>
          </thead>
          <tbody>
            {loading ? (
              <AmroTableMessageRow colSpan={columns.length}>Loading records...</AmroTableMessageRow>
            ) : rows.length === 0 ? (
              <AmroTableMessageRow colSpan={columns.length}>{emptyMessage}</AmroTableMessageRow>
            ) : rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  amroTableClassNames.row,
                  row.id === selectedId ? 'bg-primary/5' : 'hover:bg-muted/40',
                )}
                onClick={() => onSelect(row.id)}
              >
                {columns.map((column) => (
                  <td key={`${row.id}-${column.key}`} className={cn(amroTableClassNames.td, column.className)}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-md border p-3">
        <h4 className="mb-2 text-sm font-semibold">{detailTitle}</h4>
        {renderDetail(selectedRow)}
      </div>
    </div>
  );
}

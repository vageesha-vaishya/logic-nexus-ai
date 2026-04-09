import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export const amroTableClassNames = {
  container: 'overflow-auto rounded-md border',
  table: 'w-full text-sm',
  thead: 'bg-slate-50 text-left',
  th: 'sticky top-0 z-10 bg-slate-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-600',
  row: 'border-t border-slate-200',
  td: 'px-3 py-2 align-middle',
  messageCell: 'px-3 py-6 text-sm text-slate-600',
} as const;

export const amroCompactTableClassNames = {
  table: 'w-full text-xs',
  thead: 'bg-slate-50 text-left',
  th: 'sticky top-0 z-10 bg-slate-50 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600',
  row: 'border-t border-slate-200',
  td: 'px-2 py-1.5 align-middle',
} as const;

export function AmroTableMessageRow({
  colSpan,
  children,
}: {
  colSpan: number;
  children: ReactNode;
}): JSX.Element {
  return (
    <tr>
      <td colSpan={colSpan} className={amroTableClassNames.messageCell}>
        {children}
      </td>
    </tr>
  );
}

export function AmroHeaderCell({
  children,
  compact = false,
  className,
}: {
  children: ReactNode;
  compact?: boolean;
  className?: string;
}): JSX.Element {
  return (
    <th
      className={cn(
        compact ? amroCompactTableClassNames.th : amroTableClassNames.th,
        className,
      )}
    >
      {children}
    </th>
  );
}

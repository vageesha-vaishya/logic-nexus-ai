import type { ReactNode } from 'react';
import { Filter, Search, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export function AmroModuleSurface({
  title,
  subtitle,
  moduleId,
  status = 'ready',
  children,
}: {
  title: string;
  subtitle: string;
  moduleId: string;
  status?: 'ready' | 'loading' | 'warning';
  children: ReactNode;
}): JSX.Element {
  return (
    <Card className="border-slate-300 shadow-sm">
      <CardHeader className="space-y-2 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] uppercase">{moduleId}</Badge>
            <Badge
              variant={status === 'warning' ? 'destructive' : status === 'loading' ? 'secondary' : 'default'}
              className="text-[10px] uppercase"
            >
              {status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function AmroStandardToolbar({
  searchValue,
  onSearchChange,
  leftActions,
  rightActions,
  placeholder = 'Search...',
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  leftActions?: ReactNode;
  rightActions?: ReactNode;
  placeholder?: string;
}): JSX.Element {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2">
      <div className="flex min-w-[260px] flex-1 items-center gap-2">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={placeholder}
            className="pl-8"
          />
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8">
          <Filter className="mr-1 h-3.5 w-3.5" />
          Filter
        </Button>
        <Button type="button" variant="outline" size="sm" className="h-8">
          <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
          View
        </Button>
        {leftActions}
      </div>
      <div className="flex items-center gap-2">{rightActions}</div>
    </div>
  );
}

export function AmroKpiGrid({ items }: { items: Array<{ label: string; value: string; tone?: 'default' | 'success' | 'warning' }> }): JSX.Element {
  return (
    <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            'rounded-md border px-3 py-2 text-sm',
            item.tone === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : '',
            item.tone === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : '',
          )}
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="font-semibold">{item.value}</p>
        </div>
      ))}
    </div>
  );
}

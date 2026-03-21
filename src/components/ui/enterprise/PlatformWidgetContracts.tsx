import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type PlatformWidgetContract = {
  id: string;
  title: string;
  content: ReactNode;
  emphasis?: 'default' | 'critical' | 'success';
};

type PlatformWidgetRailProps = {
  widgets: PlatformWidgetContract[];
  className?: string;
};

const emphasisClass: Record<NonNullable<PlatformWidgetContract['emphasis']>, string> = {
  default: 'border-border bg-card',
  critical: 'border-red-300 bg-red-50',
  success: 'border-emerald-300 bg-emerald-50',
};

export function PlatformWidgetRail({ widgets, className }: PlatformWidgetRailProps) {
  if (!widgets.length) return null;
  return (
    <aside className={cn('grid grid-cols-1 gap-3', className)}>
      {widgets.map((widget) => (
        <section
          key={widget.id}
          className={cn(
            'rounded-md border px-3 py-2 shadow-sm',
            emphasisClass[widget.emphasis || 'default']
          )}
        >
          <h2 className="text-sm font-semibold">{widget.title}</h2>
          <div className="mt-1 text-xs text-muted-foreground">{widget.content}</div>
        </section>
      ))}
    </aside>
  );
}

type PlatformWidgetSlotProps = {
  children: ReactNode;
  widgets?: PlatformWidgetContract[];
  className?: string;
};

export function PlatformWidgetSlot({ children, widgets = [], className }: PlatformWidgetSlotProps) {
  return (
    <div className={cn('grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]', className)}>
      <div className="min-w-0">{children}</div>
      <PlatformWidgetRail widgets={widgets} />
    </div>
  );
}

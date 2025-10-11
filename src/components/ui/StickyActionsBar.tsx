import * as React from 'react';
import { cn } from '@/lib/utils';

type StickyActionsBarProps = {
  left?: React.ReactNode[];
  right?: React.ReactNode[];
  className?: string;
};

export function StickyActionsBar({ left = [], right = [], className }: StickyActionsBarProps) {
  const hasAnything = (left && left.length > 0) || (right && right.length > 0);
  if (!hasAnything) return null;

  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 w-full border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60',
        'px-3 py-3',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {left.map((node, idx) => (
            <div key={idx} className="shrink-0">{node}</div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {right.map((node, idx) => (
            <div key={idx} className="shrink-0">{node}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default StickyActionsBar;
import React, { useMemo } from 'react';
import { diffLines, Change } from 'diff';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DiffViewerProps {
  oldContent: string;
  newContent: string;
  splitView?: boolean;
}

export function DiffViewer({ oldContent, newContent, splitView = true }: DiffViewerProps) {
  const diff = useMemo(() => diffLines(oldContent, newContent), [oldContent, newContent]);

  if (splitView) {
    return (
      <div className="flex h-full border rounded-md overflow-hidden font-mono text-sm">
        <div className="flex-1 border-r bg-red-50/30 overflow-auto">
          <div className="p-4 min-w-full">
            {diff.map((part, index) => (
              part.removed ? (
                <div key={index} className="bg-status-danger text-status-danger-foreground whitespace-pre-wrap break-all">
                  {part.value}
                </div>
              ) : !part.added ? (
                <div key={index} className="text-muted-foreground whitespace-pre-wrap break-all opacity-50">
                  {part.value}
                </div>
              ) : null
            ))}
          </div>
        </div>
        <div className="flex-1 bg-green-50/30 overflow-auto">
          <div className="p-4 min-w-full">
            {diff.map((part, index) => (
              part.added ? (
                <div key={index} className="bg-status-success text-status-success-foreground whitespace-pre-wrap break-all">
                  {part.value}
                </div>
              ) : !part.removed ? (
                <div key={index} className="text-muted-foreground whitespace-pre-wrap break-all">
                  {part.value}
                </div>
              ) : null
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full border rounded-md font-mono text-sm p-4">
      {diff.map((part, index) => (
        <span
          key={index}
          className={cn(
            part.added ? 'bg-status-success text-status-success-foreground' :
            part.removed ? 'bg-status-danger text-status-danger-foreground' :
            'text-muted-foreground'
          )}
        >
          {part.value}
        </span>
      ))}
    </ScrollArea>
  );
}

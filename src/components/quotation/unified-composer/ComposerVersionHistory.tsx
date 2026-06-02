// Version history sheet for UnifiedQuoteComposer.
// Extracted from UnifiedQuoteComposer.tsx (Slice C). Pure presentation;
// versionHistory + onLoadVersion supplied by the composer.

import type { SetURLSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ExternalLink, History } from 'lucide-react';

export interface QuoteVersionRow {
  id: string;
  version_number: number;
  created_at: string;
  change_summary?: string | null;
  created_by_email?: string | null;
}

interface ComposerVersionHistoryProps {
  versionHistory: QuoteVersionRow[];
  setSearchParams: SetURLSearchParams;
}

export function ComposerVersionHistory({ versionHistory, setSearchParams }: ComposerVersionHistoryProps) {
  if (versionHistory.length === 0) return null;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <History className="h-4 w-4" />
          Version History
          <Badge variant="secondary" className="ml-1 h-5 px-1.5 min-w-[1.25rem]">
            {versionHistory.length}
          </Badge>
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Version History</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-4">
          {versionHistory.map((ver) => (
            <div
              key={ver.id}
              className="flex flex-col gap-2 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">Version {ver.version_number}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(ver.created_at).toLocaleDateString()}
                </span>
              </div>
              <div className="text-sm text-muted-foreground line-clamp-2">
                {ver.change_summary || 'No summary available'}
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-xs bg-muted px-2 py-0.5 rounded text-muted-foreground">
                  {ver.created_by_email || 'System'}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setSearchParams((prev) => {
                      const newParams = new URLSearchParams(prev);
                      newParams.set('versionId', ver.id);
                      return newParams;
                    });
                  }}
                >
                  Load <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}

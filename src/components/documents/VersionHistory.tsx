import React from 'react';
import { format } from 'date-fns';
import { DocumentVersion } from '@/lib/document-service';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RotateCcw, GitCommit, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VersionHistoryProps {
  versions: DocumentVersion[];
  currentVersionId?: string;
  onSelectVersion: (version: DocumentVersion) => void;
  onRevert: (version: DocumentVersion) => void;
}

export function VersionHistory({ versions, currentVersionId, onSelectVersion, onRevert }: VersionHistoryProps) {
  return (
    <div className="flex flex-col h-full border-r bg-muted/10 w-80">
      <div className="p-4 border-b bg-background">
        <h3 className="font-semibold flex items-center gap-2">
          <GitCommit className="h-4 w-4" />
          Version History
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {versions.map((version) => (
            <div
              key={version.id}
              className={cn(
                "group relative flex flex-col gap-2 p-3 rounded-lg border transition-all hover:bg-accent cursor-pointer",
                currentVersionId === version.id ? "bg-accent border-primary" : "bg-card"
              )}
              onClick={() => onSelectVersion(version)}
            >
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="font-mono">v{version.version}</Badge>
                <span className="text-xs text-muted-foreground">
                  {format(new Date(version.created_at), 'MMM d, HH:mm')}
                </span>
              </div>
              
              <div className="text-sm font-medium leading-none">
                {version.change_notes || "No notes"}
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className={cn(
                  "w-2 h-2 rounded-full",
                  version.change_type === 'major' ? "bg-red-500" :
                  version.change_type === 'minor' ? "bg-blue-500" : "bg-green-500"
                )} />
                <span className="capitalize">{version.change_type}</span>
                <span>•</span>
                <span>{version.author?.email || 'Unknown'}</span>
              </div>

              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRevert(version);
                  }}
                  title="Revert to this version"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

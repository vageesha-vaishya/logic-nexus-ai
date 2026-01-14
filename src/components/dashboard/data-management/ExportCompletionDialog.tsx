import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertTriangle, Download, CloudUpload, FileText } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

interface ExportCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  summary: {
    totalTables: number;
    totalRows: number;
    errors: string[];
    skipped: { name: string; reason: string }[];
    timestamp: string;
    duration: string;
  };
  onDownload: () => void;
  onCloudUpload?: () => void;
}

export function ExportCompletionDialog({
  open,
  onOpenChange,
  summary,
  onDownload,
  onCloudUpload
}: ExportCompletionDialogProps) {
  const hasErrors = summary.errors.length > 0;
  const hasSkipped = summary.skipped.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {hasErrors ? (
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
            ) : (
              <CheckCircle className="h-6 w-6 text-green-500" />
            )}
            Export Completed
          </DialogTitle>
          <DialogDescription>
            Your database export has finished. Review the summary below.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1 p-3 border rounded-lg bg-muted/50">
              <span className="text-xs text-muted-foreground uppercase font-bold">Total Tables</span>
              <span className="text-2xl font-bold">{summary.totalTables}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 border rounded-lg bg-muted/50">
              <span className="text-xs text-muted-foreground uppercase font-bold">Total Rows</span>
              <span className="text-2xl font-bold">{summary.totalRows.toLocaleString()}</span>
            </div>
            <div className="flex flex-col gap-1 p-3 border rounded-lg bg-muted/50">
              <span className="text-xs text-muted-foreground uppercase font-bold">Duration</span>
              <span className="text-xl font-mono">{summary.duration}</span>
            </div>
             <div className="flex flex-col gap-1 p-3 border rounded-lg bg-muted/50">
              <span className="text-xs text-muted-foreground uppercase font-bold">Status</span>
              <div className="flex items-center gap-2">
                 {hasErrors ? <Badge variant="destructive">Errors</Badge> : <Badge className="bg-green-600">Success</Badge>}
                 {hasSkipped && <Badge variant="secondary">Skipped Items</Badge>}
              </div>
            </div>
          </div>

          {(hasErrors || hasSkipped) && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Issues & Warnings</h4>
              <ScrollArea className="h-[150px] w-full rounded-md border p-4 bg-muted/20">
                <div className="space-y-2">
                    {summary.errors.map((err, i) => (
                        <div key={`err-${i}`} className="flex items-start gap-2 text-sm text-red-600">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>{err}</span>
                        </div>
                    ))}
                    {summary.skipped.map((skip, i) => (
                        <div key={`skip-${i}`} className="flex items-start gap-2 text-sm text-yellow-600">
                            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                            <span>Skipped {skip.name}: {skip.reason}</span>
                        </div>
                    ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
          <div className="flex gap-2">
             {onCloudUpload && (
                <Button variant="secondary" onClick={onCloudUpload}>
                    <CloudUpload className="mr-2 h-4 w-4" />
                    Save to Cloud
                </Button>
             )}
             <Button onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download ZIP
             </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

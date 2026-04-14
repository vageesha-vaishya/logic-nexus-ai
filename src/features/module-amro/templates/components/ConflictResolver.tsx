/**
 * Conflict Resolver Component
 * 
 * Features:
 * - Displays differences between local and server versions
 * - Allows user to choose which version to keep
 * - Side-by-side comparison view
 * - Merge capability (future enhancement)
 * - Full accessibility support
 */

import { useState, useCallback } from 'react';
import { AlertTriangle, ArrowLeftRight, Check, Eye, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FieldDifference {
  field: string;
  label: string;
  localValue: any;
  serverValue: any;
}

interface ConflictResolverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateName: string;
  differences: FieldDifference[];
  onKeepLocal: () => void;
  onUseServer: () => void;
  onReload: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ConflictResolver({
  open,
  onOpenChange,
  templateName,
  differences,
  onKeepLocal,
  onUseServer,
  onReload,
}: ConflictResolverProps) {
  const [viewMode, setViewMode] = useState<'diff' | 'local' | 'server'>('diff');

  // Handle keep local
  const handleKeepLocal = useCallback(() => {
    onKeepLocal();
    onOpenChange(false);
  }, [onKeepLocal, onOpenChange]);

  // Handle use server
  const handleUseServer = useCallback(() => {
    onUseServer();
    onOpenChange(false);
  }, [onUseServer, onOpenChange]);

  // Render value
  const renderValue = (value: any) => {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    return String(value);
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Edit Conflict Detected
          </DialogTitle>
          <DialogDescription>
            The template "{templateName}" was modified by another user while you were editing.
            Please choose which version to keep.
          </DialogDescription>
        </DialogHeader>

        {/* View mode tabs */}
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="diff">
              <ArrowLeftRight className="w-4 h-4 mr-2" />
              Differences
            </TabsTrigger>
            <TabsTrigger value="local">
              <Eye className="w-4 h-4 mr-2" />
              Your Version
            </TabsTrigger>
            <TabsTrigger value="server">
              <Eye className="w-4 h-4 mr-2" />
              Server Version
            </TabsTrigger>
          </TabsList>

          {/* Differences view */}
          <TabsContent value="diff" className="mt-4">
            <ScrollArea className="h-[300px]">
              <div className="space-y-3">
                {differences.map((diff, index) => (
                  <Card key={index} className="border-amber-200 bg-amber-50/50">
                    <CardHeader className="py-3">
                      <CardTitle className="text-sm font-medium">
                        {diff.label}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="py-2">
                      <div className="grid grid-cols-2 gap-4">
                        {/* Local value */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Your Changes
                            </Badge>
                          </div>
                          <div className="bg-green-50 border border-green-200 rounded-md p-3 font-mono text-sm break-all">
                            {renderValue(diff.localValue)}
                          </div>
                        </div>

                        {/* Server value */}
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              Server Version
                            </Badge>
                          </div>
                          <div className="bg-red-50 border border-red-200 rounded-md p-3 font-mono text-sm break-all">
                            {renderValue(diff.serverValue)}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Local version view */}
          <TabsContent value="local" className="mt-4">
            <ScrollArea className="h-[300px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Your Version</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
                    {JSON.stringify(
                      differences.reduce((acc, diff) => ({
                        ...acc,
                        [diff.field]: diff.localValue,
                      }), {}),
                      null,
                      2
                    )}
                  </pre>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>

          {/* Server version view */}
          <TabsContent value="server" className="mt-4">
            <ScrollArea className="h-[300px]">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Server Version</CardTitle>
                </CardHeader>
                <CardContent>
                  <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
                    {JSON.stringify(
                      differences.reduce((acc, diff) => ({
                        ...acc,
                        [diff.field]: diff.serverValue,
                      }), {}),
                      null,
                      2
                    )}
                  </pre>
                </CardContent>
              </Card>
            </ScrollArea>
          </TabsContent>
        </Tabs>

        {/* Warning */}
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 p-3 rounded-md">
          <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Warning</p>
            <p className="text-amber-600">
              Choosing to keep your changes will overwrite the server version.
              This action cannot be undone.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          {/* Reload button */}
          <Button
            variant="outline"
            onClick={onReload}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Discard My Changes & Reload
          </Button>

          <div className="flex-1" />

          {/* Use server version */}
          <Button
            variant="outline"
            onClick={handleUseServer}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            Use Server Version
          </Button>

          {/* Keep local version */}
          <Button
            onClick={handleKeepLocal}
            className="gap-2"
          >
            <Check className="w-4 h-4" />
            Keep My Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

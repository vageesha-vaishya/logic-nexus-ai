/**
 * Bulk Operations Dialog Component
 * 
 * Features:
 * - Progress tracking for bulk operations
 * - Success/failure count display
 * - Error details for failed operations
 * - Retry failed operations
 * - Keyboard accessible
 * - Full accessibility support
 */

import { useCallback, useEffect } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  X,
  XCircle,
} from 'lucide-react';
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
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTemplateGridStore, BulkOperation } from '../store/useTemplateGridStore';

// ── Types ──────────────────────────────────────────────────────────────────────

interface BulkOperationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  operation: BulkOperation | null;
  errors: Array<{ id: string; error: string }>;
  onRetry: () => void;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BulkOperationsDialog({
  open,
  onOpenChange,
  operation,
  errors,
  onRetry,
  onClose,
}: BulkOperationsDialogProps) {
  const { setBulkOperation } = useTemplateGridStore();

  // Close dialog when operation completes (after delay)
  useEffect(() => {
    if (operation?.status === 'completed' || operation?.status === 'failed') {
      const timeoutId = setTimeout(() => {
        // Auto-close after 5 seconds if completed successfully
        if (operation.status === 'completed') {
          handleClose();
        }
      }, 5000);

      return () => clearTimeout(timeoutId);
    }
  }, [operation?.status]);

  // Handle close
  const handleClose = useCallback(() => {
    setBulkOperation(null);
    onClose();
  }, [setBulkOperation, onClose]);

  // Handle retry
  const handleRetry = useCallback(() => {
    onRetry();
  }, [onRetry]);

  // Get operation label
  const getOperationLabel = () => {
    switch (operation?.type) {
      case 'delete':
        return 'Delete Templates';
      case 'status-change':
        return 'Update Template Status';
      case 'export':
        return 'Export Templates';
      default:
        return 'Bulk Operation';
    }
  };

  // Get status icon
  const getStatusIcon = () => {
    switch (operation?.status) {
      case 'pending':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'in-progress':
        return <Loader2 className="w-5 h-5 animate-spin text-primary" />;
      case 'completed':
        return <CheckCircle2 className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-destructive" />;
      default:
        return null;
    }
  };

  // Calculate progress percentage
  const progressPercentage = operation
    ? Math.round((operation.progress / operation.total) * 100)
    : 0;

  if (!operation) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {getStatusIcon()}
            {getOperationLabel()}
          </DialogTitle>
          <DialogDescription>
            Processing {operation.total} templates...
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium">
                {operation.progress} of {operation.total}
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              {progressPercentage}% complete
            </p>
          </div>

          {/* Status summary */}
          {(operation.status === 'completed' || operation.status === 'failed') && (
            <div className="space-y-3">
              {/* Success count */}
              {operation.progress > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>
                    {operation.progress - (operation.failed || 0)} successful
                  </span>
                </div>
              )}

              {/* Failed count */}
              {errors.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <XCircle className="w-4 h-4 text-destructive" />
                  <span>{errors.length} failed</span>
                </div>
              )}
            </div>
          )}

          {/* Error details */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Errors:</p>
              <ScrollArea className="h-[150px] rounded-md border p-3">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm"
                    >
                      <AlertCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium">{error.id}</p>
                        <p className="text-muted-foreground">{error.error}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}

          {/* Operation error */}
          {operation.error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="w-4 h-4" />
              <span>{operation.error}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          {/* Retry button (only for failed operations) */}
          {operation.status === 'failed' && errors.length > 0 && (
            <Button
              variant="outline"
              onClick={handleRetry}
              className="gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Retry Failed ({errors.length})
            </Button>
          )}

          {/* Close button */}
          <Button
            variant={operation.status === 'completed' ? 'default' : 'outline'}
            onClick={handleClose}
            className="gap-2"
          >
            <X className="w-4 h-4" />
            {operation.status === 'completed' ? 'Done' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

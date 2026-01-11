import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { TransferService, EntityTransfer, TransferEntityType } from '@/lib/transfer-service';
import { useCRM } from '@/hooks/useCRM';
import { ScopedDataAccess } from '@/lib/db/access';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface TransferDetailDialogProps {
  transferId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onActionComplete: () => void;
}

export function TransferDetailDialog({
  transferId,
  open,
  onOpenChange,
  onActionComplete,
}: TransferDetailDialogProps) {
  const [transfer, setTransfer] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      if (!transferId) return;
      setLoading(true);
      try {
        const data = await TransferService.getTransfer(transferId);
        setTransfer(data);
      } catch (error: any) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };

    if (open && transferId) {
      load();
      setShowRejectForm(false);
      setRejectReason('');
    }
  }, [open, transferId]);

  const handleApprove = async () => {
    if (!transferId) return;
    setActionLoading(true);
    try {
      const result = await TransferService.approveTransfer(transferId);
      if (result.success) {
        toast({
          title: 'Transfer Completed',
          description: `Successfully processed ${result.succeeded} of ${result.processed} items.`,
        });
        onOpenChange(false);
        onActionComplete();
      } else {
        toast({ title: 'Transfer Failed', description: result.message, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!transferId || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await TransferService.rejectTransfer(dao, transferId, rejectReason);
      toast({ title: 'Transfer Rejected' });
      onOpenChange(false);
      onActionComplete();
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending': return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'completed': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'failed': return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: any = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-400',
      approved: 'bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-400',
      completed: 'bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-400',
      rejected: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-400',
      failed: 'bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-400',
    };
    return (
      <Badge variant="secondary" className={variants[status] || ''}>
        {status}
      </Badge>
    );
  };

  const entityTypeLabels: Record<TransferEntityType, string> = {
    lead: 'Lead',
    opportunity: 'Opportunity',
    quote: 'Quote',
    shipment: 'Shipment',
    account: 'Account',
    contact: 'Contact',
    activity: 'Activity',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transfer Details</DialogTitle>
          <DialogDescription>
            Review transfer request and take action
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : transfer ? (
          <div className="flex-1 overflow-y-auto space-y-6">
            {/* Transfer Summary */}
            <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">From</p>
                <p className="font-medium">{transfer.source_tenant?.name}</p>
                {transfer.source_franchise?.name && (
                  <p className="text-sm text-muted-foreground">{transfer.source_franchise.name}</p>
                )}
              </div>
              <ArrowRight className="h-6 w-6 text-muted-foreground" />
              <div className="flex-1 text-center">
                <p className="text-xs text-muted-foreground">To</p>
                <p className="font-medium">{transfer.target_tenant?.name}</p>
                {transfer.target_franchise?.name && (
                  <p className="text-sm text-muted-foreground">{transfer.target_franchise.name}</p>
                )}
              </div>
            </div>

            {/* Status & Meta */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusIcon(transfer.status)}
                  {getStatusBadge(transfer.status)}
                </div>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Transfer Type</p>
                <p className="font-medium capitalize mt-1">
                  {transfer.transfer_type.replace(/_/g, ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Requested By</p>
                <p className="font-medium mt-1">{transfer.requester?.email || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Created</p>
                <p className="font-medium mt-1">
                  {new Date(transfer.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Rejection Reason */}
            {transfer.rejection_reason && (
              <div className="p-4 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-900">
                <p className="text-sm font-medium text-red-800 dark:text-red-400">Rejection Reason</p>
                <p className="text-sm text-red-600 dark:text-red-300 mt-1">{transfer.rejection_reason}</p>
              </div>
            )}

            {/* Transfer Items */}
            <div>
              <h4 className="font-medium mb-3">Transfer Items ({transfer.items?.length || 0})</h4>
              <ScrollArea className="h-[200px] rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Entity ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transfer.items?.map((item: any) => (
                      <TableRow key={item.id}>
                        <TableCell className="capitalize">
                          {entityTypeLabels[item.entity_type as TransferEntityType] || item.entity_type}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {item.entity_id.slice(0, 12)}...
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            <span className="capitalize">{item.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-red-600 text-sm">
                          {item.error_message || '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>

            {/* Rejection Form */}
            {showRejectForm && (
              <div className="space-y-3 p-4 border rounded-lg">
                <Label>Rejection Reason</Label>
                <Textarea
                  placeholder="Provide a reason for rejecting this transfer..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                />
                <div className="flex gap-2">
                  <Button
                    variant="destructive"
                    onClick={handleReject}
                    disabled={!rejectReason.trim() || actionLoading}
                  >
                    {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    Confirm Rejection
                  </Button>
                  <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {transfer.status === 'pending' && !showRejectForm && (
              <div className="flex gap-3 pt-4 border-t">
                <Button
                  className="flex-1"
                  onClick={handleApprove}
                  disabled={actionLoading}
                >
                  {actionLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Approve & Execute
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setShowRejectForm(true)}
                  disabled={actionLoading}
                >
                  <XCircle className="h-4 w-4 mr-2" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            Transfer not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

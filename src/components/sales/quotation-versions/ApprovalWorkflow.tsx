import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/use-toast';

interface ApprovalWorkflowProps {
  versionId: string;
  currentStatus: string;
  onStatusChange: () => void;
}

export function ApprovalWorkflow({ versionId, currentStatus, onStatusChange }: ApprovalWorkflowProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'send' | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAction = async () => {
    if (!actionType) return;

    setLoading(true);
    try {
      let newStatus: string;
      switch (actionType) {
        case 'approve':
          newStatus = 'approved';
          break;
        case 'reject':
          newStatus = 'rejected';
          break;
        case 'send':
          newStatus = 'sent';
          break;
        default:
          return;
      }

      const { error } = await supabase
        .from('quotation_versions')
        .update({ status: newStatus })
        .eq('id', versionId);

      if (error) throw error;

      toast({
        title: 'Status updated',
        description: `Version ${actionType}d successfully`,
      });

      onStatusChange();
      setShowDialog(false);
      setNotes('');
      setActionType(null);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update version status',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (type: 'approve' | 'reject' | 'send') => {
    setActionType(type);
    setShowDialog(true);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { variant: 'secondary' as const, icon: Clock, label: 'Draft' },
      internal_review: { variant: 'outline' as const, icon: Clock, label: 'In Review' },
      approved: { variant: 'default' as const, icon: CheckCircle, label: 'Approved' },
      sent: { variant: 'default' as const, icon: Send, label: 'Sent' },
      rejected: { variant: 'destructive' as const, icon: XCircle, label: 'Rejected' },
      accepted: { variant: 'default' as const, icon: CheckCircle, label: 'Accepted' },
      expired: { variant: 'secondary' as const, icon: Clock, label: 'Expired' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="w-3 h-3" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Status:</span>
        {getStatusBadge(currentStatus)}
      </div>

      <div className="flex items-center gap-2">
        {currentStatus === 'draft' && (
          <>
            <Button size="sm" variant="outline" onClick={() => openDialog('approve')}>
              <CheckCircle className="w-4 h-4 mr-1" />
              Approve
            </Button>
            <Button size="sm" variant="outline" onClick={() => openDialog('reject')}>
              <XCircle className="w-4 h-4 mr-1" />
              Reject
            </Button>
          </>
        )}
        {(currentStatus === 'approved' || currentStatus === 'internal_review') && (
          <Button size="sm" onClick={() => openDialog('send')}>
            <Send className="w-4 h-4 mr-1" />
            Send to Customer
          </Button>
        )}
      </div>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' && 'Approve Version'}
              {actionType === 'reject' && 'Reject Version'}
              {actionType === 'send' && 'Send to Customer'}
            </DialogTitle>
            <DialogDescription>
              {actionType === 'approve' && 'This will mark the version as approved and ready to send.'}
              {actionType === 'reject' && 'This will mark the version as rejected and prevent it from being sent.'}
              {actionType === 'send' && 'This will send the approved version to the customer.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about this action..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={loading}>
              Cancel
            </Button>
            <Button onClick={handleAction} disabled={loading}>
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

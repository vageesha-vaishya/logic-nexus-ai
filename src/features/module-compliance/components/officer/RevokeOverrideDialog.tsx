import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useRevokeOverride } from '../../hooks/useComplianceOfficer';

interface RevokeOverrideDialogProps {
  screeningId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function RevokeOverrideDialog({ screeningId, open, onOpenChange, onCompleted }: RevokeOverrideDialogProps) {
  const [reason, setReason] = useState('');
  const revoke = useRevokeOverride();

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) return;
    await revoke.mutateAsync({ screening_id: screeningId, reason: trimmed });
    setReason('');
    onOpenChange(false);
    onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Revoke override</DialogTitle>
          <DialogDescription>
            Flip this screening from <strong>overridden</strong> back to its prior blocked status. The
            downstream gate will re-block. The revocation is itself recorded as an audit decision.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="revoke-reason">Reason (required, min 10 chars)</Label>
            <Textarea
              id="revoke-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. New OFAC update confirms party is sanctioned; original override was based on stale data."
              rows={4}
              minLength={10}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={revoke.isPending}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={revoke.isPending || reason.trim().length < 10}>
            {revoke.isPending ? 'Revoking…' : 'Revoke override'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

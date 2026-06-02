import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { useOverrideScreening } from '../../hooks/useComplianceOfficer';

interface OverrideDialogProps {
  screeningId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
}

export function OverrideDialog({ screeningId, open, onOpenChange, onCompleted }: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [evidenceCsv, setEvidenceCsv] = useState('');
  const override = useOverrideScreening();

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) return;
    const fileIds = evidenceCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    await override.mutateAsync({
      screening_id: screeningId,
      reason: trimmed,
      evidence_file_ids: fileIds.length ? fileIds : undefined,
    });
    setReason('');
    setEvidenceCsv('');
    onOpenChange(false);
    onCompleted?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Override screening</DialogTitle>
          <DialogDescription>
            Flip this screening from a blocked state into <strong>overridden</strong>. The downstream gate
            (quote-send / shipment-create / etc.) will unblock. A row is written to <code>compliance.audit_decisions</code>{' '}
            and <code>core.audit_log</code>; this action is non-destructive and can be revoked later.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="override-reason">Reason (required, min 10 chars)</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. False positive — confirmed via direct contact with US OFAC desk."
              rows={4}
              minLength={10}
            />
          </div>
          <div>
            <Label htmlFor="evidence">Evidence file IDs (optional, comma-separated UUIDs from core.files)</Label>
            <Input
              id="evidence"
              value={evidenceCsv}
              onChange={(e) => setEvidenceCsv(e.target.value)}
              placeholder="00000000-0000-..., 11111111-1111-..."
            />
            <p className="text-xs text-muted-foreground mt-1">
              Linked files auto-bump to 7-year retention. Files cannot be deleted until then.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={override.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={override.isPending || reason.trim().length < 10}>
            {override.isPending ? 'Overriding…' : 'Override screening'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

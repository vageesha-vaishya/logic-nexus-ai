import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import {
  useAttestOverride,
  useOverrideScreening,
  useScreeningDecisions,
} from '../../hooks/useComplianceOfficer';

interface OverrideDialogProps {
  screeningId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCompleted?: () => void;
  /**
   * When true, the dialog uses compliance.attest_override (two-officer flow).
   * When false/undefined, it uses the single-officer compliance.override_screening
   * fast path (current default behavior; backward compatible).
   */
  requiresCoSign?: boolean;
}

export function OverrideDialog({
  screeningId,
  open,
  onOpenChange,
  onCompleted,
  requiresCoSign,
}: OverrideDialogProps) {
  const [reason, setReason] = useState('');
  const [evidenceCsv, setEvidenceCsv] = useState('');
  const { user } = useAuth();
  const override = useOverrideScreening();
  const attest = useAttestOverride();
  const decisionsQuery = useScreeningDecisions(requiresCoSign ? screeningId : undefined);

  // Detect an open request for the two-officer flow. The
  // attest_override RPC ignores anything but override_requested rows;
  // mirror that here so the UI stays consistent with server truth.
  const pendingRequest = useMemo(() => {
    if (!requiresCoSign) return null;
    const rows = decisionsQuery.data ?? [];
    return rows.find((r) => r.override_decision === 'override_requested') ?? null;
  }, [requiresCoSign, decisionsQuery.data]);

  const isSelfRequest = pendingRequest?.decided_by_user_id === user?.id;
  const mode: 'single' | 'request' | 'attest' = !requiresCoSign
    ? 'single'
    : pendingRequest && !isSelfRequest
    ? 'attest'
    : 'request';

  const submit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10) return;
    const fileIds = evidenceCsv
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    const payload = {
      screening_id: screeningId,
      reason: trimmed,
      evidence_file_ids: fileIds.length ? fileIds : undefined,
    };
    if (requiresCoSign) {
      await attest.mutateAsync(payload);
    } else {
      await override.mutateAsync(payload);
    }
    setReason('');
    setEvidenceCsv('');
    onOpenChange(false);
    onCompleted?.();
  };

  const isBusy = override.isPending || attest.isPending;

  const ctaLabel = isBusy
    ? mode === 'attest' ? 'Attesting…' : 'Submitting…'
    : mode === 'attest' ? 'Attest pending override'
    : mode === 'request' ? 'Request override'
    : 'Override screening';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === 'attest' ? 'Attest pending override' :
             mode === 'request' ? 'Request override (two-officer)' :
             'Override screening'}
          </DialogTitle>
          <DialogDescription>
            {mode === 'single' && (
              <>
                Flip this screening from a blocked state into <strong>overridden</strong>. The downstream gate
                (quote-send / shipment-create / etc.) will unblock. A row is written to <code>compliance.audit_decisions</code>{' '}
                and <code>core.audit_log</code>; this action is non-destructive and can be revoked later.
              </>
            )}
            {mode === 'request' && (
              <>
                This screening is marked <Badge variant="outline">requires_co_sign</Badge>. Submitting this form
                records an override <em>request</em>; the screening status stays blocked until a second officer
                attests. You will not be able to attest your own request.
              </>
            )}
            {mode === 'attest' && (
              <>
                A previous officer requested this override. As a different officer, your attestation flips the
                screening to <strong>overridden</strong> and unblocks the downstream gate. Dual audit trail written.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {mode === 'attest' && pendingRequest && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div><span className="font-semibold">Requested by:</span> {pendingRequest.decided_by_user_id}</div>
            <div><span className="font-semibold">Requested at:</span> {new Date(pendingRequest.decided_at).toLocaleString()}</div>
            <div><span className="font-semibold">Reason given:</span> {pendingRequest.reason}</div>
          </div>
        )}
        {mode === 'request' && isSelfRequest && (
          <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            You already requested this override. Waiting for a different officer to attest before the screening can flip.
          </div>
        )}
        <div className="space-y-3">
          <div>
            <Label htmlFor="override-reason">Reason (required, min 10 chars)</Label>
            <Textarea
              id="override-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={
                mode === 'attest'
                  ? 'e.g. Concur — verified independently via OFAC desk; no real match.'
                  : 'e.g. False positive — confirmed via direct contact with US OFAC desk.'
              }
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isBusy}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isBusy || reason.trim().length < 10 || (mode === 'request' && isSelfRequest)}
          >
            {ctaLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

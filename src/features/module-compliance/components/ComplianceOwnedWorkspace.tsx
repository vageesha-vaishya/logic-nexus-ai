import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { ComplianceStatusBadgeContract } from './ComplianceStatusBadgeContract';
import { useComplianceWorkspaceState } from '../hooks/useComplianceWorkspaceState';
import type { ComplianceCaseStatus } from '../workspace/complianceWorkspaceModel';

const decisionLabels: Record<ComplianceCaseStatus, string> = {
  queued: 'Queued',
  in_review: 'In Review',
  approved: 'Approved',
  rejected: 'Rejected',
  escalated: 'Escalated',
};

function alertVariant(state: 'normal' | 'expiring' | 'expired') {
  if (state === 'expired') return 'destructive';
  if (state === 'expiring') return 'outline';
  return 'secondary';
}

function timelineVariant(severity: 'low' | 'medium' | 'high' | 'critical') {
  if (severity === 'critical') return 'destructive';
  if (severity === 'high') return 'outline';
  return 'secondary';
}

export function ComplianceOwnedWorkspace() {
  const state = useComplianceWorkspaceState();

  return (
    <section className="space-y-4">
      <Card data-compliance-owned-surface="screening-cases">
        <CardHeader className="pb-2">
          <CardTitle>Screening Cases</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Case Queue</Label>
              <Select value={state.selectedCaseId} onValueChange={state.setSelectedCaseId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select case" />
                </SelectTrigger>
                <SelectContent>
                  {state.triageQueue.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.caseNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Role-based Triage</p>
              <p className="text-sm font-medium">{state.selectedCase?.assignedRole ?? 'user'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">SLA Prioritization</p>
              <p className="text-sm font-medium">{state.selectedCase?.slaMinutesRemaining ?? 0} minutes remaining</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={state.canManageCompliance ? 'secondary' : 'destructive'}>
              {state.canManageCompliance ? 'Compliance Workflow Authorized' : 'Workflow Unauthorized'}
            </Badge>
            <Badge variant="outline">Risk Score {state.selectedCase?.riskScore ?? 0}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card data-compliance-owned-surface="policy-decision-review">
        <CardHeader className="pb-2">
          <CardTitle>Policy Decision Review</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Policy Version</p>
              <p className="text-sm font-medium">{state.selectedCase?.policyVersion ?? 'N/A'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Escalation State</p>
              <p className="text-sm font-medium">{state.selectedCase?.escalationState ?? 'none'}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Current Case Status</p>
              <p className="text-sm font-medium">{decisionLabels[state.selectedCase?.status ?? 'queued']}</p>
            </div>
          </div>
          <div className="rounded-md border p-3" data-compliance-decision-trace="rule-trace">
            <p className="text-xs text-muted-foreground">Rule Trace</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(state.selectedCase?.ruleTrace ?? []).map((trace) => (
                <Badge key={trace} variant="outline">{trace}</Badge>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2" data-compliance-boundary="adjudication-owned">
            <div className="space-y-1">
              <Label>Decision Outcome</Label>
              <Select value={state.decisionStatus} onValueChange={(value) => state.setDecisionStatus(value as ComplianceCaseStatus)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(decisionLabels) as ComplianceCaseStatus[]).map((status) => (
                    <SelectItem key={status} value={status}>
                      {decisionLabels[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Adjudication Explanation</Label>
              <Textarea
                value={state.decisionExplanation}
                onChange={(event) => state.setDecisionExplanation(event.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={state.saveDecision} disabled={!state.canAdjudicateSelectedCase}>
              Save Decision
            </Button>
            <Badge variant={state.decisionWriteState === 'blocked' ? 'destructive' : 'outline'}>
              {state.decisionWriteState}
            </Badge>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-compliance-owned-surface="escalation-workbench">
          <CardHeader className="pb-2">
            <CardTitle>Escalation Workbench</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Escalation Summary</p>
              <p className="text-sm font-medium">{state.selectedCase?.decisionSummary ?? 'No summary'}</p>
            </div>
            <Button asChild size="sm" variant="outline">
              <Link to={`/dashboard/restricted-party-screening?case=${state.selectedCase?.caseNumber ?? ''}`}>
                Open Escalation Case
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card data-compliance-owned-surface="document-obligation-tracking">
          <CardHeader className="pb-2">
            <CardTitle>Document Obligation Tracking</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.documentObligations.map((obligation) => (
              <div key={obligation.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{obligation.documentName}</p>
                  <Badge variant={alertVariant(obligation.alertState)}>{obligation.alertState}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(obligation.expiryDate).toLocaleDateString()}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Button size="sm" variant="secondary" onClick={() => state.acknowledgeObligation(obligation.id)}>
                    Acknowledge Alert
                  </Button>
                  <Badge variant="outline">
                    {obligation.acknowledgedAt ? `Acknowledged by ${obligation.acknowledgedBy}` : 'Pending acknowledgment'}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-compliance-owned-surface="risk-timeline">
          <CardHeader className="pb-2">
            <CardTitle>Risk Timeline Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.riskTimeline.map((entry) => (
              <div key={entry.id} className="rounded-md border p-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{entry.event}</p>
                  <Badge variant={timelineVariant(entry.severity)}>{entry.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{new Date(entry.occurredAt).toLocaleString()}</p>
                <Button asChild size="sm" variant="link" className="px-0">
                  <Link to={entry.sourcePointer}>Trace Source Pointer</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-compliance-owned-surface="evidence-trail">
          <CardHeader className="pb-2">
            <CardTitle>Evidence Trail Panel</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.evidenceContractPreview.map((artifact) => (
              <div key={artifact.id} className="rounded-md border p-2" data-evidence-signed-reference={artifact.signedReference}>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{artifact.title}</p>
                  <Badge variant={artifact.isSigned ? 'secondary' : 'destructive'}>
                    {artifact.isSigned ? 'Signed Reference' : 'Invalid Reference'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{artifact.sourceSystem}</p>
                <Button asChild size="sm" variant="outline">
                  <Link to={artifact.signedReference}>Open Signed Reference</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-compliance-boundary="upstream-readonly-contracts">
        <CardHeader className="pb-2">
          <CardTitle>Upstream Read-only Compliance Contract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <ComplianceStatusBadgeContract
            status={state.selectedCase?.status === 'approved' ? 'clear' : state.selectedCase?.status === 'rejected' ? 'blocked' : 'warning'}
            summary={state.selectedCase?.decisionSummary ?? 'No decision summary available.'}
          />
        </CardContent>
      </Card>

      <Separator />
    </section>
  );
}

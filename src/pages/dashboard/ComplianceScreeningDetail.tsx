import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ShieldAlert, ShieldCheck, ShieldOff, Sparkles } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  useScreening,
  useScreeningDecisions,
  type ScreeningDecisionRow,
} from '@/features/module-compliance/hooks/useComplianceOfficer';
import { useExplainHits, type ExplainHitsOutput } from '@/features/module-compliance/hooks/useExplainHits';
import { OverrideDialog } from '@/features/module-compliance/components/officer/OverrideDialog';
import { RevokeOverrideDialog } from '@/features/module-compliance/components/officer/RevokeOverrideDialog';

interface ScreeningHit {
  list_id?: string;
  list_name?: string;
  matched_name?: string;
  similarity?: number;
  country?: string;
  source?: string;
  [k: string]: unknown;
}

function ExplainResultCard({ output }: { output: ExplainHitsOutput }) {
  const variant =
    output.verdict === 'true_positive' ? 'destructive'
    : output.verdict === 'false_positive' ? 'secondary'
    : 'outline';
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge variant={variant}>{output.verdict.replace('_', ' ')}</Badge>
        <span className="text-xs text-muted-foreground">
          confidence {(output.confidence * 100).toFixed(0)}%
        </span>
      </div>
      <p className="text-sm">{output.reasoning}</p>
    </div>
  );
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'failed':
      return <ShieldAlert className="h-4 w-4" />;
    case 'overridden':
      return <ShieldCheck className="h-4 w-4" />;
    case 'expired':
      return <ShieldOff className="h-4 w-4" />;
    default:
      return null;
  }
};

const statusVariant = (status: string) => {
  switch (status) {
    case 'failed':
      return 'destructive' as const;
    case 'overridden':
      return 'secondary' as const;
    case 'expired':
      return 'outline' as const;
    case 'cleared':
      return 'default' as const;
    default:
      return 'outline' as const;
  }
};

export default function ComplianceScreeningDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: screening, isLoading, isError, error } = useScreening(id);
  const { data: decisions = [] } = useScreeningDecisions(id);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [revokeOpen, setRevokeOpen] = useState(false);
  const explainHits = useExplainHits();

  if (isLoading) {
    return (
      <DashboardLayout>
        <p className="text-sm text-muted-foreground py-6 text-center">Loading screening…</p>
      </DashboardLayout>
    );
  }
  if (isError || !screening) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">
              {isError ? (error as Error).message : 'Screening not found.'}
            </p>
            <Button asChild variant="outline" className="mt-4">
              <Link to="/dashboard/compliance/officer">
                <ArrowLeft className="h-4 w-4 mr-1" /> Back to inbox
              </Link>
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  const hits: ScreeningHit[] = Array.isArray(screening.hits) ? (screening.hits as ScreeningHit[]) : [];
  const isFailed = screening.status === 'failed';
  const isOverridden = screening.status === 'overridden';

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/dashboard/compliance/officer">
                <ArrowLeft className="h-4 w-4 mr-1" /> Inbox
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-semibold">{screening.search_name}</h1>
              <p className="text-sm text-muted-foreground">
                {screening.subject_type} · {screening.id.slice(0, 8)}…
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(screening.status)} className="gap-1 text-sm">
              {statusIcon(screening.status)} {screening.status}
            </Badge>
            {isFailed && <Button onClick={() => setOverrideOpen(true)}>Override</Button>}
            {isOverridden && (
              <Button variant="destructive" onClick={() => setRevokeOpen(true)}>
                Revoke override
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Provider</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">{screening.provider ?? '—'}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Top match score</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">
              {screening.match_score != null ? `${(Number(screening.match_score) * 100).toFixed(1)}%` : '—'}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Triggered by</CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              <code className="text-xs">{screening.triggered_by_event ?? '—'}</code>
              <div className="text-xs text-muted-foreground mt-1">
                {format(new Date(screening.performed_at), "PPP 'at' p")}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Hits ({hits.length})</CardTitle>
              {hits.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    explainHits.mutate({
                      screening_id: screening.id,
                      party: {
                        name: screening.search_name,
                        country: screening.search_country ?? 'XX',
                      },
                      hits: hits as Array<Record<string, unknown>>,
                    })
                  }
                  disabled={explainHits.isPending}
                >
                  <Sparkles className="h-3.5 w-3.5 mr-1" />
                  {explainHits.isPending ? 'Explaining…' : 'Explain with AI'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {hits.length === 0 && <p className="text-sm text-muted-foreground">No hit details captured.</p>}
            {hits.length > 0 && (
              <ul className="divide-y">
                {hits.map((h, idx) => (
                  <li key={idx} className="py-2 grid grid-cols-12 gap-2 text-sm">
                    <div className="col-span-4 font-medium">{h.matched_name ?? '(unnamed)'}</div>
                    <div className="col-span-3 text-muted-foreground">{h.list_name ?? h.source ?? '—'}</div>
                    <div className="col-span-2">{h.country ?? '—'}</div>
                    <div className="col-span-3 text-right font-mono">
                      {h.similarity != null ? `${(Number(h.similarity) * 100).toFixed(1)}%` : '—'}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {explainHits.data && (
              <div className="mt-4 border-t pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-600" />
                    <span className="text-sm font-medium">AI assessment</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {explainHits.data.cost_usd > 0 && `$${explainHits.data.cost_usd.toFixed(4)} · `}
                    {explainHits.data.latency_ms}ms · inv {explainHits.data.invocation_id.slice(0, 8)}…
                  </div>
                </div>
                {explainHits.data.parsed_output ? (
                  <ExplainResultCard output={explainHits.data.parsed_output} />
                ) : (
                  <pre className="text-xs bg-muted/50 p-2 rounded overflow-x-auto">
                    {JSON.stringify(explainHits.data.output, null, 2)}
                  </pre>
                )}
                {(explainHits.data.warnings ?? []).length > 0 && (
                  <div className="text-xs text-muted-foreground">
                    Warnings: {(explainHits.data.warnings ?? []).join(', ')}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Decision history ({decisions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {decisions.length === 0 && (
              <p className="text-sm text-muted-foreground">No override or revoke decisions recorded yet.</p>
            )}
            {decisions.length > 0 && (
              <ul className="space-y-3">
                {decisions.map((d: ScreeningDecisionRow) => (
                  <li key={d.audit_decision_id} className="border-l-2 border-muted pl-3 py-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={d.override_decision === 'override' ? 'secondary' : 'destructive'}>
                          {d.override_decision}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {d.previous_status} → {d.new_status}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(d.decided_at), "PPP 'at' p")}
                      </span>
                    </div>
                    <p className="text-sm mt-1">{d.reason}</p>
                    <div className="text-xs text-muted-foreground mt-1">
                      by {d.decided_by_user_id.slice(0, 8)}…
                      {d.evidence_file_count ? ` · ${d.evidence_file_count} evidence file${d.evidence_file_count === 1 ? '' : 's'}` : ''}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {screening.decision_notes && (
          <Card>
            <CardHeader>
              <CardTitle>Decision notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{screening.decision_notes}</p>
            </CardContent>
          </Card>
        )}
      </div>

      <OverrideDialog
        screeningId={screening.id}
        open={overrideOpen}
        onOpenChange={setOverrideOpen}
        requiresCoSign={screening.requires_co_sign === true}
      />
      <RevokeOverrideDialog screeningId={screening.id} open={revokeOpen} onOpenChange={setRevokeOpen} />
    </DashboardLayout>
  );
}

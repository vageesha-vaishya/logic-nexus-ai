// AogAlertDetailPage — hosts the AogTriagePanel + workflow actions.
// Per design doc 2026-06-04 slice S5. Auto-fires triage on first
// visit when status='declared'. Triage output is rendered both from
// the live invocation AND from persisted last_triage_output (so
// reload shows the same plan without re-firing the LLM).

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Siren,
  Loader2,
  Wrench,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  useAogAlert,
  useTriageAogAlert,
  useConvertAogToWorkOrder,
  useResolveAogAlert,
  type AogPriority,
} from '../hooks/useAogAlerts';

const PRIORITY_VARIANT: Record<AogPriority, 'default' | 'destructive' | 'secondary' | 'outline'> = {
  P1_AOG_CRITICAL: 'destructive',
  P2_AOG_URGENT: 'destructive',
  P3_AOG_PLANNED: 'default',
  P4_DEFER_MEL: 'secondary',
};

interface TriageOutput {
  priority?: string;
  priority_rationale?: string;
  estimated_recovery_hours?: number;
  blocks_revenue_service?: boolean;
  recommended_actions?: Array<{
    action: string;
    owner_role: string;
    deadline_hours_from_now: number;
    blocking: boolean;
  }>;
  parts_to_preorder?: Array<{
    part_number: string;
    qty: number;
    rationale: string;
    available_at_airport: boolean;
  }>;
  escalation_chain?: string[];
  alternate_recovery_options?: string[];
  mel_recommendation?: {
    consider_mel: boolean;
    mel_category: string | null;
    rationale: string;
  };
  safety_flags?: string[];
  confidence?: number;
}

export default function AogAlertDetailPage() {
  const { id } = useParams<{ id: string }>();

  const alertQuery = useAogAlert(id);
  const triage = useTriageAogAlert();
  const convert = useConvertAogToWorkOrder();
  const resolve = useResolveAogAlert();

  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolutionSummary, setResolutionSummary] = useState('');
  const [autoTriageFired, setAutoTriageFired] = useState(false);

  const alert = alertQuery.data;

  // Auto-fire triage on first visit when status='declared' AND we have
  // an aircraft linked. Time-critical UX — operator should see the plan
  // by the time the page finishes rendering.
  useEffect(() => {
    if (!alert) return;
    if (autoTriageFired) return;
    if (alert.status === 'declared' && alert.aircraft_id && !alert.last_triage_output) {
      setAutoTriageFired(true);
      void triage.mutateAsync(alert.id).catch(() => undefined);
    }
  }, [alert, autoTriageFired, triage]);

  const triageOutput: TriageOutput | null =
    (alert?.last_triage_output as TriageOutput | null) ?? null;

  if (alertQuery.isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading AOG alert…
        </div>
      </DashboardLayout>
    );
  }
  if (!alert) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <p className="text-sm text-muted-foreground">AOG alert not found.</p>
          <Button variant="link" asChild>
            <Link to="/dashboard/amro/aog"><ArrowLeft className="mr-1 h-4 w-4" />Back to list</Link>
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const closed = alert.status === 'resolved' || alert.status === 'cancelled';

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 lg:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard/amro/aog"><ArrowLeft className="h-4 w-4" /></Link>
              </Button>
              <Siren className="h-6 w-6 text-rose-600" />
              <h1 className="text-2xl font-bold font-mono">{alert.alert_number}</h1>
              <Badge variant={closed ? 'secondary' : 'destructive'}>{alert.status}</Badge>
              {alert.priority && (
                <Badge variant={PRIORITY_VARIANT[alert.priority]}>
                  {alert.priority.replace('_', ' ')}
                </Badge>
              )}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {alert.aircraft_registration || 'No aircraft linked'} at{' '}
              <span className="font-mono">{alert.airport_iata}</span>
              {' · '}
              reported {new Date(alert.reported_at).toLocaleString()}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!closed && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void triage.mutateAsync(alert.id)}
                disabled={triage.isPending || !alert.aircraft_id}
              >
                {triage.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {triageOutput ? 'Re-triage' : 'Run AI triage'}
              </Button>
            )}
            {!closed && !alert.work_order_id && (
              <Button
                size="sm"
                onClick={() => void convert.mutateAsync(alert.id)}
                disabled={convert.isPending}
              >
                <Wrench className="mr-2 h-4 w-4" />
                Convert to work order
              </Button>
            )}
            {!closed && (
              <Button
                size="sm"
                variant="default"
                onClick={() => setResolveDialogOpen(true)}
              >
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Resolve
              </Button>
            )}
            {alert.work_order_id && (
              <Button size="sm" variant="link" asChild>
                <Link to={`/dashboard/amro/work-orders/${alert.work_order_id}`}>
                  View work order
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Defect card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Defect</CardTitle>
            <CardDescription>
              Reporter: {alert.reporter_role || '—'}
              {alert.severity_signal && (
                <> · Severity: <span className="italic">{alert.severity_signal}</span></>
              )}
              {alert.ata_chapter_code && <> · ATA {alert.ata_chapter_code}</>}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-line text-sm">{alert.defect_summary}</p>
            {alert.related_warnings.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {alert.related_warnings.map((w) => (
                  <Badge key={w} variant="outline" className="font-mono text-xs">{w}</Badge>
                ))}
              </div>
            )}
            {alert.mel_eligible === true && (
              <Badge variant="secondary" className="mt-3">MEL-eligible</Badge>
            )}
          </CardContent>
        </Card>

        {/* Aircraft card */}
        {alert.aircraft && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Aircraft</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Registration</div>
                  <div className="font-mono">{alert.aircraft.registration ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Manufacturer</div>
                  <div>{alert.aircraft.manufacturer ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Model</div>
                  <div>{alert.aircraft.model ?? '—'}</div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Serial</div>
                  <div className="font-mono">{alert.aircraft.serial_number ?? '—'}</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI triage card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-primary" />
              AI triage plan
            </CardTitle>
            {alert.last_triage_at && (
              <CardDescription>
                Last triaged {new Date(alert.last_triage_at).toLocaleString()}
                {triageOutput?.confidence != null && (
                  <> · {Math.round(triageOutput.confidence * 100)}% confidence</>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            {!alert.aircraft_id ? (
              <p className="text-sm italic text-muted-foreground">
                Link an aircraft to enable AI triage.
              </p>
            ) : triage.isPending && !triageOutput ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating triage plan…
              </div>
            ) : !triageOutput ? (
              <Button onClick={() => void triage.mutateAsync(alert.id)} size="sm">
                <Sparkles className="mr-2 h-4 w-4" />
                Run AI triage
              </Button>
            ) : (
              <div className="space-y-4">
                {triageOutput.priority_rationale && (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-medium">Why this priority: </span>
                    {triageOutput.priority_rationale}
                  </p>
                )}
                {typeof triageOutput.estimated_recovery_hours === 'number' && (
                  <p className="text-sm">
                    <span className="font-medium">Estimated recovery: </span>
                    {triageOutput.estimated_recovery_hours.toFixed(1)} hours
                    {triageOutput.blocks_revenue_service && (
                      <Badge variant="destructive" className="ml-2 text-xs">
                        Blocks revenue
                      </Badge>
                    )}
                  </p>
                )}

                {Array.isArray(triageOutput.recommended_actions) && triageOutput.recommended_actions.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Recommended actions ({triageOutput.recommended_actions.length})
                    </div>
                    <ol className="space-y-2 text-sm">
                      {triageOutput.recommended_actions.map((a, i) => (
                        <li key={`act-${i}`} className="flex items-start gap-2">
                          <Badge variant="outline" className="mt-0.5 shrink-0">{i + 1}</Badge>
                          <div>
                            <div>{a.action}</div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {a.owner_role} · within {a.deadline_hours_from_now}h
                              {a.blocking && <Badge variant="destructive" className="ml-2 text-xs">Blocking</Badge>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}

                {Array.isArray(triageOutput.parts_to_preorder) && triageOutput.parts_to_preorder.length > 0 && (
                  <div>
                    <Separator className="mb-2" />
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Parts to preorder
                    </div>
                    <ul className="space-y-1 text-xs">
                      {triageOutput.parts_to_preorder.map((p, i) => (
                        <li key={`part-${i}-${p.part_number}`}>
                          <span className="font-mono">{p.part_number}</span>
                          {' × '}{p.qty}
                          {p.available_at_airport && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              In stock at airport
                            </Badge>
                          )}
                          <span className="ml-2 text-muted-foreground">— {p.rationale}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(triageOutput.escalation_chain) && triageOutput.escalation_chain.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Escalation chain
                    </div>
                    <ol className="ml-5 list-decimal space-y-0.5 text-xs">
                      {triageOutput.escalation_chain.map((e, i) => (
                        <li key={`esc-${i}`}>{e}</li>
                      ))}
                    </ol>
                  </div>
                )}

                {Array.isArray(triageOutput.alternate_recovery_options) && triageOutput.alternate_recovery_options.length > 0 && (
                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                      Alternate recovery
                    </div>
                    <ul className="ml-5 list-disc space-y-0.5 text-xs">
                      {triageOutput.alternate_recovery_options.map((a, i) => (
                        <li key={`alt-${i}`}>{a}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {triageOutput.mel_recommendation?.consider_mel && (
                  <div className="rounded-md border bg-muted/30 p-3">
                    <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                      MEL recommendation
                    </div>
                    <p className="text-xs">
                      {triageOutput.mel_recommendation.mel_category && (
                        <Badge variant="outline" className="mr-2 text-xs">
                          MEL {triageOutput.mel_recommendation.mel_category}
                        </Badge>
                      )}
                      {triageOutput.mel_recommendation.rationale}
                    </p>
                  </div>
                )}

                {Array.isArray(triageOutput.safety_flags) && triageOutput.safety_flags.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                    <div className="mb-1 text-xs font-semibold uppercase text-amber-900 dark:text-amber-200">
                      Safety flags
                    </div>
                    <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                      {triageOutput.safety_flags.map((f, i) => (
                        <li key={`saf-${i}`}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Resolve dialog */}
        <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Resolve AOG alert</DialogTitle>
            </DialogHeader>
            <Textarea
              rows={4}
              placeholder="What was done? (e.g. 'Replaced left gear door actuator P/N 3-1234-0007. Functional test passed. Released for service.')"
              value={resolutionSummary}
              onChange={(e) => setResolutionSummary(e.target.value)}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setResolveDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  await resolve.mutateAsync({ id: alert.id, resolution_summary: resolutionSummary });
                  setResolveDialogOpen(false);
                  setResolutionSummary('');
                }}
                disabled={resolve.isPending}
              >
                Resolve
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resolution summary if closed */}
        {alert.resolution_summary && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Resolution</CardTitle>
              <CardDescription>
                Resolved {alert.resolved_at && new Date(alert.resolved_at).toLocaleString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-line text-sm">{alert.resolution_summary}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

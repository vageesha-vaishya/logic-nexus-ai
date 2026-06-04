// DirectiveApplicabilityQueuePage — human review queue for LLM-
// generated directive × aircraft applicability verdicts. Per
// docs/plans/2026-06-04-directive-applicability-surface-design.md
// slice S7.
//
// Ordered by confidence ASC (lowest-confidence first — most need
// human attention). Optional max-confidence ceiling slider.

import { useState } from 'react';
import {
  ShieldCheck,
  Loader2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Pause,
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
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  useApplicabilityQueue,
  useUpdateApplicabilityVerdict,
  type ApplicabilityVerdict,
} from '../hooks/useDirectiveApplicabilityVerdicts';

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

function VerdictCard({
  verdict,
  onAccept,
  onSnooze,
  onOpenOverride,
  busy,
}: {
  verdict: ApplicabilityVerdict;
  onAccept: () => void;
  onSnooze: () => void;
  onOpenOverride: () => void;
  busy: boolean;
}) {
  const directive = verdict.directive_snapshot_jsonb as {
    directive_no?: string;
    code_form_no?: string;
    description?: string;
    issuing_authority?: string;
    kind?: string;
  };
  const aircraft = verdict.aircraft_snapshot_jsonb as {
    registration?: string;
    manufacturer?: string;
    model?: string;
    serial_number?: string;
  };
  const directiveLabel = directive.directive_no
    || directive.code_form_no
    || verdict.directive_id.slice(0, 8);
  const aircraftLabel = aircraft.registration
    || aircraft.serial_number
    || verdict.aircraft_id.slice(0, 8);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {verdict.applies ? (
                <Badge variant="default" className="text-sm">
                  <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                  Applies
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-sm">
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Does not apply
                </Badge>
              )}
              <Badge variant={confidenceTone(verdict.confidence)}>
                {Math.round(verdict.confidence * 100)}% confidence
              </Badge>
              {directive.issuing_authority && (
                <Badge variant="outline" className="text-xs">{directive.issuing_authority}</Badge>
              )}
              {directive.kind && (
                <Badge variant="outline" className="text-xs">{directive.kind}</Badge>
              )}
            </div>
            <CardTitle className="text-base">
              <span className="font-mono">{directiveLabel}</span>
              {directive.description && (
                <> — <span className="font-normal text-muted-foreground">{directive.description}</span></>
              )}
            </CardTitle>
            <CardDescription>
              vs. {aircraft.manufacturer ?? '—'} {aircraft.model ?? ''} (
              <span className="font-mono">{aircraftLabel}</span>
              {aircraft.serial_number && <>, S/N {aircraft.serial_number}</>}
              )
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {verdict.reasoning && (
          <p className="text-sm text-muted-foreground">{verdict.reasoning}</p>
        )}

        {verdict.matched_criteria.length > 0 && (
          <div>
            <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Matched criteria
            </div>
            <ul className="ml-4 mt-0.5 list-disc text-xs text-muted-foreground">
              {verdict.matched_criteria.map((c, i) => (
                <li key={`m-${i}-${c}`}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {verdict.unmatched_criteria.length > 0 && (
          <div>
            <div className="text-xs font-medium text-rose-700 dark:text-rose-400">
              Unmatched / unclear
            </div>
            <ul className="ml-4 mt-0.5 list-disc text-xs text-muted-foreground">
              {verdict.unmatched_criteria.map((c, i) => (
                <li key={`u-${i}-${c}`}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        {verdict.ata_chapters_touched.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium">ATA chapters:</span>
            {verdict.ata_chapters_touched.map((ch) => (
              <Badge key={ch} variant="outline" className="text-xs">{ch}</Badge>
            ))}
          </div>
        )}

        {verdict.recommended_followup && (
          <div className="flex items-start gap-2 rounded border bg-background p-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
            <span>{verdict.recommended_followup}</span>
          </div>
        )}

        <Separator />

        <div className="flex flex-wrap gap-2">
          <Button size="sm" onClick={onAccept} disabled={busy}>
            <CheckCircle2 className="mr-1.5 h-4 w-4" />
            Accept verdict
          </Button>
          <Button size="sm" variant="outline" onClick={onOpenOverride} disabled={busy}>
            <AlertTriangle className="mr-1.5 h-4 w-4" />
            Override
          </Button>
          <Button size="sm" variant="ghost" onClick={onSnooze} disabled={busy}>
            <Pause className="mr-1.5 h-4 w-4" />
            Snooze
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DirectiveApplicabilityQueuePage() {
  const [maxConfidence, setMaxConfidence] = useState(0.85);
  const [filterEnabled, setFilterEnabled] = useState(true);
  const [overrideDialog, setOverrideDialog] = useState<{ id: string; applies: boolean } | null>(null);
  const [overrideReason, setOverrideReason] = useState('');
  const [flipApplies, setFlipApplies] = useState(false);

  const queueQuery = useApplicabilityQueue({
    max_confidence: filterEnabled ? maxConfidence : null,
    limit: 100,
  });
  const updateMutation = useUpdateApplicabilityVerdict();

  const verdicts = queueQuery.data?.records ?? [];

  const handleAccept = async (id: string) => {
    await updateMutation.mutateAsync({ id, action: 'accept' });
  };

  const handleSnooze = async (id: string) => {
    await updateMutation.mutateAsync({ id, action: 'snooze' });
  };

  const handleOverrideSubmit = async () => {
    if (!overrideDialog) return;
    const reason = overrideReason.trim();
    if (!reason) return;
    await updateMutation.mutateAsync({
      id: overrideDialog.id,
      action: 'override',
      human_override_reason: reason,
      ...(flipApplies ? { applies: !overrideDialog.applies } : {}),
    });
    setOverrideDialog(null);
    setOverrideReason('');
    setFlipApplies(false);
  };

  return (
    <DashboardLayout>
      <div className="space-y-4 p-4 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold">
              <ShieldCheck className="h-6 w-6 text-primary" />
              Directive Applicability Review
            </h1>
            <p className="text-sm text-muted-foreground">
              LLM verdicts on directive × aircraft applicability. Director of Maintenance signs off.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void queueQuery.refetch()}
            disabled={queueQuery.isFetching}
          >
            {queueQuery.isFetching ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
          </Button>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="conf-filter">Max confidence ceiling</Label>
                  <Switch
                    id="conf-filter"
                    checked={filterEnabled}
                    onCheckedChange={setFilterEnabled}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Slider
                    value={[maxConfidence]}
                    onValueChange={(v) => setMaxConfidence(v[0] ?? 0.85)}
                    min={0}
                    max={1}
                    step={0.05}
                    disabled={!filterEnabled}
                    className="flex-1"
                  />
                  <Badge variant="outline" className="font-mono">
                    ≤{Math.round(maxConfidence * 100)}%
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Show only verdicts the LLM was less sure about. Lowest-confidence first.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {queueQuery.isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading queue…
          </div>
        ) : verdicts.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing in the review queue. Lower the confidence ceiling to see more.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {verdicts.length} verdict{verdicts.length === 1 ? '' : 's'} awaiting review.
            </p>
            {verdicts.map((v) => (
              <VerdictCard
                key={v.id}
                verdict={v}
                busy={updateMutation.isPending}
                onAccept={() => void handleAccept(v.id)}
                onSnooze={() => void handleSnooze(v.id)}
                onOpenOverride={() => {
                  setOverrideDialog({ id: v.id, applies: v.applies });
                  setOverrideReason('');
                  setFlipApplies(false);
                }}
              />
            ))}
          </div>
        )}

        {/* Override dialog */}
        <Dialog
          open={!!overrideDialog}
          onOpenChange={(open) => {
            if (!open) {
              setOverrideDialog(null);
              setOverrideReason('');
              setFlipApplies(false);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Override applicability verdict</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs font-medium text-muted-foreground">LLM said</p>
                <p className="mt-1">
                  {overrideDialog?.applies ? '✓ Applies to this aircraft' : '✗ Does not apply'}
                </p>
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label htmlFor="flip">Flip the applies verdict</Label>
                  <p className="text-xs text-muted-foreground">
                    Tick if you disagree with the LLM's decision (in addition to overriding it).
                  </p>
                </div>
                <Switch id="flip" checked={flipApplies} onCheckedChange={setFlipApplies} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="reason">Reason for override *</Label>
                <Textarea
                  id="reason"
                  rows={4}
                  placeholder="Required for the regulator audit trail. Cite the source you're relying on (e.g. 'FAA AD reads exempt for serials &lt;500; this aircraft is S/N 412')."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOverrideDialog(null)}>Cancel</Button>
              <Button
                onClick={() => void handleOverrideSubmit()}
                disabled={!overrideReason.trim() || updateMutation.isPending}
              >
                Submit override
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

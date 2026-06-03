// AogTriagePanel — operator UI for the llm-aog-triage edge function.
// Renders the full structured triage plan: priority chip, recommended
// actions ordered by deadline, parts to pre-order, escalation chain,
// MEL recommendation, safety flags. Designed to drop into an AOG alert
// detail view next to existing inventory / resolution actions.

import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Clock,
  AlertOctagon,
  Package,
  Users,
  RotateCw,
  ShieldAlert,
  Flame,
  CalendarClock,
  ShieldCheck,
} from 'lucide-react';

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

import {
  useAogTriage,
  type AogTriageInput,
  type AogTriageOutput,
  type AogPriority,
} from '../../hooks/useAogTriage';

interface AogTriagePanelProps {
  input: AogTriageInput;
  /** Called when the operator dispatches the verdict downstream. */
  onDispatch?: (output: AogTriageOutput) => void;
}

const PRIORITY_META: Record<AogPriority, { label: string; tone: 'destructive' | 'default' | 'secondary'; icon: typeof Flame }> = {
  P1_AOG_CRITICAL: { label: 'P1 — Critical', tone: 'destructive', icon: Flame },
  P2_AOG_URGENT: { label: 'P2 — Urgent', tone: 'destructive', icon: AlertOctagon },
  P3_AOG_PLANNED: { label: 'P3 — Planned', tone: 'secondary', icon: CalendarClock },
  P4_DEFER_MEL: { label: 'P4 — Defer via MEL', tone: 'default', icon: ShieldCheck },
};

const OWNER_LABEL: Record<string, string> = {
  ops_controller: 'Ops Controller',
  maintenance_lead: 'Maintenance Lead',
  stores: 'Stores',
  procurement: 'Procurement',
  vendor_coordinator: 'Vendor Coordinator',
};

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.9) return 'default';
  if (c >= 0.7) return 'secondary';
  return 'destructive';
}

function deadlineLabel(h: number): string {
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 24) return `${h.toFixed(h % 1 ? 1 : 0)} h`;
  return `${(h / 24).toFixed(1)} d`;
}

export function AogTriagePanel({ input, onDispatch }: AogTriagePanelProps) {
  const { mutateAsync, data, isPending, reset } = useAogTriage();

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    await mutateAsync(input);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI AOG triage
        </CardTitle>
        <CardDescription>
          Alert <span className="font-medium">{input.alert.alert_id}</span> at{' '}
          <span className="font-medium">{input.alert.airport_iata}</span> ·{' '}
          <span className="font-medium">{input.aircraft.registration}</span> ({input.aircraft.model})
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Analyze with AI
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-4">
            {/* ── Priority + summary ─────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              {(() => {
                const meta = PRIORITY_META[parsed.priority];
                const Icon = meta.icon;
                return (
                  <Badge variant={meta.tone} className="gap-1 text-sm">
                    <Icon className="h-3.5 w-3.5" />
                    {meta.label}
                  </Badge>
                );
              })()}
              <Badge variant="outline">
                <Clock className="mr-1 h-3 w-3" />
                ~{parsed.estimated_recovery_hours.toFixed(1)} h to recovery
              </Badge>
              {parsed.blocks_revenue_service && (
                <Badge variant="destructive">Blocks revenue service</Badge>
              )}
              <Badge variant={confidenceTone(parsed.confidence)}>
                {Math.round(parsed.confidence * 100)}% confidence
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{parsed.priority_rationale}</p>

            {/* ── Safety flags ────────────────────────────────────────── */}
            {parsed.safety_flags.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="h-4 w-4" />
                  Safety flags
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                  {parsed.safety_flags.map((flag) => (
                    <li key={flag}>{flag}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* ── Recommended actions (ordered by deadline) ───────────── */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Clock className="h-4 w-4" />
                Recommended actions
              </div>
              <ol className="space-y-2">
                {parsed.recommended_actions.map((a, i) => (
                  <li
                    key={`${a.action}-${i}`}
                    className="flex items-start gap-3 rounded border bg-background p-2.5 text-sm"
                  >
                    <Badge variant={a.blocking ? 'destructive' : 'outline'} className="shrink-0">
                      {deadlineLabel(a.deadline_hours_from_now)}
                    </Badge>
                    <div className="flex-1">
                      <div>{a.action}</div>
                      <div className="text-xs text-muted-foreground">
                        Owner: {OWNER_LABEL[a.owner_role] ?? a.owner_role}
                        {a.blocking && ' · BLOCKING'}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* ── Parts to pre-order ──────────────────────────────────── */}
            {parsed.parts_to_preorder.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Package className="h-4 w-4" />
                  Parts to pre-order
                </div>
                <ul className="space-y-1.5">
                  {parsed.parts_to_preorder.map((p) => (
                    <li
                      key={p.part_number}
                      className="flex flex-wrap items-baseline gap-2 rounded border bg-background p-2 text-xs"
                    >
                      <span className="font-mono font-semibold">{p.part_number}</span>
                      <Badge variant="secondary">× {p.qty}</Badge>
                      {p.available_at_airport ? (
                        <Badge variant="default">at airport</Badge>
                      ) : (
                        <Badge variant="outline">remote — needs procurement</Badge>
                      )}
                      <span className="text-muted-foreground">{p.rationale}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── Escalation chain ────────────────────────────────────── */}
            {parsed.escalation_chain.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <Users className="h-4 w-4" />
                  Escalation chain
                </div>
                <ol className="ml-5 list-decimal text-xs text-muted-foreground">
                  {parsed.escalation_chain.map((role) => (
                    <li key={role}>{role}</li>
                  ))}
                </ol>
              </div>
            )}

            {/* ── Alternates ──────────────────────────────────────────── */}
            {parsed.alternate_recovery_options.length > 0 && (
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                  <RotateCw className="h-4 w-4" />
                  Alternate recovery options
                </div>
                <ul className="ml-5 list-disc text-xs text-muted-foreground">
                  {parsed.alternate_recovery_options.map((opt) => (
                    <li key={opt}>{opt}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* ── MEL recommendation ──────────────────────────────────── */}
            <div className="rounded-md border bg-muted/30 p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 font-medium">
                <ShieldCheck className="h-4 w-4" />
                MEL recommendation
                {parsed.mel_recommendation.consider_mel ? (
                  <Badge variant="default">Consider</Badge>
                ) : (
                  <Badge variant="outline">Not recommended</Badge>
                )}
                {parsed.mel_recommendation.mel_category && (
                  <Badge variant="secondary">Cat {parsed.mel_recommendation.mel_category}</Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{parsed.mel_recommendation.rationale}</p>
            </div>

            <Separator />

            <div className="flex gap-2">
              {onDispatch && (
                <Button size="sm" onClick={() => onDispatch(parsed)}>
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Dispatch this plan
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => reset()}>
                Re-run
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AogTriagePanel;

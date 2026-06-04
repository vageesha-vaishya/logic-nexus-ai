// ShipmentDelayPredictionPanel — operator UI for
// llm-shipment-delay-prediction. Drop-in card showing P(breach) gauge,
// risk vs positive factors, and quantified mitigation actions.

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Clock,
  Wand2,
  CheckCircle2,
  Phone,
  Route,
  Truck,
  FileText,
  Bell,
  Package,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import {
  useShipmentDelayPrediction,
  type DelayPredictionInput,
  type DelayPredictionOutput,
  type DelayPredictionBand,
  type RiskFactor,
  type FactorWeight,
  type MitigationActionType,
  type CostImpact,
} from '../hooks/useShipmentDelayPrediction';

interface ShipmentDelayPredictionPanelProps {
  input: DelayPredictionInput;
  /** Called when operator applies a specific mitigation back to the shipment. */
  onApplyMitigation?: (mitigation: DelayPredictionOutput['mitigation_options'][number]) => void;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

const BAND_META: Record<
  DelayPredictionBand,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; tone: string }
> = {
  very_low: { label: 'Very low', variant: 'default', tone: 'text-emerald-700' },
  low: { label: 'Low', variant: 'default', tone: 'text-emerald-600' },
  moderate: { label: 'Moderate', variant: 'secondary', tone: 'text-amber-600' },
  high: { label: 'High', variant: 'destructive', tone: 'text-rose-600' },
  very_high: { label: 'Very high', variant: 'destructive', tone: 'text-rose-700' },
};

const ACTION_META: Record<
  MitigationActionType,
  { label: string; icon: typeof Phone; variant: 'default' | 'secondary' | 'outline' }
> = {
  carrier_escalation: { label: 'Carrier escalation', icon: Phone, variant: 'secondary' },
  route_change: { label: 'Route change', icon: Route, variant: 'secondary' },
  expedite_customs: { label: 'Expedite customs', icon: FileText, variant: 'secondary' },
  alternate_carrier: { label: 'Alternate carrier', icon: Truck, variant: 'outline' },
  customer_notify_early: { label: 'Notify customer', icon: Bell, variant: 'outline' },
  buffer_inventory: { label: 'Buffer inventory', icon: Package, variant: 'outline' },
  no_action_recommended: { label: 'No action', icon: CheckCircle2, variant: 'default' },
};

const COST_IMPACT_VARIANT: Record<CostImpact, 'default' | 'secondary' | 'destructive'> = {
  low: 'default',
  medium: 'secondary',
  high: 'destructive',
};

const WEIGHT_VARIANT: Record<FactorWeight, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

function FactorList({ factors, kind }: { factors: RiskFactor[]; kind: 'risk' | 'positive' }) {
  const Icon = kind === 'risk' ? TrendingUp : TrendingDown;
  const tone = kind === 'risk'
    ? 'text-rose-700 dark:text-rose-400'
    : 'text-emerald-700 dark:text-emerald-400';

  if (factors.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground/70">
        No {kind === 'risk' ? 'risk factors' : 'positive signals'} identified.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-xs">
      {factors.map((f, i) => (
        <li key={`${kind}-${i}-${f.factor}`}>
          <div className="flex items-start gap-1.5">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant={WEIGHT_VARIANT[f.weight]} className="text-xs">
                  {f.weight}
                </Badge>
                <span className="font-medium">{f.factor}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{f.evidence}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function fmtHours(h: number): string {
  if (h === 0) return 'On time';
  if (h < 24) return `+${h.toFixed(0)}h`;
  const days = h / 24;
  return `+${days.toFixed(1)}d`;
}

export function ShipmentDelayPredictionPanel({ input, onApplyMitigation }: ShipmentDelayPredictionPanelProps) {
  const { mutateAsync, data, isPending, reset } = useShipmentDelayPrediction();
  const [applied, setApplied] = useState<Set<number>>(new Set());

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    setApplied(new Set());
    await mutateAsync(input);
  };

  const handleApply = (mitigation: DelayPredictionOutput['mitigation_options'][number], i: number) => {
    setApplied((prev) => new Set(prev).add(i));
    onApplyMitigation?.(mitigation);
  };

  const bandMeta = parsed ? BAND_META[parsed.p_breach_band] : null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI delay prediction
        </CardTitle>
        <CardDescription>
          Predict whether shipment{' '}
          <span className="font-mono text-xs">{input.shipment.shipment_id}</span>{' '}
          will breach the committed delivery of {input.shipment.committed_delivery_iso}.
          Status: <Badge variant="outline" className="ml-1 text-xs">{input.shipment.current_status}</Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Predicting…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Predict delay with AI
              </>
            )}
          </Button>
        )}

        {parsed && bandMeta && (
          <div className="space-y-4">
            {/* Breach probability gauge */}
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">P(breach delivery date)</div>
                  <div className={`text-3xl font-bold tabular-nums ${bandMeta.tone}`}>
                    {Math.round(parsed.p_breach * 100)}%
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <Badge variant={bandMeta.variant} className="text-sm">
                    {bandMeta.label}
                  </Badge>
                  <Badge variant={confidenceTone(parsed.confidence)} className="text-xs">
                    {Math.round(parsed.confidence * 100)}% confidence
                  </Badge>
                </div>
              </div>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-xs text-muted-foreground">Predicted slip</div>
                  <div className={`font-mono text-lg ${parsed.predicted_delay_hours > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {fmtHours(parsed.predicted_delay_hours)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-muted-foreground">Predicted delivery</div>
                  <div className="flex items-center gap-1.5 font-mono text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    {new Date(parsed.predicted_delivery_iso).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Factors: 2-col grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-rose-700 dark:text-rose-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Risk factors ({parsed.risk_factors.length})
                </div>
                <FactorList factors={parsed.risk_factors} kind="risk" />
              </div>
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Positive signals ({parsed.positive_signals.length})
                </div>
                <FactorList factors={parsed.positive_signals} kind="positive" />
              </div>
            </div>

            <Separator />

            {/* Mitigation options */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="h-4 w-4 text-primary" />
                Mitigation options ({parsed.mitigation_options.length})
              </div>
              {parsed.mitigation_options.length === 0 ? (
                <p className="text-xs italic text-muted-foreground/70">
                  No specific mitigations recommended.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Action</TableHead>
                        <TableHead>Specific step</TableHead>
                        <TableHead className="text-right">Δh</TableHead>
                        <TableHead>Cost</TableHead>
                        <TableHead>Deadline</TableHead>
                        <TableHead>Conf.</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.mitigation_options.map((m, i) => {
                        const meta = ACTION_META[m.action_type];
                        const Icon = meta.icon;
                        const isApplied = applied.has(i);
                        return (
                          <TableRow key={`mit-${i}-${m.action_type}`}>
                            <TableCell>
                              <Badge variant={meta.variant} className="text-xs">
                                <Icon className="mr-1 h-3 w-3" />
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{m.specific_action}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{m.rationale}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              <span className={m.expected_delay_reduction_hours > 0 ? 'text-emerald-600' : 'text-muted-foreground'}>
                                -{m.expected_delay_reduction_hours.toFixed(0)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={COST_IMPACT_VARIANT[m.cost_impact]} className="text-xs">
                                {m.cost_impact}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {m.deadline_to_act
                                ? new Date(m.deadline_to_act).toLocaleString(undefined, {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                  })
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <Badge variant={confidenceTone(m.confidence)} className="text-xs">
                                {Math.round(m.confidence * 100)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {onApplyMitigation && m.action_type !== 'no_action_recommended' && (
                                isApplied ? (
                                  <Badge variant="default" className="text-xs">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Applied
                                  </Badge>
                                ) : (
                                  <Button size="sm" variant="outline" onClick={() => handleApply(m, i)}>
                                    Apply
                                  </Button>
                                )
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="rounded-md border bg-background p-3 text-xs">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Input-quality warnings
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-muted-foreground">
                  {parsed.warnings.map((w, i) => (
                    <li key={`w-${i}-${w}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => { reset(); setApplied(new Set()); }}>
                Re-predict
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ShipmentDelayPredictionPanel;

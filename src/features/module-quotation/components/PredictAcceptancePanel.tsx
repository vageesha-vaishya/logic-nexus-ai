// PredictAcceptancePanel — operator UI for llm-predict-quote-acceptance.
// Drop-in card showing P(accept) gauge, drivers (positive vs negative),
// risk factors, and a quantified adjustments table the AM can apply.

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  ShieldAlert,
  Wand2,
  CheckCircle2,
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
  usePredictQuoteAcceptance,
  type PredictAcceptanceInput,
  type PredictAcceptanceOutput,
  type SuggestedAdjustment,
  type AcceptanceBand,
  type AdjustmentType,
  type Driver,
  type DriverWeight,
} from '../hooks/usePredictQuoteAcceptance';

interface PredictAcceptancePanelProps {
  input: PredictAcceptanceInput;
  /** Called when operator applies a specific adjustment back to the quotation. */
  onApplyAdjustment?: (adjustment: SuggestedAdjustment) => void;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

const BAND_META: Record<
  AcceptanceBand,
  { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive'; tone: string }
> = {
  very_low: { label: 'Very low', variant: 'destructive', tone: 'text-rose-600' },
  low: { label: 'Low', variant: 'destructive', tone: 'text-rose-600' },
  moderate: { label: 'Moderate', variant: 'secondary', tone: 'text-amber-600' },
  high: { label: 'High', variant: 'default', tone: 'text-emerald-600' },
  very_high: { label: 'Very high', variant: 'default', tone: 'text-emerald-700' },
};

const ADJUSTMENT_TYPE_LABEL: Record<AdjustmentType, string> = {
  price_concession: 'Price concession',
  term_concession: 'Term concession',
  scope_change: 'Scope change',
  validity_extension: 'Validity extension',
  add_concession_line: 'Add concession line',
  no_change_recommended: 'No change recommended',
};

const ADJUSTMENT_TYPE_VARIANT: Record<AdjustmentType, 'default' | 'secondary' | 'outline'> = {
  price_concession: 'secondary',
  term_concession: 'secondary',
  scope_change: 'outline',
  validity_extension: 'outline',
  add_concession_line: 'outline',
  no_change_recommended: 'default',
};

const WEIGHT_VARIANT: Record<DriverWeight, 'default' | 'secondary' | 'outline'> = {
  high: 'default',
  medium: 'secondary',
  low: 'outline',
};

function DriverList({ drivers, kind }: { drivers: Driver[]; kind: 'positive' | 'negative' }) {
  const Icon = kind === 'positive' ? TrendingUp : TrendingDown;
  const tone = kind === 'positive'
    ? 'text-emerald-700 dark:text-emerald-400'
    : 'text-rose-700 dark:text-rose-400';

  if (drivers.length === 0) {
    return (
      <p className="text-xs italic text-muted-foreground/70">
        No {kind} drivers identified.
      </p>
    );
  }

  return (
    <ul className="space-y-2 text-xs">
      {drivers.map((d, i) => (
        <li key={`${kind}-${i}-${d.factor}`}>
          <div className="flex items-start gap-1.5">
            <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${tone}`} />
            <div className="flex-1">
              <div className="flex items-center gap-1.5">
                <Badge variant={WEIGHT_VARIANT[d.weight]} className="text-xs">
                  {d.weight}
                </Badge>
                <span className="font-medium">{d.factor}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground">{d.evidence}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function fmtSignedDelta(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${(n * 100).toFixed(0)}pp`;
}

function fmtSignedPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export function PredictAcceptancePanel({ input, onApplyAdjustment }: PredictAcceptancePanelProps) {
  const { mutateAsync, data, isPending, reset } = usePredictQuoteAcceptance();
  const [applied, setApplied] = useState<Set<number>>(new Set());

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    setApplied(new Set());
    await mutateAsync(input);
  };

  const handleApply = (adjustment: SuggestedAdjustment, index: number) => {
    setApplied((prev) => new Set(prev).add(index));
    onApplyAdjustment?.(adjustment);
  };

  const bandMeta = parsed ? BAND_META[parsed.p_accept_band] : null;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI acceptance prediction
        </CardTitle>
        <CardDescription>
          Estimate P(accept) for quote{' '}
          <span className="font-mono text-xs">{input.quotation.quote_id}</span>{' '}
          ({input.quotation.mode.replace('_', ' ')},{' '}
          {input.quotation.lane.origin_country}→{input.quotation.lane.destination_country})
          and propose specific adjustments.
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
                Predict acceptance with AI
              </>
            )}
          </Button>
        )}

        {parsed && bandMeta && (
          <div className="space-y-4">
            {/* P(accept) headline */}
            <div className="rounded-md border bg-muted/30 p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <div className="text-xs uppercase text-muted-foreground">P(accept)</div>
                  <div className={`text-3xl font-bold tabular-nums ${bandMeta.tone}`}>
                    {Math.round(parsed.p_accept * 100)}%
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
            </div>

            {/* Drivers: 2-column grid */}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-emerald-700 dark:text-emerald-400">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Positive drivers ({parsed.positive_drivers.length})
                </div>
                <DriverList drivers={parsed.positive_drivers} kind="positive" />
              </div>

              <div className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase text-rose-700 dark:text-rose-400">
                  <TrendingDown className="h-3.5 w-3.5" />
                  Negative drivers ({parsed.negative_drivers.length})
                </div>
                <DriverList drivers={parsed.negative_drivers} kind="negative" />
              </div>
            </div>

            {/* Risk factors */}
            {parsed.risk_factors.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <ShieldAlert className="h-4 w-4" />
                  Risk factors
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                  {parsed.risk_factors.map((r, i) => (
                    <li key={`r-${i}-${r}`}>{r}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            {/* Suggested adjustments */}
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Wand2 className="h-4 w-4 text-primary" />
                Suggested adjustments ({parsed.suggested_adjustments.length})
              </div>
              {parsed.suggested_adjustments.length === 0 ? (
                <p className="text-xs italic text-muted-foreground/70">
                  No specific adjustments recommended.
                </p>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Type</TableHead>
                        <TableHead>Specific change</TableHead>
                        <TableHead className="text-right">ΔP</TableHead>
                        <TableHead className="text-right">ΔRev</TableHead>
                        <TableHead>Conf.</TableHead>
                        <TableHead className="w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsed.suggested_adjustments.map((adj, i) => {
                        const isApplied = applied.has(i);
                        return (
                          <TableRow key={`adj-${i}-${adj.adjustment_type}`}>
                            <TableCell>
                              <Badge variant={ADJUSTMENT_TYPE_VARIANT[adj.adjustment_type]} className="text-xs">
                                {ADJUSTMENT_TYPE_LABEL[adj.adjustment_type]}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">{adj.specific_change}</div>
                              <div className="mt-0.5 text-xs text-muted-foreground">{adj.rationale}</div>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              <span className={adj.expected_p_accept_delta > 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                {fmtSignedDelta(adj.expected_p_accept_delta)}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono tabular-nums">
                              <span className={adj.revenue_impact_pct < 0 ? 'text-rose-600' : 'text-emerald-600'}>
                                {fmtSignedPct(adj.revenue_impact_pct)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Badge variant={confidenceTone(adj.confidence)} className="text-xs">
                                {Math.round(adj.confidence * 100)}%
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {onApplyAdjustment && adj.adjustment_type !== 'no_change_recommended' && (
                                isApplied ? (
                                  <Badge variant="default" className="text-xs">
                                    <CheckCircle2 className="mr-1 h-3 w-3" />
                                    Applied
                                  </Badge>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleApply(adj, i)}
                                  >
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

export default PredictAcceptancePanel;

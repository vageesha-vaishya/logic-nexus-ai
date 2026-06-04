// ChargesSuggestionPanel — operator UI for llm-charges-suggestion.
// Drop-in card: button to request, then rendered charge spine table
// + payable_by chips + incoterm_split callout + risk_flags + total.

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  AlertCircle,
  Wallet,
  Scale,
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
  useChargesSuggestion,
  type ChargesSuggestionInput,
  type ChargesSuggestionOutput,
  type SuggestedCharge,
  type PayableBy,
} from '../hooks/useChargesSuggestion';

interface ChargesSuggestionPanelProps {
  input: ChargesSuggestionInput;
  /** Called when the operator commits the suggested lines into a draft invoice. */
  onAccept?: (output: ChargesSuggestionOutput) => void;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

function fmtMoney(amount: number | null | undefined, currency: string | null | undefined): string {
  if (amount == null || !currency) return '—';
  return `${currency} ${amount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

const PAYABLE_BY_LABEL: Record<PayableBy, string> = {
  shipper: 'Shipper',
  consignee: 'Consignee',
  third_party: '3rd party',
  per_incoterm: 'Per incoterm',
};

const PAYABLE_BY_VARIANT: Record<PayableBy, 'default' | 'secondary' | 'outline'> = {
  shipper: 'default',
  consignee: 'secondary',
  third_party: 'outline',
  per_incoterm: 'outline',
};

function ChargeRow({ charge }: { charge: SuggestedCharge }) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{charge.charge_code}</TableCell>
      <TableCell>
        <div className="font-medium">{charge.label}</div>
        <div className="text-xs text-muted-foreground">{charge.rationale}</div>
      </TableCell>
      <TableCell>
        <Badge variant={PAYABLE_BY_VARIANT[charge.payable_by]}>
          {PAYABLE_BY_LABEL[charge.payable_by]}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {charge.basis}
        {charge.basis_qty != null && <span> · {charge.basis_qty}</span>}
        {charge.rate != null && <span> @ {charge.rate}</span>}
      </TableCell>
      <TableCell className="text-right font-mono">
        {fmtMoney(charge.amount, charge.currency)}
      </TableCell>
    </TableRow>
  );
}

export function ChargesSuggestionPanel({ input, onAccept }: ChargesSuggestionPanelProps) {
  const { mutateAsync, data, isPending, reset } = useChargesSuggestion();
  const [committed, setCommitted] = useState(false);

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    setCommitted(false);
    await mutateAsync(input);
  };

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI charges suggestion
        </CardTitle>
        <CardDescription>
          Propose a complete charge spine for shipment{' '}
          <span className="font-mono text-xs">{input.shipment.shipment_id}</span>{' '}
          ({input.shipment.mode.replace('_', ' ')}, {input.shipment.origin.country}→
          {input.shipment.destination.country}
          {input.shipment.incoterm && `, ${input.shipment.incoterm}`}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Estimating charges…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Suggest charges with AI
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-4">
            {/* Header chips */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono">{parsed.currency}</Badge>
              <Badge variant="outline">{parsed.suggested_charges.length} lines</Badge>
              <Badge variant={confidenceTone(parsed.confidence)}>
                {Math.round(parsed.confidence * 100)}% confidence
              </Badge>
            </div>

            {/* Charge lines table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Payable by</TableHead>
                    <TableHead>Basis</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsed.suggested_charges.map((charge, i) => (
                    <ChargeRow
                      key={`${i}-${charge.charge_code}-${charge.label}`}
                      charge={charge}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Separator />

            {/* Total + incoterm split */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  Total estimate
                </div>
                <div className="mt-1 font-mono text-lg font-semibold">
                  {fmtMoney(parsed.total_estimate.amount, parsed.total_estimate.currency)}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" />
                  Shipper pays
                </div>
                <div className="mt-1 font-mono text-lg">
                  {fmtMoney(parsed.incoterm_split.shipper_pays, parsed.currency)}
                </div>
              </div>
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <Scale className="h-3.5 w-3.5" />
                  Consignee pays
                </div>
                <div className="mt-1 font-mono text-lg">
                  {fmtMoney(parsed.incoterm_split.consignee_pays, parsed.currency)}
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium">Incoterm split: </span>
              {parsed.incoterm_split.rationale}
            </p>

            {/* Risk flags */}
            {parsed.risk_flags.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <AlertCircle className="h-4 w-4" />
                  Risk flags
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-xs text-amber-900 dark:text-amber-200">
                  {parsed.risk_flags.map((f, i) => (
                    <li key={`risk-${i}-${f}`}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="rounded-md border bg-background p-3 text-xs">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Input-quality warnings
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-muted-foreground">
                  {parsed.warnings.map((w, i) => (
                    <li key={`warn-${i}-${w}`}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <Separator />

            <div className="flex gap-2">
              {onAccept && !committed && (
                <Button
                  size="sm"
                  onClick={() => {
                    setCommitted(true);
                    onAccept(parsed);
                  }}
                >
                  Accept all into draft invoice
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { reset(); setCommitted(false); }}>
                Re-suggest
              </Button>
            </div>
            {committed && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Charges committed to draft invoice.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ChargesSuggestionPanel;

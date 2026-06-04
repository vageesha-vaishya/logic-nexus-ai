// InvoiceLineClassifyPanel — operator UI for llm-invoice-line-classify.
// Drop-in card showing per-line GL routing + tax treatment + an
// "unclassified queue" for lines that need manual attention.

import { useState } from 'react';
import {
  Sparkles,
  Loader2,
  AlertTriangle,
  Inbox,
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
  useInvoiceLineClassify,
  type InvoiceLineClassifyInput,
  type InvoiceLineClassifyOutput,
  type LineClassification,
  type GlAccountType,
  type TaxTreatment,
} from '../hooks/useInvoiceLineClassify';

interface InvoiceLineClassifyPanelProps {
  input: InvoiceLineClassifyInput;
  /** Called when the operator commits the classifications back to the invoice draft. */
  onAccept?: (output: InvoiceLineClassifyOutput) => void;
}

function confidenceTone(c: number): 'destructive' | 'default' | 'secondary' {
  if (c >= 0.85) return 'default';
  if (c >= 0.65) return 'secondary';
  return 'destructive';
}

const GL_TYPE_VARIANT: Record<GlAccountType, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  revenue: 'default',
  cost_of_sales: 'secondary',
  expense: 'secondary',
  pass_through_liability: 'outline',
  tax_payable: 'outline',
  tax_receivable: 'outline',
  other: 'outline',
};

const TAX_TREATMENT_LABEL: Record<TaxTreatment, string> = {
  standard: 'Standard',
  zero_rated: 'Zero-rated',
  exempt: 'Exempt',
  reverse_charge: 'Reverse charge',
  out_of_scope: 'Out of scope',
};

const TAX_TREATMENT_VARIANT: Record<TaxTreatment, 'default' | 'secondary' | 'outline'> = {
  standard: 'default',
  zero_rated: 'secondary',
  exempt: 'outline',
  reverse_charge: 'outline',
  out_of_scope: 'outline',
};

function ClassificationRow({ c, originalAmount, originalCurrency }: {
  c: LineClassification;
  originalAmount: number | undefined;
  originalCurrency: string | undefined;
}) {
  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{c.line_id}</TableCell>
      <TableCell className="text-right font-mono text-xs">
        {originalAmount != null && originalCurrency
          ? `${originalCurrency} ${originalAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          : '—'}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-xs">{c.gl_account_code}</span>
            <span className="text-sm">{c.gl_account_name}</span>
          </div>
          <Badge variant={GL_TYPE_VARIANT[c.gl_account_type]} className="w-fit text-xs">
            {c.gl_account_type.replace(/_/g, ' ')}
          </Badge>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-1">
          <Badge variant={TAX_TREATMENT_VARIANT[c.tax_treatment]}>
            {TAX_TREATMENT_LABEL[c.tax_treatment]}
          </Badge>
          {c.tax_code && (
            <span className="text-xs text-muted-foreground">
              {c.tax_code}{c.tax_rate_pct != null && ` (${c.tax_rate_pct}%)`}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        {c.is_pass_through && (
          <Badge variant="outline" className="text-xs">Pass-through</Badge>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={confidenceTone(c.confidence)}>
          {Math.round(c.confidence * 100)}%
        </Badge>
      </TableCell>
    </TableRow>
  );
}

export function InvoiceLineClassifyPanel({ input, onAccept }: InvoiceLineClassifyPanelProps) {
  const { mutateAsync, data, isPending, reset } = useInvoiceLineClassify();
  const [committed, setCommitted] = useState(false);

  const parsed = data?.parsed_output ?? null;

  const handleRun = async () => {
    setCommitted(false);
    await mutateAsync(input);
  };

  // Build a map from line_id to original line for the amount column.
  const linesById = new Map(input.invoice_lines.map((l) => [l.line_id, l]));

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-4 w-4 text-primary" />
          AI line classification
        </CardTitle>
        <CardDescription>
          Map each of the {input.invoice_lines.length} invoice line
          {input.invoice_lines.length === 1 ? '' : 's'} to a GL account using your chart of
          accounts and {input.tax_rules.tax_label} rules ({input.tax_rules.jurisdiction}).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!parsed && (
          <Button onClick={handleRun} disabled={isPending} size="sm">
            {isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Classifying lines…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Classify with AI
              </>
            )}
          </Button>
        )}

        {parsed && (
          <div className="space-y-4">
            {/* Header chips */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default" className="text-sm">
                <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                {parsed.classifications.length} classified
              </Badge>
              {parsed.unclassified_lines.length > 0 && (
                <Badge variant="destructive">
                  <Inbox className="mr-1 h-3.5 w-3.5" />
                  {parsed.unclassified_lines.length} need review
                </Badge>
              )}
              <Badge variant={confidenceTone(parsed.confidence)}>
                {Math.round(parsed.confidence * 100)}% overall confidence
              </Badge>
            </div>

            {/* Classifications table */}
            {parsed.classifications.length > 0 && (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Line</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>GL Account</TableHead>
                      <TableHead>Tax</TableHead>
                      <TableHead>Flags</TableHead>
                      <TableHead>Conf.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsed.classifications.map((c) => {
                      const original = linesById.get(c.line_id);
                      return (
                        <ClassificationRow
                          key={c.line_id}
                          c={c}
                          originalAmount={original?.amount}
                          originalCurrency={original?.currency}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Unclassified queue */}
            {parsed.unclassified_lines.length > 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <Inbox className="h-4 w-4" />
                  Need manual classification ({parsed.unclassified_lines.length})
                </div>
                <ul className="space-y-1.5 text-xs text-amber-900 dark:text-amber-200">
                  {parsed.unclassified_lines.map((u) => {
                    const original = linesById.get(u.line_id);
                    return (
                      <li key={u.line_id}>
                        <span className="font-mono">{u.line_id}</span>
                        {original && <span> · {original.description}</span>}
                        <span className="text-amber-700 dark:text-amber-300"> — {u.reason}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {parsed.warnings.length > 0 && (
              <div className="rounded-md border bg-background p-3 text-xs">
                <div className="mb-1.5 flex items-center gap-2 text-sm font-medium">
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  Warnings
                </div>
                <ul className="ml-5 list-disc space-y-0.5 text-muted-foreground">
                  {parsed.warnings.map((w, i) => (
                    <li key={`w-${i}-${w}`}>{w}</li>
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
                  disabled={parsed.classifications.length === 0}
                >
                  Apply {parsed.classifications.length} classification
                  {parsed.classifications.length === 1 ? '' : 's'}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => { reset(); setCommitted(false); }}>
                Re-classify
              </Button>
            </div>
            {committed && (
              <p className="text-xs text-emerald-700 dark:text-emerald-400">
                Classifications applied to invoice draft.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default InvoiceLineClassifyPanel;

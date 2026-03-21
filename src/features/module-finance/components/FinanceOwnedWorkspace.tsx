import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useFinanceWorkspaceState } from '../hooks/useFinanceWorkspaceState';
import type { FinanceInvoiceLifecycle } from '../workspace/financeWorkspaceModel';

const lifecycleLabels: Record<FinanceInvoiceLifecycle, string> = {
  draft: 'Draft',
  review: 'Review',
  committed: 'Committed',
};

function currency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode }).format(amount);
}

export function FinanceOwnedWorkspace() {
  const state = useFinanceWorkspaceState();

  return (
    <section className="space-y-4">
      <Card data-finance-owned-surface="invoice-lifecycle">
        <CardHeader className="pb-2">
          <CardTitle>Invoice Lifecycle Views</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="space-y-1">
              <Label>Invoice</Label>
              <Select value={state.selectedInvoiceId} onValueChange={state.setSelectedInvoiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select invoice" />
                </SelectTrigger>
                <SelectContent>
                  {state.invoices.map((invoice) => (
                    <SelectItem key={invoice.id} value={invoice.id}>
                      {invoice.invoiceNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Lifecycle</p>
              <p className="text-sm font-medium">{lifecycleLabels[state.selectedInvoice?.lifecycle ?? 'draft']}</p>
            </div>
            <div className="rounded-md border p-3" data-finance-mutation-context="currency-jurisdiction">
              <p className="text-xs text-muted-foreground">Mutation Context</p>
              <p className="text-sm font-medium">
                {state.selectedInvoice?.currencyCode ?? 'USD'} · {state.selectedInvoice?.taxJurisdiction ?? 'N/A'}
              </p>
            </div>
          </div>

          <div className="rounded-md border p-3" data-finance-boundary="cross-module-links">
            <p className="text-xs text-muted-foreground">Cross-module Business Context</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`/dashboard/quotes/${state.selectedInvoice?.quoteReferenceId ?? ''}`}>
                  Quote {state.selectedInvoice?.quoteReferenceId}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/dashboard/shipments/${state.selectedInvoice?.shipmentReferenceId ?? ''}`}>
                  Shipment {state.selectedInvoice?.shipmentReferenceId}
                </Link>
              </Button>
              <Button asChild size="sm" variant="outline">
                <Link to={`/dashboard/accounts/${state.selectedInvoice?.accountReferenceId ?? ''}`}>
                  Account {state.selectedInvoice?.accountReferenceId}
                </Link>
              </Button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2" data-finance-boundary="mutation-role-guard">
            <Badge variant={state.isFinanceMutationAuthorized ? 'secondary' : 'destructive'}>
              {state.isFinanceMutationAuthorized ? 'Finance Authorized' : 'Unauthorized for Finance Mutation'}
            </Badge>
            <Button size="sm" onClick={() => state.executeMutation('save_draft')} disabled={!state.canMutateSelectedInvoice}>
              Save Draft
            </Button>
            <Button size="sm" onClick={() => state.executeMutation('adjust_tax')} disabled={!state.canMutateSelectedInvoice}>
              Recalculate Tax
            </Button>
            <Button size="sm" onClick={() => state.executeMutation('commit_invoice')} disabled={!state.canMutateSelectedInvoice}>
              Commit Invoice
            </Button>
            <Badge variant="outline">{state.mutationState}</Badge>
          </div>

          {!state.canMutateSelectedInvoice ? (
            <div className="flex flex-wrap items-center gap-2" data-finance-compensating-workflow="enabled">
              <Badge variant="destructive">Editing Locked</Badge>
              <Button asChild size="sm" variant="outline">
                <Link to={state.pendingCompensatingWorkflowPath || `/dashboard/finance/invoices/${state.selectedInvoice?.id}`}>
                  Open Compensating Workflow
                </Link>
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <Card data-finance-owned-surface="tax-breakdown">
          <CardHeader className="pb-2">
            <CardTitle>Tax Breakdown Panels</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.taxBreakdown.map((line) => (
              <div
                key={line.id}
                className="rounded-md border p-2"
                data-immutable-record={line.committed ? 'locked' : 'editable'}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{line.category}</p>
                  <Badge variant={line.committed ? 'secondary' : 'outline'}>
                    {line.committed ? 'Committed' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {line.jurisdiction} · {line.rate}% · {currency(line.amount, state.selectedInvoice?.currencyCode ?? 'USD')}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card data-finance-owned-surface="journal-review">
          <CardHeader className="pb-2">
            <CardTitle>Journal Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {state.journalRows.map((row) => (
              <div
                key={row.id}
                className="rounded-md border p-2"
                data-immutable-record={row.committed ? 'locked' : 'editable'}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{row.journalNumber}</p>
                  <Badge variant={row.committed ? 'secondary' : 'outline'}>
                    {row.committed ? 'Committed' : 'Draft'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {row.ledgerAccount} · Dr {currency(row.debit, state.selectedInvoice?.currencyCode ?? 'USD')} · Cr{' '}
                  {currency(row.credit, state.selectedInvoice?.currencyCode ?? 'USD')}
                </p>
                <Button asChild size="sm" variant="link" className="px-0">
                  <Link to={row.sourcePointer}>Source Pointer</Link>
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card data-finance-owned-surface="reconciliation-dashboard">
        <CardHeader className="pb-2">
          <CardTitle>Reconciliation Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {state.discrepancies.map((item) => (
            <div key={item.id} className="rounded-md border p-2" data-discrepancy-pointer={item.sourcePointer}>
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">{item.summary}</p>
                <Badge variant={item.amountDelta === 0 ? 'secondary' : 'destructive'}>
                  Δ {currency(item.amountDelta, state.selectedInvoice?.currencyCode ?? 'USD')}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">{item.sourceModule} · {item.sourcePointer}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Button size="sm" variant="secondary" onClick={() => state.toggleDiscrepancy(item.id)}>
                  {state.expandedDiscrepancyId === item.id ? 'Hide Drill-down' : 'Drill-down'}
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to={item.sourcePointer}>Open Source Pointer</Link>
                </Button>
              </div>
              {state.expandedDiscrepancyId === item.id ? (
                <p className="mt-2 text-xs text-muted-foreground">{item.details}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card data-finance-owned-surface="margin-receivables-analytics">
        <CardHeader className="pb-2">
          <CardTitle>Margin and Receivables Analytics</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total Receivables</p>
            <p className="text-sm font-medium">{currency(state.analytics.receivablesTotal, state.selectedInvoice?.currencyCode ?? 'USD')}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Total Margin</p>
            <p className="text-sm font-medium">{currency(state.analytics.marginTotal, state.selectedInvoice?.currencyCode ?? 'USD')}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Committed Invoices</p>
            <p className="text-sm font-medium">{state.analytics.committedCount}</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="text-xs text-muted-foreground">Average Margin Rate</p>
            <p className="text-sm font-medium">{state.analytics.averageMarginRate}%</p>
          </div>
        </CardContent>
      </Card>

      <Separator />
    </section>
  );
}

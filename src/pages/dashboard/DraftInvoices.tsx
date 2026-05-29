import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, CircleSlash, Ship } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';

type InvoiceStatus = 'draft' | 'issued' | 'paid' | 'partial' | 'void' | 'overdue' | 'cancelled';

interface FinanceInvoice {
  id: string;
  tenant_id: string;
  invoice_number: string;
  customer_id: string | null;
  shipment_id: string | null;
  status: InvoiceStatus;
  type: string | null;
  issue_date: string | null;
  due_date: string | null;
  currency: string | null;
  subtotal: number | null;
  tax_total: number | null;
  total: number | null;
  balance_due: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANT: Record<InvoiceStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  issued: 'default',
  paid: 'default',
  partial: 'secondary',
  void: 'destructive',
  overdue: 'destructive',
  cancelled: 'destructive',
};

const STATUS_FILTER_OPTIONS: ('all' | InvoiceStatus)[] = ['all', 'draft', 'issued', 'paid', 'cancelled'];

const fmtMoney = (n: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

const DEFAULT_DUE_DAYS = 30;

export default function DraftInvoices() {
  const { supabase } = useCRM();
  const [invoices, setInvoices] = useState<FinanceInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | InvoiceStatus>('draft');
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      // Only show invoices that originated from the cross-module
      // consumer (metadata ? 'source_outbox_id'). The standalone
      // Invoices page covers human-created invoices.
      const { data, error } = await supabase
        .from('v_finance_invoices')
        .select(
          'id, tenant_id, invoice_number, customer_id, shipment_id, status, type, issue_date, due_date, currency, subtotal, tax_total, total, balance_due, notes, metadata, created_at, updated_at',
        )
        .not('metadata->source_outbox_id', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices((data ?? []) as FinanceInvoice[]);
    } catch (e) {
      logger.error({ event: 'draft_invoices.list.failed', error: String(e) });
      toast.error('Failed to load draft invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoices();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return invoices.filter((i) => {
      if (statusFilter !== 'all' && i.status !== statusFilter) return false;
      if (q) {
        const haystack = [
          i.invoice_number,
          i.shipment_id ?? '',
          i.customer_id ?? '',
          (i.metadata?.shipment_number as string) ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [invoices, search, statusFilter]);

  const totals = useMemo(() => {
    const t: Record<'draft' | 'issued' | 'paid' | 'cancelled', { count: number; sum: number }> = {
      draft: { count: 0, sum: 0 },
      issued: { count: 0, sum: 0 },
      paid: { count: 0, sum: 0 },
      cancelled: { count: 0, sum: 0 },
    };
    for (const i of filtered) {
      const bucket = (['draft', 'issued', 'paid', 'cancelled'] as const).find((s) => s === i.status);
      if (!bucket) continue;
      t[bucket].count += 1;
      t[bucket].sum += Number(i.total) || 0;
    }
    return t;
  }, [filtered]);

  const totalCurrency = filtered[0]?.currency ?? 'INR';

  const handleFinalize = async (i: FinanceInvoice) => {
    setTransitioning(i.id);
    try {
      const issueDate = new Date();
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + DEFAULT_DUE_DAYS);
      const { error } = await supabase
        .from('v_finance_invoices')
        .update({
          status: 'issued',
          issue_date: issueDate.toISOString().slice(0, 10),
          due_date: dueDate.toISOString().slice(0, 10),
        })
        .eq('id', i.id);
      if (error) throw error;
      toast.success('Invoice finalized');
      setInvoices((prev) =>
        prev.map((x) =>
          x.id === i.id
            ? {
                ...x,
                status: 'issued' as InvoiceStatus,
                issue_date: issueDate.toISOString().slice(0, 10),
                due_date: dueDate.toISOString().slice(0, 10),
              }
            : x,
        ),
      );
    } catch (e) {
      logger.error({ event: 'draft_invoices.finalize.failed', error: String(e), id: i.id });
      toast.error('Failed to finalize invoice');
    } finally {
      setTransitioning(null);
    }
  };

  const handleCancel = async (i: FinanceInvoice) => {
    if (!window.confirm('Cancel this draft invoice? The shipment-delivered event stays consumed; you can manually re-emit if needed.')) return;
    setTransitioning(i.id);
    try {
      const { error } = await supabase.from('v_finance_invoices').update({ status: 'cancelled' }).eq('id', i.id);
      if (error) throw error;
      toast.success('Invoice cancelled');
      setInvoices((prev) => prev.map((x) => (x.id === i.id ? { ...x, status: 'cancelled' as InvoiceStatus } : x)));
    } catch (e) {
      logger.error({ event: 'draft_invoices.cancel.failed', error: String(e), id: i.id });
      toast.error('Failed to cancel invoice');
    } finally {
      setTransitioning(null);
    }
  };

  const renderActions = (i: FinanceInvoice) => {
    if (i.status !== 'draft') {
      return <span className="text-xs text-muted-foreground">terminal</span>;
    }
    return (
      <div className="flex justify-end gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleFinalize(i)}
                disabled={transitioning === i.id}
                aria-label="Finalize draft"
                className="text-emerald-600 hover:text-emerald-700"
              >
                <CheckCircle2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Finalize (issue with {DEFAULT_DUE_DAYS}-day terms)</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleCancel(i)}
                disabled={transitioning === i.id}
                aria-label="Cancel draft"
                className="text-destructive hover:text-destructive"
              >
                <CircleSlash className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Cancel</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Draft Invoices</h1>
          <p className="text-muted-foreground">
            Auto-generated from <code className="text-xs">logistics.shipment.delivered</code> events. Finalize to issue with{' '}
            {DEFAULT_DUE_DAYS}-day terms, or cancel if the delivery shouldn't bill (e.g., warranty replacement, internal transfer).
            The standalone Invoices page covers manually-created invoices.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {(['draft', 'issued', 'paid', 'cancelled'] as const).map((s) => (
            <Card key={s}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{s}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{totals[s].count}</div>
                <p className="text-xs text-muted-foreground">{fmtMoney(totals[s].sum, totalCurrency)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Cross-module-generated invoices</CardTitle>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search invoice / shipment / account…"
                  className="w-[280px]"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | InvoiceStatus)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_FILTER_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s === 'all' ? 'All statuses' : s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {invoices.length === 0
                  ? 'No drafts yet — they appear here automatically when shipments are marked delivered.'
                  : 'No invoices match the current filters.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Issued</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((i) => {
                    const shipmentNumber = (i.metadata?.shipment_number as string) ?? null;
                    return (
                      <TableRow key={i.id}>
                        <TableCell>
                          <div className="font-medium">{i.invoice_number}</div>
                          <div className="text-xs text-muted-foreground">{i.id.slice(0, 8)}…</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Ship className="h-3 w-3" />
                            {shipmentNumber || (i.shipment_id ? i.shipment_id.slice(0, 8) + '…' : '—')}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {i.customer_id ? i.customer_id.slice(0, 8) + '…' : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums font-medium">
                          {fmtMoney(Number(i.total) || 0, i.currency || 'INR')}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[i.status]} className="capitalize">
                            {i.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {i.issue_date ? format(new Date(i.issue_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {i.due_date ? format(new Date(i.due_date), 'MMM d, yyyy') : '—'}
                        </TableCell>
                        <TableCell className="text-right">{renderActions(i)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

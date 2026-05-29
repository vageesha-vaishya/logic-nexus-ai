import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CheckCircle2, CircleSlash, DollarSign, ExternalLink } from 'lucide-react';

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

type CommissionStatus = 'pending' | 'approved' | 'paid' | 'cancelled';

interface Commission {
  id: string;
  tenant_id: string;
  opportunity_id: string;
  account_id: string | null;
  owner_id: string | null;
  amount_base: number | null;
  rate_percent: number;
  amount: number;
  currency: string;
  status: CommissionStatus;
  computed_at: string;
  source_outbox_id: string | null;
  commission_rule_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANT: Record<CommissionStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  approved: 'secondary',
  paid: 'default',
  cancelled: 'destructive',
};

const STATUS_ORDER: CommissionStatus[] = ['pending', 'approved', 'paid', 'cancelled'];

const fmtMoney = (n: number, currency: string): string => {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
};

export default function Commissions() {
  const { supabase } = useCRM();
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionStatus>('all');
  const [transitioning, setTransitioning] = useState<string | null>(null);

  const fetchCommissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_commissions')
        .select(
          'id, tenant_id, opportunity_id, account_id, owner_id, amount_base, rate_percent, amount, currency, status, computed_at, source_outbox_id, commission_rule_id, metadata, created_at, updated_at',
        )
        .order('computed_at', { ascending: false });
      if (error) throw error;
      setCommissions((data ?? []) as Commission[]);
    } catch (e) {
      logger.error({ event: 'commissions.list.failed', error: String(e) });
      toast.error('Failed to load commissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return commissions.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q) {
        const haystack = [
          c.id,
          c.opportunity_id,
          c.owner_id ?? '',
          c.account_id ?? '',
          (c.metadata?.opportunity_name as string) ?? '',
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [commissions, search, statusFilter]);

  const totals = useMemo(() => {
    const t: Record<CommissionStatus, { count: number; sum: number }> = {
      pending: { count: 0, sum: 0 },
      approved: { count: 0, sum: 0 },
      paid: { count: 0, sum: 0 },
      cancelled: { count: 0, sum: 0 },
    };
    for (const c of filtered) {
      t[c.status].count += 1;
      t[c.status].sum += Number(c.amount) || 0;
    }
    return t;
  }, [filtered]);

  const totalCurrency = filtered[0]?.currency ?? 'INR';

  const handleTransition = async (c: Commission, nextStatus: CommissionStatus) => {
    setTransitioning(c.id);
    try {
      const { error } = await supabase.from('v_commissions').update({ status: nextStatus }).eq('id', c.id);
      if (error) throw error;
      toast.success(`Commission ${nextStatus}`);
      // Optimistic local update to avoid a full refetch.
      setCommissions((prev) => prev.map((x) => (x.id === c.id ? { ...x, status: nextStatus } : x)));
    } catch (e) {
      logger.error({ event: 'commissions.transition.failed', error: String(e), id: c.id, nextStatus });
      toast.error('Failed to update status');
    } finally {
      setTransitioning(null);
    }
  };

  const renderActions = (c: Commission) => {
    if (c.status === 'paid' || c.status === 'cancelled') {
      return <span className="text-xs text-muted-foreground">terminal</span>;
    }
    return (
      <div className="flex justify-end gap-1">
        <TooltipProvider>
          {c.status === 'pending' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTransition(c, 'approved')}
                  disabled={transitioning === c.id}
                  aria-label="Approve commission"
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Approve</TooltipContent>
            </Tooltip>
          ) : null}
          {c.status === 'approved' ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleTransition(c, 'paid')}
                  disabled={transitioning === c.id}
                  aria-label="Mark paid"
                  className="text-emerald-600 hover:text-emerald-700"
                >
                  <DollarSign className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Mark paid</TooltipContent>
            </Tooltip>
          ) : null}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleTransition(c, 'cancelled')}
                disabled={transitioning === c.id}
                aria-label="Cancel commission"
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
          <h1 className="text-3xl font-bold">Commissions</h1>
          <p className="text-muted-foreground">
            Auto-computed from <code className="text-xs">sales.opportunity.won</code> events. Approve to lock the amount, mark paid
            after disbursement, or cancel at any non-paid step. Rates and amounts are write-once (set by the consumer at compute time).
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          {STATUS_ORDER.map((s) => (
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
              <CardTitle>All commissions</CardTitle>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search opportunity / owner / account…"
                  className="w-[280px]"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | CommissionStatus)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    {STATUS_ORDER.map((s) => (
                      <SelectItem key={s} value={s} className="capitalize">
                        {s}
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
                {commissions.length === 0
                  ? 'No commissions yet — they appear here automatically when opportunities close as won.'
                  : 'No commissions match the current filters.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Opportunity</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead className="text-right">Base</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Computed</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const oppName = (c.metadata?.opportunity_name as string) ?? null;
                    const rateSource = (c.metadata?.rate_source as string) ?? null;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{oppName || c.opportunity_id.slice(0, 8) + '…'}</div>
                          <div className="text-xs text-muted-foreground">{c.opportunity_id.slice(0, 8)}…</div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.owner_id ? c.owner_id.slice(0, 8) + '…' : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {c.amount_base != null ? fmtMoney(Number(c.amount_base), c.currency) : '—'}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{Number(c.rate_percent).toFixed(2)}%</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{fmtMoney(Number(c.amount), c.currency)}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[c.status]} className="capitalize">
                            {c.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{format(new Date(c.computed_at), 'MMM d, yyyy')}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {c.commission_rule_id ? (
                            <span title={`rule ${c.commission_rule_id}`} className="flex items-center gap-1">
                              <ExternalLink className="h-3 w-3" /> rule
                            </span>
                          ) : (
                            rateSource ?? 'env default'
                          )}
                        </TableCell>
                        <TableCell className="text-right">{renderActions(c)}</TableCell>
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

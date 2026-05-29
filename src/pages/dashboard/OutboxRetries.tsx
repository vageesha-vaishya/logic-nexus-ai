import { useEffect, useMemo, useState } from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { CircleSlash, RotateCcw } from 'lucide-react';

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

type RetryStatus = 'pending' | 'exhausted' | 'resolved';

interface OutboxRetry {
  id: string;
  outbox_id: string;
  tenant_id: string;
  attempt_count: number;
  max_attempts: number;
  last_error: string | null;
  last_attempt_at: string | null;
  next_attempt_at: string;
  status: RetryStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

const STATUS_VARIANT: Record<RetryStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  exhausted: 'destructive',
  resolved: 'default',
};

const STATUS_FILTER_OPTIONS: ('all' | RetryStatus)[] = ['all', 'pending', 'exhausted', 'resolved'];

export default function OutboxRetries() {
  const { supabase } = useCRM();
  const [retries, setRetries] = useState<OutboxRetry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | RetryStatus>('exhausted');
  const [actioning, setActioning] = useState<string | null>(null);

  const fetchRetries = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_outbox_retries')
        .select(
          'id, outbox_id, tenant_id, attempt_count, max_attempts, last_error, last_attempt_at, next_attempt_at, status, metadata, created_at, updated_at',
        )
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setRetries((data ?? []) as OutboxRetry[]);
    } catch (e) {
      logger.error({ event: 'outbox_retries.list.failed', error: String(e) });
      toast.error('Failed to load retry queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRetries();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return retries.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q) {
        const haystack = [r.outbox_id, r.last_error ?? ''].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [retries, search, statusFilter]);

  const totals = useMemo(() => {
    const t: Record<RetryStatus, number> = { pending: 0, exhausted: 0, resolved: 0 };
    for (const r of retries) {
      t[r.status] += 1;
    }
    return t;
  }, [retries]);

  // Retry: reset attempt_count to 0, status='pending', next_attempt_at=now.
  // The consumer picks it up on the next poll. Errors clear because the
  // counter resets.
  const handleRetry = async (r: OutboxRetry) => {
    setActioning(r.id);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('v_outbox_retries')
        .update({
          attempt_count: 0,
          status: 'pending',
          next_attempt_at: nowIso,
          last_error: null,
        })
        .eq('id', r.id);
      if (error) throw error;
      toast.success('Retry queued — consumer will pick this up on the next poll');
      setRetries((prev) =>
        prev.map((x) =>
          x.id === r.id
            ? { ...x, attempt_count: 0, status: 'pending' as RetryStatus, next_attempt_at: nowIso, last_error: null }
            : x,
        ),
      );
    } catch (e) {
      logger.error({ event: 'outbox_retries.retry.failed', error: String(e), id: r.id });
      toast.error('Failed to queue retry');
    } finally {
      setActioning(null);
    }
  };

  // Dismiss: flip to 'resolved' with a metadata note. The event drops
  // out of the pending view; the side effect (commission / draft invoice)
  // does NOT get created. Use when the upstream event was a false
  // positive or already handled out of band.
  const handleDismiss = async (r: OutboxRetry) => {
    if (
      !window.confirm(
        'Dismiss this retry? The downstream side effect (commission / draft invoice) will NOT be created. Use only when the event was a false positive or already handled manually.',
      )
    )
      return;
    setActioning(r.id);
    try {
      const meta = { ...(r.metadata ?? {}), dismissed_at: new Date().toISOString(), dismissed_via: 'ui' };
      const { error } = await supabase.from('v_outbox_retries').update({ status: 'resolved', metadata: meta }).eq('id', r.id);
      if (error) throw error;
      toast.success('Retry dismissed');
      setRetries((prev) =>
        prev.map((x) => (x.id === r.id ? { ...x, status: 'resolved' as RetryStatus, metadata: meta } : x)),
      );
    } catch (e) {
      logger.error({ event: 'outbox_retries.dismiss.failed', error: String(e), id: r.id });
      toast.error('Failed to dismiss retry');
    } finally {
      setActioning(null);
    }
  };

  const renderActions = (r: OutboxRetry) => {
    if (r.status === 'resolved') {
      return <span className="text-xs text-muted-foreground">resolved</span>;
    }
    return (
      <div className="flex justify-end gap-1">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRetry(r)}
                disabled={actioning === r.id}
                aria-label="Retry now"
                className="text-emerald-600 hover:text-emerald-700"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reset counter + queue for next poll</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(r)}
                disabled={actioning === r.id}
                aria-label="Dismiss"
                className="text-destructive hover:text-destructive"
              >
                <CircleSlash className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Dismiss without side effect</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  };

  const fmtRelative = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      return formatDistanceToNow(new Date(iso), { addSuffix: true });
    } catch {
      return iso;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Retry Queue</h1>
          <p className="text-muted-foreground">
            Cross-module consumer dispatch failures. Pending entries wait their backoff window. Exhausted entries spent the full
            attempt budget — admin intervention needed. Retry resets the counter; dismiss flips to resolved without producing the
            side effect.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {(['pending', 'exhausted', 'resolved'] as const).map((s) => (
            <Card key={s}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium capitalize">{s}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold tabular-nums">{totals[s]}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Retry history</CardTitle>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search outbox id / error…"
                  className="w-[280px]"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | RetryStatus)}>
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
                {retries.length === 0
                  ? 'No retries — the consumer has succeeded on every dispatch.'
                  : 'No retries match the current filters.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Outbox</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last error</TableHead>
                    <TableHead>Last attempt</TableHead>
                    <TableHead>Next attempt</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">
                        <div className="font-mono">{r.outbox_id.slice(0, 8)}…</div>
                        <div className="text-muted-foreground">{format(new Date(r.created_at), 'MMM d, yyyy')}</div>
                      </TableCell>
                      <TableCell className="tabular-nums">
                        {r.attempt_count} / {r.max_attempts}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[320px] text-xs text-muted-foreground">
                        <div className="line-clamp-2" title={r.last_error ?? undefined}>
                          {r.last_error ?? '—'}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{fmtRelative(r.last_attempt_at)}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.status === 'pending' ? fmtRelative(r.next_attempt_at) : '—'}
                      </TableCell>
                      <TableCell className="text-right">{renderActions(r)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

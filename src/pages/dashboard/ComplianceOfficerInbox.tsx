import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ExternalLink, ShieldAlert, ShieldCheck, ShieldOff } from 'lucide-react';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useBlockedParties,
  type BlockedPartyRow,
  type BlockedPartyStatus,
} from '@/features/module-compliance/hooks/useComplianceOfficer';

const STATUS_OPTIONS: BlockedPartyStatus[] = ['failed', 'overridden', 'expired', 'all'];

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case 'failed':
      return 'destructive' as const;
    case 'overridden':
      return 'secondary' as const;
    case 'expired':
      return 'outline' as const;
    default:
      return 'default' as const;
  }
};

const statusIcon = (status: string) => {
  switch (status) {
    case 'failed':
      return <ShieldAlert className="h-4 w-4" />;
    case 'overridden':
      return <ShieldCheck className="h-4 w-4" />;
    case 'expired':
      return <ShieldOff className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};

const subjectLabel = (row: BlockedPartyRow): string => {
  if (row.party_display_name) return row.party_display_name;
  if (row.account_name) return row.account_name;
  if (row.lead_company_name) return row.lead_company_name;
  if (row.lead_email) return row.lead_email;
  return `${row.subject_type ?? 'subject'} · ${(row.subject_id ?? '').slice(0, 8)}`;
};

export default function ComplianceOfficerInbox() {
  const [status, setStatus] = useState<BlockedPartyStatus>('failed');
  const [search, setSearch] = useState('');
  const { data: rows = [], isLoading, isError, error } = useBlockedParties(status);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const needle = search.trim().toLowerCase();
    return rows.filter((r) => {
      const haystack = [
        subjectLabel(r),
        r.subject_type,
        r.triggered_by_event,
        r.provider,
        r.lead_email,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [rows, search]);

  const counts = useMemo(() => {
    const c = { failed: 0, overridden: 0, expired: 0, total: rows.length };
    rows.forEach((r) => {
      if (r.status in c) (c as Record<string, number>)[r.status] += 1;
    });
    return c;
  }, [rows]);

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Compliance officer inbox</h1>
            <p className="text-sm text-muted-foreground">
              Screenings currently in a blocked state. Override (with justification) to unblock the
              downstream module; revoke an override to re-block.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Total in view</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{counts.total}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Failed</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold text-destructive">{counts.failed}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Overridden</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{counts.overridden}</CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-1">
              <CardTitle className="text-xs uppercase text-muted-foreground">Expired</CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{counts.expired}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>Blocked parties</CardTitle>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Search name, email, event…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-64"
                />
                <Select value={status} onValueChange={(v) => setStatus(v as BlockedPartyStatus)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>}
            {isError && (
              <p className="text-sm text-destructive py-6 text-center">
                Failed to load: {(error as Error)?.message ?? 'unknown'}
              </p>
            )}
            {!isLoading && !isError && filtered.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">No screenings match the filter.</p>
            )}
            {!isLoading && !isError && filtered.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Event</TableHead>
                    <TableHead>Hits</TableHead>
                    <TableHead>Top score</TableHead>
                    <TableHead>Triggered</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.screening_id}>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(r.status)} className="gap-1">
                          {statusIcon(r.status)}
                          {r.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{subjectLabel(r)}</div>
                        <div className="text-xs text-muted-foreground">{r.subject_type}</div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{r.triggered_by_event ?? '—'}</code>
                      </TableCell>
                      <TableCell>{r.hit_count ?? 0}</TableCell>
                      <TableCell>
                        {r.max_similarity != null ? `${(Number(r.max_similarity) * 100).toFixed(1)}%` : '—'}
                      </TableCell>
                      <TableCell>
                        <span title={r.triggered_at}>
                          {formatDistanceToNow(new Date(r.triggered_at), { addSuffix: true })}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button asChild variant="outline" size="sm">
                          <Link to={`/dashboard/compliance/screenings/${r.screening_id}`}>
                            Open <ExternalLink className="h-3 w-3 ml-1" />
                          </Link>
                        </Button>
                      </TableCell>
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

// Phase 6 Comms — WhatsApp phone-edit admin page.
//
// Platform-admin view of core.phone_numbers per tenant with per-row
// whatsapp_capable toggle. Pair with the bulk-enable endpoint for
// large rollouts; this page is for the long tail of individual
// adjustments.

import { useState } from 'react';
import { Loader2, RefreshCw, MessageSquare, AlertCircle, Zap } from 'lucide-react';
import { format } from 'date-fns';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/hooks/useAuth';
import {
  useAdminPhoneList,
  useToggleWhatsappCapable,
  useBulkEnableWhatsapp,
} from '@/features/admin/comms/useWhatsappPhones';

function ErrorBox({ err }: { err: unknown }) {
  const message = err instanceof Error ? err.message : String(err);
  return (
    <div className="flex items-start gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">Couldn't load phones.</p>
        <p className="text-xs">{message}</p>
      </div>
    </div>
  );
}

export default function WhatsappPhonesPage() {
  const { profile } = useAuth();
  // Most admins only see their own tenant; the platform_admin server
  // gate still enforces auth either way. Default to the profile's
  // tenant_id so the page populates without manual input.
  const defaultTenantId = (profile as { tenant_id?: string } | null)?.tenant_id ?? '';
  const [tenantId, setTenantId] = useState(defaultTenantId);
  const [capableFilter, setCapableFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState('');
  const [page, setPage] = useState(0);
  const limit = 50;

  const phones = useAdminPhoneList({
    tenant_id: tenantId,
    capable: capableFilter === 'all' ? undefined : capableFilter === 'true',
    country_code: countryFilter.trim() || undefined,
    limit,
    offset: page * limit,
  });
  const toggle = useToggleWhatsappCapable();
  const bulk = useBulkEnableWhatsapp();

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkCountry, setBulkCountry] = useState('');
  const [bulkDryRunResult, setBulkDryRunResult] = useState<{ matched: number; sample: { e164: string }[] } | null>(null);

  const total = phones.data?.total ?? 0;
  const hasNext = (page + 1) * limit < total;
  const items = phones.data?.items ?? [];

  return (
    <div className="p-6 space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-emerald-600" />
          <h1 className="text-lg font-semibold">WhatsApp opt-ins</h1>
          <span className="text-xs text-muted-foreground">
            per-phone whatsapp_capable management
          </span>
        </div>
        <Button variant="outline" size="sm" onClick={() => setBulkOpen(true)}>
          <Zap className="mr-1 h-4 w-4" />
          Bulk enable
        </Button>
      </header>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Tenant ID</Label>
            <Input
              value={tenantId}
              onChange={(e) => { setTenantId(e.target.value); setPage(0); }}
              placeholder="00000000-0000-..."
              className="w-[320px] h-8 text-xs font-mono"
            />
          </div>
          <div>
            <Label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Capability</Label>
            <Select value={capableFilter} onValueChange={(v) => { setCapableFilter(v); setPage(0); }}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="true">Enabled</SelectItem>
                <SelectItem value="false">Disabled</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="block text-[10px] uppercase tracking-wide text-muted-foreground">Country (ISO-2)</Label>
            <Input
              value={countryFilter}
              onChange={(e) => { setCountryFilter(e.target.value.toUpperCase()); setPage(0); }}
              placeholder="IN"
              maxLength={2}
              className="w-[80px] h-8 text-xs uppercase"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => phones.refetch()} disabled={phones.isFetching}>
            {phones.isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground tabular-nums">
            {total} phone{total === 1 ? '' : 's'} · page {page + 1}
          </div>
        </div>

        {phones.isError && <ErrorBox err={phones.error} />}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>E.164</TableHead>
              <TableHead>Country</TableHead>
              <TableHead>Linked party</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right">WhatsApp</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-mono text-xs">{row.e164}</TableCell>
                <TableCell className="text-xs">{row.country ?? '—'}</TableCell>
                <TableCell className="text-xs">
                  {row.party_display_name ? (
                    row.party_display_name
                  ) : row.party_id ? (
                    <span className="font-mono text-muted-foreground">{row.party_id.slice(0, 8)}…</span>
                  ) : (
                    <span className="text-muted-foreground">unlinked</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {row.updated_at ? format(new Date(row.updated_at), 'yyyy-MM-dd HH:mm') : '—'}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-2">
                    {row.whatsapp_capable && <Badge variant="secondary" className="text-[10px]">on</Badge>}
                    <Switch
                      checked={row.whatsapp_capable}
                      disabled={toggle.isPending}
                      onCheckedChange={(checked) => {
                        toggle.mutate({ id: row.id, whatsapp_capable: checked });
                      }}
                    />
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {phones.isSuccess && items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                  No phones match the current filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0 || phones.isFetching}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNext || phones.isFetching}
          >
            Next
          </Button>
        </div>
      </Card>

      <Dialog open={bulkOpen} onOpenChange={(open) => { setBulkOpen(open); if (!open) setBulkDryRunResult(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk enable WhatsApp</DialogTitle>
            <DialogDescription>
              Flips whatsapp_capable=true for every phone in the tenant matching the optional country filter.
              5000-row cap per call. Dry-run first to see the match count + sample.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="block text-xs text-muted-foreground">Tenant ID</Label>
              <Input value={tenantId} disabled className="h-8 text-xs font-mono" />
            </div>
            <div>
              <Label className="block text-xs text-muted-foreground">Country (optional ISO-2)</Label>
              <Input
                value={bulkCountry}
                onChange={(e) => setBulkCountry(e.target.value.toUpperCase())}
                placeholder="IN"
                maxLength={2}
                className="h-8 text-xs uppercase"
              />
            </div>
            {bulkDryRunResult && (
              <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
                <p className="font-semibold">Dry-run match: {bulkDryRunResult.matched}</p>
                {bulkDryRunResult.sample.length > 0 && (
                  <p className="font-mono text-muted-foreground">
                    Sample: {bulkDryRunResult.sample.map((s) => s.e164).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const res = await bulk.mutateAsync({
                  tenant_id: tenantId,
                  country_code: bulkCountry.trim() || undefined,
                  dry_run: true,
                });
                setBulkDryRunResult({ matched: res.matched, sample: res.sample });
              }}
              disabled={bulk.isPending || !tenantId}
            >
              {bulk.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Dry run'}
            </Button>
            <Button
              size="sm"
              onClick={async () => {
                await bulk.mutateAsync({
                  tenant_id: tenantId,
                  country_code: bulkCountry.trim() || undefined,
                  dry_run: false,
                });
                setBulkOpen(false);
                setBulkDryRunResult(null);
              }}
              disabled={bulk.isPending || !tenantId || !bulkDryRunResult}
            >
              Apply ({bulkDryRunResult?.matched ?? 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

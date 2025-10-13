import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { createQuotationVersionWithOptions, recordCustomerSelection } from '@/integrations/supabase/carrierRatesActions';

type Version = {
  id: string;
  quote_id: string;
  version_number: number;
  kind: 'minor' | 'major';
  status: string | null;
  created_at: string;
};

type Option = {
  id: string;
  quotation_version_id: string;
  carrier_name: string;
  total_amount: number;
  currency: string;
  transit_time_days: number | null;
};

export function QuotationVersionHistory({ quoteId }: { quoteId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [optionsByVersion, setOptionsByVersion] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data: vs, error: vErr } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false });
      if (vErr) throw vErr;
      const versionIds = (vs ?? []).map((v: any) => v.id);
      if (versionIds.length > 0) {
        const { data: opts, error: oErr } = await supabase
          .from('quotation_version_options')
          .select('id, quotation_version_id, carrier_rate_id')
          .in('quotation_version_id', versionIds);
        if (oErr) throw oErr;
        const carrierRateIds = (opts ?? []).map((o: any) => o.carrier_rate_id).filter(Boolean);
        let rateMap: Record<string, any> = {};
        if (carrierRateIds.length > 0) {
          const { data: rates, error: rErr } = await supabase
            .from('carrier_rates')
            .select('id, carrier_name, currency, base_rate, mode, valid_until')
            .in('id', carrierRateIds);
          if (rErr) throw rErr;
          (rates ?? []).forEach((r: any) => { rateMap[String(r.id)] = r; });
        }
        const grouped: Record<string, Option[]> = {};
        (opts ?? []).forEach((o: any) => {
          const key = o.quotation_version_id as string;
          const r = rateMap[String(o.carrier_rate_id)] || {};
          const opt: Option = {
            id: o.id,
            quotation_version_id: key,
            carrier_name: r.carrier_name || 'Carrier',
            total_amount: Number(r.base_rate ?? 0),
            currency: r.currency || 'USD',
            transit_time_days: null,
          };
          grouped[key] = grouped[key] || [];
          grouped[key].push(opt);
        });
        setOptionsByVersion(grouped);
      } else {
        setOptionsByVersion({});
      }
      setVersions((vs ?? []) as Version[]);
    } catch (e: any) {
      toast({ title: 'Failed to load versions', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data: q } = await supabase
          .from('quotes')
          .select('tenant_id')
          .eq('id', quoteId)
          .maybeSingle();
        if (q?.tenant_id) setTenantId(String(q.tenant_id));
        const { data: auth } = await supabase.auth.getUser();
        setUserId(auth?.user?.id ?? null);
      } catch {}
    };
    init();
    load();
  }, [quoteId]);

  const latestVersionNumber = useMemo(
    () => (versions[0]?.version_number ?? 0),
    [versions]
  );

  const createVersion = async (kind: 'minor' | 'major') => {
    try {
      const nextNumber = kind === 'minor' ? latestVersionNumber + 1 : 1;
      if (!tenantId) throw new Error('Missing tenant context');
      const res = await createQuotationVersionWithOptions(
        tenantId,
        quoteId,
        [],
        { kind, version_number: nextNumber, created_by: userId || null },
        supabase as any,
      );
      if (!res?.version_id) throw new Error('Version creation did not return id');
      toast({ title: `${kind === 'minor' ? 'Minor' : 'Major'} version created` });
      await load();
    } catch (e: any) {
      toast({ title: 'Version creation failed', description: e.message, variant: 'destructive' });
    }
  };

  const selectOption = async (versionId: string, optionId: string) => {
    try {
      if (!tenantId || !userId) throw new Error('Missing tenant or user context');
      await recordCustomerSelection(
        tenantId,
        quoteId,
        versionId,
        optionId,
        null,
        userId,
        supabase as any,
      );
      toast({ title: 'Customer selection recorded' });
      await load();
    } catch (e: any) {
      toast({ title: 'Selection failed', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <Button disabled={loading} onClick={() => createVersion('minor')}>Create Minor Version</Button>
          <Button variant="secondary" disabled={loading} onClick={() => createVersion('major')}>Create Major Version</Button>
        </div>
        <Separator className="mb-3" />
        {versions.length === 0 && (
          <div className="text-sm text-muted-foreground">No versions yet. Create one above.</div>
        )}
        <div className="space-y-4">
          {versions.map(v => (
            <div key={v.id} className="border rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium">Version {v.version_number} ({v.kind})</div>
                <Badge variant="outline">{v.status ?? 'draft'}</Badge>
              </div>
              <div className="mt-2 grid gap-2">
                {(optionsByVersion[v.id] ?? []).map(opt => (
                  <div key={opt.id} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-3">
                      <Badge>{opt.carrier_name}</Badge>
                      <div className="text-sm">
                        {opt.currency} {Number(opt.total_amount).toFixed(2)}
                        {opt.transit_time_days != null && (
                          <span className="text-muted-foreground"> • {opt.transit_time_days} days</span>
                        )}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => selectOption(v.id, opt.id)}>Select</Button>
                  </div>
                ))}
                {(optionsByVersion[v.id] ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground">No options created for this version.</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
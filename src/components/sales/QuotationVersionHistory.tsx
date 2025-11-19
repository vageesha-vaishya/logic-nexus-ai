import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { createQuotationVersionWithOptions, recordCustomerSelection, createBlankOption } from '@/integrations/supabase/carrierRatesActions';

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
  option_name?: string | null;
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
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const navigate = useNavigate();

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
          .select('id, quotation_version_id, carrier_rate_id, option_name')
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
            option_name: o.option_name || null,
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
          .select('tenant_id, franchise_id')
          .eq('id', quoteId)
          .maybeSingle();
        if (q?.tenant_id) setTenantId(String(q.tenant_id));
        if (q?.franchise_id) setFranchiseId(String(q.franchise_id));
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
      if (!tenantId || !franchiseId) throw new Error('Missing tenant or franchise context');
      const res = await createQuotationVersionWithOptions(
        tenantId,
        franchiseId,
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

  const chunk = (arr: string[], size: number) => {
    const out: string[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
  };

  const deleteVersionsByIds = async (versionIds: string[]) => {
    if (!versionIds.length) return;
    setLoading(true);
    try {
      const { data: opts, error: oErr } = await supabase
        .from('quotation_version_options')
        .select('id')
        .in('quotation_version_id', versionIds);
      if (oErr) throw oErr;
      const optionIds = (opts ?? []).map((o: any) => String(o.id));

      let quoteLegIds: string[] = [];
      if (optionIds.length) {
        const { data: legs1, error: lErr1 } = await supabase
          .from('quote_legs')
          .select('id')
          .in('quote_option_id', optionIds);
        if (lErr1) throw lErr1;
        quoteLegIds = (legs1 ?? []).map((l: any) => String(l.id));
      }

      let compLegIds: string[] = [];
      if (optionIds.length) {
        const { data: legs2, error: lErr2 } = await supabase
          .from('quotation_version_option_legs')
          .select('id')
          .in('quotation_version_option_id', optionIds);
        if (lErr2) throw lErr2;
        compLegIds = (legs2 ?? []).map((l: any) => String(l.id));
      }

      for (const b of chunk(optionIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quote_charges').delete().in('quote_option_id', b);
        if (error) throw error;
      }
      for (const b of chunk(quoteLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quote_charges').delete().in('leg_id', b);
        if (error) throw error;
      }

      for (const b of chunk(quoteLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quote_legs').delete().in('id', b);
        if (error) throw error;
      }
      for (const b of chunk(compLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quotation_version_option_legs').delete().in('id', b);
        if (error) throw error;
      }

      for (const b of chunk(optionIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quotation_version_options').delete().in('id', b);
        if (error) throw error;
      }
      for (const b of chunk(versionIds, 1000)) {
        if (!b.length) continue;
        const { error } = await supabase.from('quotation_versions').delete().in('id', b);
        if (error) throw error;
      }

      toast({ title: 'Deleted versions', description: `Removed ${versionIds.length} version(s)` });
      await load();
    } catch (e: any) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const deleteVersion = async (versionId: string) => {
    const ok = window.confirm('Delete this version and all its options/legs/charges?');
    if (!ok) return;
    await deleteVersionsByIds([versionId]);
  };

  const deleteByKind = async (kind: 'minor' | 'major') => {
    const ids = versions.filter(v => v.kind === kind).map(v => v.id);
    if (!ids.length) {
      toast({ title: 'No versions', description: `No ${kind} versions to delete` });
      return;
    }
    const ok = window.confirm(`Delete all ${kind} versions and their data?`);
    if (!ok) return;
    await deleteVersionsByIds(ids);
  };

  const createNewOption = async (versionId: string) => {
    if (!tenantId || !franchiseId) {
      toast({ title: 'Error', description: 'Tenant ID or Franchise ID not found', variant: 'destructive' });
      return;
    }

    try {
      const optionId = await createBlankOption(tenantId, franchiseId, versionId);
      
      toast({
        title: 'Success',
        description: 'New option created successfully',
      });

      // Navigate to the composer with the new option
      navigate(`/dashboard/multimodal-quote?quoteId=${quoteId}&versionId=${versionId}&optionId=${optionId}`);
    } catch (error) {
      console.error('Failed to create option:', error);
      toast({
        title: 'Error',
        description: 'Failed to create new option',
        variant: 'destructive',
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Version History</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          <Button disabled={loading} onClick={() => createVersion('minor')}>Create Minor Version</Button>
          <Button variant="secondary" disabled={loading} onClick={() => createVersion('major')}>Create Major Version</Button>
          <Separator orientation="vertical" className="mx-2 h-6" />
          <Button variant="destructive" disabled={loading} onClick={() => deleteByKind('minor')}>Delete Minor Versions</Button>
          <Button variant="destructive" disabled={loading} onClick={() => deleteByKind('major')}>Delete Major Versions</Button>
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
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => createNewOption(v.id)}>
                    Create New Option
                  </Button>
                  <Badge variant="outline">{v.status ?? 'draft'}</Badge>
                </div>
              </div>
              <div className="mt-2 grid gap-2">
                {(optionsByVersion[v.id] ?? []).map(opt => (
                  <div key={opt.id} className="flex items-center justify-between rounded border p-2">
                    <div className="flex items-center gap-3">
                      <Badge>{opt.option_name || opt.carrier_name}</Badge>
                      <div className="text-sm">
                        {opt.currency} {Number(opt.total_amount).toFixed(2)}
                        {opt.transit_time_days != null && (
                          <span className="text-muted-foreground"> • {opt.transit_time_days} days</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/dashboard/multimodal-quote?quoteId=${quoteId}&versionId=${v.id}&optionId=${opt.id}`)}>
                        Edit
                      </Button>
                      <Button size="sm" onClick={() => selectOption(v.id, opt.id)}>Select</Button>
                    </div>
                  </div>
                ))}
                {(optionsByVersion[v.id] ?? []).length === 0 && (
                  <div className="text-xs text-muted-foreground">No options created for this version.</div>
                )}
                <div className="flex justify-end">
                  <Button variant="destructive" size="sm" disabled={loading} onClick={() => deleteVersion(v.id)}>Delete This Version</Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
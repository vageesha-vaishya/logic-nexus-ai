import React, { useEffect, useMemo, useState } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import { useNavigate } from 'react-router-dom';
import { createQuotationVersionWithOptions, recordCustomerSelection, createBlankOption } from '@/integrations/supabase/carrierRatesActions';
import { VersionCard } from './quotation-versions/VersionCard';
import { VersionActions } from './quotation-versions/VersionActions';
import { EmptyState } from './quotation-versions/EmptyState';
import { VersionComparison } from './quotation-versions/VersionComparison';
import { CustomerSelectionDialog } from './quotation-versions/CustomerSelectionDialog';
import { Loader2 } from 'lucide-react';

type Version = {
  id: string;
  quote_id: string;
  version_number: number;
  kind: 'minor' | 'major';
  status: string | null;
  created_at: string;
  is_current?: boolean;
};

type Option = {
  id: string;
  quotation_version_id: string;
  option_name?: string | null;
  carrier_name: string;
  total_amount: number;
  currency: string;
  transit_time_days: number | null;
  total_buy?: number;
  total_sell?: number;
  margin_amount?: number;
  margin_percentage?: number;
};

export function QuotationVersionHistory({ quoteId }: { quoteId: string }) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [optionsByVersion, setOptionsByVersion] = useState<Record<string, Option[]>>({});
  const [loading, setLoading] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [franchiseId, setFranchiseId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [compareVersionIds, setCompareVersionIds] = useState<{ v1: string; v2: string } | null>(null);
  const [selectionDialogOpen, setSelectionDialogOpen] = useState(false);
  const [selectedVersionForCustomer, setSelectedVersionForCustomer] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      // Parallel fetch: current version ID and all versions
      const [quoteRes, versionsRes] = await Promise.all([
        supabase
          .from('quotes')
          .select('current_version_id')
          .eq('id', quoteId)
          .maybeSingle(),
        supabase
          .from('quotation_versions')
          .select('*')
          .eq('quote_id', quoteId)
          .order('version_number', { ascending: false })
      ]);

      const quoteData = quoteRes.data;
      const vs = versionsRes.data;
      const vErr = versionsRes.error;

      if (vErr) throw vErr;

      const currentVersionId = quoteData?.current_version_id;

      // Mark current version
      const versionsWithCurrent = (vs ?? []).map(v => ({
        ...v,
        is_current: v.id === currentVersionId,
      })) as Version[];

      const versionIds = versionsWithCurrent.map((v: any) => v.id);
      if (versionIds.length > 0) {
        const { data: opts, error: oErr } = await scopedDb
          .from('quotation_version_options')
          .select(`
            id,
            quotation_version_id,
            carrier_rate_id,
            option_name,
            total_buy,
            total_sell,
            total_amount,
            margin_amount,
            margin_percentage
          `)
          .in('quotation_version_id', versionIds);
        if (oErr) throw oErr;
        const carrierRateIds = (opts ?? []).map((o: any) => o.carrier_rate_id).filter(Boolean);
        const rateMap: Record<string, any> = {};
        if (carrierRateIds.length > 0) {
          const { data: rates, error: rErr } = await scopedDb
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
            total_amount: Number(o.total_amount ?? r.base_rate ?? 0),
            currency: r.currency || 'USD',
            transit_time_days: null,
            total_buy: o.total_buy ? Number(o.total_buy) : undefined,
            total_sell: o.total_sell ? Number(o.total_sell) : undefined,
            margin_amount: o.margin_amount ? Number(o.margin_amount) : undefined,
            margin_percentage: o.margin_percentage ? Number(o.margin_percentage) : undefined,
          };
          grouped[key] = grouped[key] || [];
          grouped[key].push(opt);
        });
        setOptionsByVersion(grouped);
      } else {
        setOptionsByVersion({});
      }
      setVersions(versionsWithCurrent);
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
      } catch {
        // ignore
      }
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
    setSelectedVersionForCustomer(versionId);
    setSelectionDialogOpen(true);
  };

  const handleConfirmSelection = async (optionId: string, reason: string) => {
    if (!tenantId || !userId || !selectedVersionForCustomer) return;
    try {
      await recordCustomerSelection(
        tenantId,
        quoteId,
        selectedVersionForCustomer,
        optionId,
        reason,
        userId,
        supabase as any,
      );
      toast({ title: 'Success', description: 'Customer selection recorded' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleCompare = (versionId: string) => {
    // If no comparison started, set first version
    if (!compareVersionIds) {
      setCompareVersionIds({ v1: versionId, v2: '' });
      toast({ 
        title: 'Select second version', 
        description: 'Click compare on another version to compare' 
      });
      return;
    }

    // If first version selected, set second and open comparison
    if (compareVersionIds.v1 && !compareVersionIds.v2) {
      setCompareVersionIds({ v1: compareVersionIds.v1, v2: versionId });
      return;
    }

    // Reset if already comparing
    setCompareVersionIds({ v1: versionId, v2: '' });
    toast({ 
      title: 'Select second version', 
      description: 'Click compare on another version to compare' 
    });
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
        const { error } = await scopedDb.from('quote_charges').delete().in('quote_option_id', b);
        if (error) throw error;
      }
      for (const b of chunk(quoteLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await scopedDb.from('quote_charges').delete().in('leg_id', b);
        if (error) throw error;
      }

      for (const b of chunk(quoteLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await scopedDb.from('quote_legs').delete().in('id', b);
        if (error) throw error;
      }
      for (const b of chunk(compLegIds, 1000)) {
        if (!b.length) continue;
        const { error } = await scopedDb.from('quotation_version_option_legs').delete().in('id', b);
        if (error) throw error;
      }

      for (const b of chunk(optionIds, 1000)) {
        if (!b.length) continue;
        const { error } = await scopedDb.from('quotation_version_options').delete().in('id', b);
        if (error) throw error;
      }
      for (const b of chunk(versionIds, 1000)) {
        if (!b.length) continue;
        const { error } = await scopedDb.from('quotation_versions').delete().in('id', b);
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

  const handleSetCurrent = async (versionId: string) => {
    try {
      const { error } = await scopedDb.rpc('set_current_version', {
        p_version_id: versionId,
      });
      if (error) throw error;
      toast({ title: 'Success', description: 'Current version updated' });
      await load();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quotation Versions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <VersionActions
          loading={loading}
          onCreateMinor={() => createVersion('minor')}
          onCreateMajor={() => createVersion('major')}
          onDeleteMinor={() => deleteByKind('minor')}
          onDeleteMajor={() => deleteByKind('major')}
        />

        {loading && versions.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : versions.length === 0 ? (
          <EmptyState onCreateMinor={() => createVersion('minor')} loading={loading} />
        ) : (
          <div className="space-y-4">
            {versions.map((version) => (
              <VersionCard
                key={version.id}
                version={version}
                options={optionsByVersion[version.id] ?? []}
                quoteId={quoteId}
                onCreateOption={createNewOption}
                onEditOption={(vId, optId) =>
                  navigate(`/dashboard/multimodal-quote?quoteId=${quoteId}&versionId=${vId}&optionId=${optId}`)
                }
                onSelectOption={selectOption}
                onDeleteVersion={deleteVersion}
                onSetCurrent={handleSetCurrent}
                onStatusChange={load}
                onCompare={handleCompare}
                loading={loading}
              />
            ))}
          </div>
        )}

        {/* Version Comparison Dialog */}
        {compareVersionIds?.v1 && compareVersionIds?.v2 && (
          <VersionComparison
            open={true}
            onClose={() => setCompareVersionIds(null)}
            version1Id={compareVersionIds.v1}
            version2Id={compareVersionIds.v2}
          />
        )}

        {/* Customer Selection Dialog */}
        <CustomerSelectionDialog
          open={selectionDialogOpen}
          onClose={() => {
            setSelectionDialogOpen(false);
            setSelectedVersionForCustomer(null);
          }}
          versionId={selectedVersionForCustomer || ''}
          options={selectedVersionForCustomer ? (optionsByVersion[selectedVersionForCustomer] || []) : []}
          onConfirm={handleConfirmSelection}
        />
      </CardContent>
    </Card>
  );
}

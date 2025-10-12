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

  const load = async () => {
    setLoading(true);
    try {
      const { data: vs, error: vErr } = await supabase
        .from('quotation_versions')
        .select('id, quote_id, version_number, kind, status, created_at')
        .eq('quote_id', quoteId)
        .order('version_number', { ascending: false });
      if (vErr) throw vErr;
      const versionIds = (vs ?? []).map((v: any) => v.id);
      if (versionIds.length > 0) {
        const { data: opts, error: oErr } = await supabase
          .from('quotation_version_options')
          .select('*')
          .in('quotation_version_id', versionIds);
        if (oErr) throw oErr;
        const grouped: Record<string, Option[]> = {};
        (opts ?? []).forEach((o: any) => {
          const key = o.quotation_version_id;
          grouped[key] = grouped[key] || [];
          grouped[key].push(o as Option);
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
    load();
  }, [quoteId]);

  const latestVersionNumber = useMemo(
    () => (versions[0]?.version_number ?? 0),
    [versions]
  );

  const createVersion = async (kind: 'minor' | 'major') => {
    try {
      // Get current user and tenant context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get quote to find tenant_id
      const { data: quote, error: quoteErr } = await supabase
        .from('quotes')
        .select('tenant_id')
        .eq('id', quoteId)
        .single();
      if (quoteErr) throw quoteErr;
      if (!quote) throw new Error('Quote not found');

      const nextNumber = kind === 'minor' ? latestVersionNumber + 1 : 1;
      
      // Create version with empty carrier_rate_ids for now (can be populated later)
      const res = await createQuotationVersionWithOptions(
        quote.tenant_id,
        quoteId,
        [], // Empty carrier rates for now
        { 
          version_number: nextNumber, 
          kind,
          created_by: user.id 
        }
      );
      
      toast({ title: `${kind === 'minor' ? 'Minor' : 'Major'} version created` });
      await load();
    } catch (e: any) {
      toast({ title: 'Version creation failed', description: e.message, variant: 'destructive' });
    }
  };

  const selectOption = async (versionId: string, optionId: string) => {
    try {
      // Get current user and quote context
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Get quote to find tenant_id
      const { data: quote, error: quoteErr } = await supabase
        .from('quotes')
        .select('tenant_id')
        .eq('id', quoteId)
        .single();
      if (quoteErr) throw quoteErr;
      if (!quote) throw new Error('Quote not found');

      await recordCustomerSelection(
        quote.tenant_id,
        quoteId,
        versionId,
        optionId,
        null,
        user.id
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
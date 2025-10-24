// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHeader, TableRow } from '@/components/ui/table';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type SequenceRow = {
  period_key: string;
  last_sequence: number;
};

type TenantConfig = {
  prefix: string;
  reset_policy: 'none' | 'daily' | 'monthly' | 'yearly';
};

type FranchiseConfig = TenantConfig;

function currentPeriodKey(policy: TenantConfig['reset_policy']): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  switch (policy) {
    case 'daily':
      return `${year}-${month}-${day}`;
    case 'monthly':
      return `${year}-${month}`;
    case 'yearly':
      return `${year}`;
    case 'none':
    default:
      return 'none';
  }
}

type Props = { tenantIdOverride?: string; franchiseIdOverride?: string };

export default function SequencesAndPreview({ tenantIdOverride, franchiseIdOverride }: Props) {
  const { supabase, context } = useCRM();
  const tenantId = tenantIdOverride ?? context?.tenantId ?? null;
  const franchiseId = franchiseIdOverride ?? context?.franchiseId ?? null;
  const [tenantCfg, setTenantCfg] = useState<TenantConfig | null>(null);
  const [franchiseCfg, setFranchiseCfg] = useState<FranchiseConfig | null>(null);
  const [tenantSeq, setTenantSeq] = useState<SequenceRow | null>(null);
  const [franchiseSeq, setFranchiseSeq] = useState<SequenceRow | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const canPreview = useMemo(() => !!tenantId || !!franchiseId, [tenantId, franchiseId]);

  useEffect(() => {
    const load = async () => {
      try {
        if (tenantId) {
          const { data: tcfg, error: tcfgErr } = await supabase
            .from('quote_number_config_tenant')
            .select('prefix,reset_policy')
            .eq('tenant_id', tenantId)
            .maybeSingle();
          if (tcfgErr) throw tcfgErr;
          if (tcfg) setTenantCfg(tcfg as TenantConfig);

          const periodKey = currentPeriodKey((tcfg as TenantConfig)?.reset_policy || 'none');
          const { data: tseq } = await supabase
            .from('quote_number_sequences')
            .select('period_key,last_sequence')
            .eq('tenant_id', tenantId)
            .is('franchise_id', null)
            .eq('period_key', periodKey)
            .maybeSingle();
          if (tseq) setTenantSeq(tseq as SequenceRow);
        }

        if (franchiseId && tenantId) {
          const { data: fcfg } = await supabase
            .from('quote_number_config_franchise')
            .select('prefix,reset_policy')
            .eq('tenant_id', tenantId)
            .eq('franchise_id', franchiseId)
            .maybeSingle();
          if (fcfg) setFranchiseCfg(fcfg as FranchiseConfig);

          const periodKey = currentPeriodKey((fcfg as FranchiseConfig)?.reset_policy || tenantCfg?.reset_policy || 'none');
          const { data: fseq } = await supabase
            .from('quote_number_sequences')
            .select('period_key,last_sequence')
            .eq('tenant_id', tenantId)
            .eq('franchise_id', franchiseId)
            .eq('period_key', periodKey)
            .maybeSingle();
          if (fseq) setFranchiseSeq(fseq as SequenceRow);
        }
      } catch (err: any) {
        toast.error('Failed to load sequences', { description: err.message });
      }
    };
    load();
  }, [tenantId, franchiseId]);

  const handlePreview = async () => {
    if (!canPreview) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('preview_next_quote_number', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
      });
      if (error) throw error;
      const next = typeof data === 'string' ? data : String(data);
      setPreview(next);
      toast.success('Preview generated');
    } catch (err: any) {
      toast.error('Preview failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sequences & Preview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="font-medium mb-2">Tenant Sequence</div>
            {tenantId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Period</TableCell>
                    <TableCell className="font-medium">Last Sequence</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{tenantSeq?.period_key ?? '-'}</TableCell>
                    <TableCell>{tenantSeq?.last_sequence ?? '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No tenant context available.</p>
            )}
          </div>

          <div>
            <div className="font-medium mb-2">Franchise Sequence</div>
            {franchiseId ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableCell className="font-medium">Period</TableCell>
                    <TableCell className="font-medium">Last Sequence</TableCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>{franchiseSeq?.period_key ?? '-'}</TableCell>
                    <TableCell>{franchiseSeq?.last_sequence ?? '-'}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No franchise context available.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button disabled={!canPreview || loading} onClick={handlePreview}>Preview Next Quote Number</Button>
          {preview && <div className="text-sm text-muted-foreground">Next: <span className="font-medium">{preview}</span></div>}
        </div>
      </CardContent>
    </Card>
  );
}
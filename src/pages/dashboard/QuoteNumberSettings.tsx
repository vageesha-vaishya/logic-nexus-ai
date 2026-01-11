import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ResetPolicy = 'none' | 'daily' | 'monthly' | 'yearly';

export default function QuoteNumberSettings() {
  const { scopedDb, context, supabase } = useCRM();
  const tenantId = context.tenantId;
  const franchiseId = context.franchiseId || null;

  const [tenantPrefix, setTenantPrefix] = useState('QUO');
  const [tenantPolicy, setTenantPolicy] = useState<ResetPolicy>('daily');
  const [franchisePrefix, setFranchisePrefix] = useState('QUO');
  const [franchisePolicy, setFranchisePolicy] = useState<ResetPolicy>('daily');
  const [previewNext, setPreviewNext] = useState<string>('');
  const [savingTenant, setSavingTenant] = useState(false);
  const [savingFranchise, setSavingFranchise] = useState(false);

  const loadConfig = async () => {
    if (!tenantId) return;
    try {
      const { data: tenantCfg } = await scopedDb
        .from('quote_number_config_tenant')
        .select('prefix, reset_policy')
        .single();
      if (tenantCfg) {
        setTenantPrefix(((tenantCfg as any).prefix as string) || 'QUO');
        setTenantPolicy((((tenantCfg as any).reset_policy as ResetPolicy) || 'none') as ResetPolicy);
      }

      if (franchiseId) {
        const { data: franchiseCfg } = await scopedDb
          .from('quote_number_config_franchise')
          .select('prefix, reset_policy')
          .single();
        if (franchiseCfg) {
          setFranchisePrefix(((franchiseCfg as any).prefix as string) || 'QUO');
          setFranchisePolicy((((franchiseCfg as any).reset_policy as ResetPolicy) || 'none') as ResetPolicy);
        }
      }

      const { data: previewRes, error: previewErr } = await scopedDb.rpc('preview_next_quote_number', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
      });
      if (!previewErr) setPreviewNext(typeof previewRes === 'string' ? previewRes : String(previewRes ?? ''));
    } catch (e: any) {
      console.error('Load config failed', e);
    }
  };

  useEffect(() => {
    loadConfig();
  }, [tenantId, franchiseId]);

  const saveTenant = async () => {
    if (!tenantId) return;
    const prefix = (tenantPrefix || '').toUpperCase();
    if (prefix.length !== 3) {
      toast.error('Prefix must be exactly 3 characters');
      return;
    }
    setSavingTenant(true);
    try {
      const { data: existing, error: loadErr } = await scopedDb
        .from('quote_number_config_tenant')
        .select('tenant_id')
        .maybeSingle();
      if (loadErr) throw loadErr;

      if (existing) {
        const { error: updErr } = await scopedDb
          .from('quote_number_config_tenant')
          .update({ prefix, reset_policy: tenantPolicy })
          .eq('tenant_id', tenantId); // scopedDb will also inject tenant_id, but keeping eq is safe or redundant. Ideally remove if safe.
          // Actually scopedDb updates are scoped. If I don't provide eq, it updates all rows for the tenant?
          // Usually scopedDb.update applies to the scope. Since it's a config table per tenant (likely 1 row per tenant), it should be fine.
          // But maybeSingle found it.
          // Let's remove explicit eq('tenant_id', tenantId) as scopedDb handles it.
          
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await scopedDb
          .from('quote_number_config_tenant')
          .insert([{ prefix, reset_policy: tenantPolicy }]); // Removed tenant_id from insert, scopedDb should inject it.
        if (insErr) throw insErr;
      }
      toast.success('Tenant quote numbering saved');
      await loadConfig();
    } catch (e: any) {
      toast.error('Failed to save tenant config', { description: e?.message });
    } finally {
      setSavingTenant(false);
    }
  };

  const saveFranchise = async () => {
    if (!tenantId || !franchiseId) return;
    const prefix = (franchisePrefix || '').toUpperCase();
    if (prefix.length !== 3) {
      toast.error('Prefix must be exactly 3 characters');
      return;
    }
    setSavingFranchise(true);
    try {
      const { data: existing, error: loadErr } = await scopedDb
        .from('quote_number_config_franchise')
        .select('tenant_id,franchise_id')
        .maybeSingle();
      if (loadErr) throw loadErr;

      if (existing) {
        const { error: updErr } = await scopedDb
          .from('quote_number_config_franchise')
          .update({ prefix, reset_policy: franchisePolicy });
        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await scopedDb
          .from('quote_number_config_franchise')
          .insert([{ prefix, reset_policy: franchisePolicy }]);
        if (insErr) throw insErr;
      }
      toast.success('Franchise quote numbering saved');
      await loadConfig();
    } catch (e: any) {
      toast.error('Failed to save franchise config', { description: e?.message });
    } finally {
      setSavingFranchise(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6 max-w-3xl">
        <div>
          <h1 className="text-3xl font-bold">Quote Numbering</h1>
          <p className="text-muted-foreground">Configure prefixes and reset policies per tenant or franchise.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>Next quote number based on current settings</CardDescription>
          </CardHeader>
          <CardContent>
            <Input readOnly value={previewNext || '—'} />
            <div className="mt-2">
              <Button variant="secondary" onClick={loadConfig}>Refresh Preview</Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Settings</CardTitle>
            <CardDescription>Default prefix and reset policy for the tenant</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Prefix (3 chars)</label>
              <Input maxLength={3} value={tenantPrefix} onChange={(e) => setTenantPrefix(e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Reset policy</label>
              <Select value={tenantPolicy} onValueChange={(v) => setTenantPolicy(v as ResetPolicy)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={saveTenant} disabled={savingTenant}>Save Tenant Settings</Button>
          </CardContent>
        </Card>

        {franchiseId && (
          <Card>
            <CardHeader>
              <CardTitle>Franchise Settings</CardTitle>
              <CardDescription>Override for the current franchise</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
              <label className="text-sm font-medium">Prefix (3 chars)</label>
              <Input maxLength={3} value={franchisePrefix} onChange={(e) => setFranchisePrefix(e.target.value.toUpperCase())} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Reset policy</label>
                <Select value={franchisePolicy} onValueChange={(v) => setFranchisePolicy(v as ResetPolicy)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={saveFranchise} disabled={savingFranchise}>Save Franchise Settings</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
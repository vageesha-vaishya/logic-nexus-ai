import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

type ResetPolicy = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'per_customer';

type TenantConfig = {
  tenant_id: string;
  prefix: string | null;
  suffix: string | null;
  start_number: number | null;
  reset_policy: ResetPolicy | null;
  allow_manual_override: boolean | null;
  last_reset_bucket: string | null;
};

const resetPolicies: ResetPolicy[] = ['none', 'daily', 'weekly', 'monthly', 'yearly', 'per_customer'];

type Props = { tenantIdOverride?: string };

export default function TenantConfigForm({ tenantIdOverride }: Props) {
  const { supabase, context } = useCRM();
  const tenantId = tenantIdOverride ?? context?.tenantId ?? null;

  const [loading, setLoading] = useState(false);
  const [config, setConfig] = useState<TenantConfig | null>(null);
  const [form, setForm] = useState<{
    prefix: string;
    suffix: string;
    start_number: number;
    reset_policy: ResetPolicy;
    allow_manual_override: boolean;
    last_reset_bucket: string | null;
  }>({
    prefix: '',
    suffix: '',
    start_number: 1,
    reset_policy: 'none',
    allow_manual_override: false,
    last_reset_bucket: null,
  });

  useEffect(() => {
    const load = async () => {
      if (!tenantId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('quote_number_config_tenant')
          .select('*')
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (error) throw error;
        if (data) {
          const cfg = data as TenantConfig;
          setConfig(cfg);
          setForm({
            prefix: cfg.prefix || '',
            suffix: cfg.suffix || '',
            start_number: cfg.start_number ?? 1,
            reset_policy: (cfg.reset_policy || 'none') as ResetPolicy,
            allow_manual_override: !!cfg.allow_manual_override,
            last_reset_bucket: cfg.last_reset_bucket ?? null,
          });
        } else {
          setConfig(null);
        }
      } catch (err: any) {
        toast.error('Failed to load tenant config', { description: err.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenantId]);

  const onChange = (key: keyof typeof form, value: any) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (!tenantId) {
      toast.error('Missing tenant context');
      return;
    }
    setLoading(true);
    try {
      if (config) {
        const { error } = await supabase
          .from('quote_number_config_tenant')
          .update({ ...form })
          .eq('tenant_id', tenantId);
        if (error) throw error;
        toast.success('Tenant config updated');
      } else {
        const { error } = await supabase
          .from('quote_number_config_tenant')
          .insert([{ tenant_id: tenantId, ...form }]);
        if (error) throw error;
        toast.success('Tenant config created');
      }
      const { data } = await supabase
        .from('quote_number_config_tenant')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (data) setConfig(data as TenantConfig);
    } catch (err: any) {
      toast.error('Save failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!tenantId || !config) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('quote_number_config_tenant')
        .delete()
        .eq('tenant_id', tenantId);
      if (error) throw error;
      setConfig(null);
      toast.success('Tenant config deleted');
      setForm((f) => ({ ...f, last_reset_bucket: null }));
    } catch (err: any) {
      toast.error('Delete failed', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tenant Config</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!tenantId ? (
          <p className="text-muted-foreground">No tenant context available.</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Prefix (3 chars)</Label>
              <Input maxLength={3} value={form.prefix} onChange={(e) => onChange('prefix', e.target.value.toUpperCase())} />
            </div>
            <div className="space-y-2">
              <Label>Suffix</Label>
              <Input value={form.suffix} onChange={(e) => onChange('suffix', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Start Number</Label>
              <Input type="number" value={form.start_number} onChange={(e) => onChange('start_number', Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-2">
              <Label>Reset Policy</Label>
              <Select value={form.reset_policy} onValueChange={(v) => onChange('reset_policy', v as ResetPolicy)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reset policy" />
                </SelectTrigger>
                <SelectContent>
                  {resetPolicies.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Allow Manual Override</Label>
              <div className="flex items-center gap-3">
                <Switch checked={form.allow_manual_override} onCheckedChange={(v) => onChange('allow_manual_override', v)} />
                <span className="text-sm text-muted-foreground">Permit manual entry of quote numbers</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Last Reset Bucket</Label>
              <Input value={form.last_reset_bucket || ''} readOnly />
            </div>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Button disabled={!tenantId || loading} onClick={handleSave}>{config ? 'Save Changes' : 'Create Config'}</Button>
          <Button variant="destructive" disabled={!config || loading} onClick={handleDelete}>Delete</Button>
        </div>
      </CardContent>
    </Card>
  );
}
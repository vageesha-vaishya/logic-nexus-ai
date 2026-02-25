import { useEffect, useMemo, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';

type Provider = 'whatsapp' | 'x' | 'telegram' | 'linkedin' | 'web';

interface ChannelAccount {
  id: string;
  tenant_id: string;
  provider: Provider;
  credentials: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function ChannelIntegrations() {
  const [accounts, setAccounts] = useState<ChannelAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [provider, setProvider] = useState<Provider>('whatsapp');
  const [credentialsText, setCredentialsText] = useState('');
  const [saving, setSaving] = useState(false);
  const { roles } = useAuth();
  const { toast } = useToast();
  const { context } = useCRM();
  const dev = import.meta.env.DEV;
  const projectUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co').replace(/\/$/, '');
  const recommendedUrl = useMemo(() => {
    const name =
      provider === 'whatsapp' ? 'ingest-whatsapp' :
      provider === 'telegram' ? 'ingest-telegram' :
      provider === 'x' ? 'ingest-x' :
      provider === 'linkedin' ? 'ingest-linkedin' :
      'ingest-web';
    return dev ? `/functions/v1/${name}` : `${projectUrl}/functions/v1/${name}`;
  }, [provider, dev, projectUrl]);

  const tenantId = useMemo(() => {
    // Prefer CRM context (supports Platform Admin scope switching)
    if (context.tenantId) return context.tenantId;
    const admin = roles.find(r => r.role === 'tenant_admin' && r.tenant_id);
    return admin?.tenant_id || roles.find(r => r.tenant_id)?.tenant_id || null;
  }, [roles, context.tenantId]);

  const fetchAccounts = async () => {
    try {
      setLoading(true);
      const { data, error } = await (supabase as any)
        .from('channel_accounts')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setAccounts(data || []);
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const createAccount = async () => {
    try {
      setSaving(true);
      if (!tenantId) throw new Error('No tenant context');
      let creds: any = {};
      try {
        creds = credentialsText ? JSON.parse(credentialsText) : {};
      } catch {
        throw new Error('Invalid credentials JSON');
      }
      // Prefer RPC to bypass RLS via security definer function
      const { data: rpcId, error: rpcError } = await (supabase as any).rpc('create_channel_account', {
        p_tenant_id: tenantId,
        p_provider: provider,
        p_credentials: creds,
        p_active: true,
      });
      if (rpcError) {
        // Fallback to direct insert; will fail if RLS not updated
        const { error } = await (supabase as any)
          .from('channel_accounts')
          .insert({
            tenant_id: tenantId,
            provider,
            credentials: creds,
            is_active: true,
          });
        if (error) {
          throw new Error(`${error.message}. Ensure DB migrations are applied (create_channel_account RPC & platform admin policy).`);
        }
      }
      setCredentialsText('');
      toast({ title: 'Saved', description: 'Channel account created' });
      fetchAccounts();
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, isActive: boolean) => {
    try {
      const { error } = await (supabase as any)
        .from('channel_accounts')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
      setAccounts(prev => prev.map(a => (a.id === id ? { ...a, is_active: isActive } : a)));
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, []);

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle>Channel Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label className="text-sm">Provider</label>
              <Select value={provider} onValueChange={(v) => setProvider(v as Provider)}>
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="web">Web</SelectItem>
                  <SelectItem value="telegram">Telegram</SelectItem>
                  <SelectItem value="x">X</SelectItem>
                  <SelectItem value="linkedin">LinkedIn</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <label className="text-sm">Credentials (JSON)</label>
              <Input
                value={credentialsText}
                onChange={(e) => setCredentialsText(e.target.value)}
                placeholder='{"api_key":"...", "secret":"..."}'
                className="mt-2"
              />
              <div className="text-xs text-muted-foreground mt-2">
                Webhook URL for this provider: <span className="font-mono">{recommendedUrl}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={createAccount} disabled={saving || !tenantId}>
              {saving ? 'Saving' : 'Add Integration'}
            </Button>
            {!tenantId && (
              <span className="text-xs text-muted-foreground">
                Select a tenant using the scope switcher (top bar) before adding integrations.
              </span>
            )}
          </div>
        </CardContent>
      </Card>
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Existing Integrations</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Active</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="capitalize">{a.provider}</TableCell>
                  <TableCell>
                    <Switch checked={a.is_active} onCheckedChange={(c) => toggleActive(a.id, c)} />
                  </TableCell>
                  <TableCell>{new Date(a.created_at).toLocaleString()}</TableCell>
                  <TableCell>{new Date(a.updated_at).toLocaleString()}</TableCell>
                </TableRow>
              ))}
              {accounts.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={4} className="text-sm text-muted-foreground">No integrations</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
}

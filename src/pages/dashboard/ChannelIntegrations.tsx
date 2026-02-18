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

  const tenantId = useMemo(() => {
    const admin = roles.find(r => r.role === 'tenant_admin' && r.tenant_id);
    return admin?.tenant_id || roles.find(r => r.tenant_id)?.tenant_id || null;
  }, [roles]);

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
      const { error } = await (supabase as any)
        .from('channel_accounts')
        .insert({
          tenant_id: tenantId,
          provider,
          credentials: creds,
          is_active: true,
        });
      if (error) throw error;
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
            </div>
          </div>
          <Button onClick={createAccount} disabled={saving}>{saving ? 'Saving' : 'Add Integration'}</Button>
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

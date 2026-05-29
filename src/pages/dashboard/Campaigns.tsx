import { useEffect, useMemo, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';

type CampaignChannel = 'email' | 'sms' | 'whatsapp' | 'push' | 'social' | 'phone' | 'multi' | 'other';
type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'archived';

interface Campaign {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  channel: CampaignChannel;
  status: CampaignStatus;
  start_at: string | null;
  end_at: string | null;
  target_count: number;
  sent_count: number;
  delivered_count: number;
  opened_count: number;
  clicked_count: number;
  converted_count: number;
  created_at: string;
}

const STATUS_VARIANT: Record<CampaignStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  scheduled: 'secondary',
  active: 'default',
  paused: 'secondary',
  completed: 'secondary',
  archived: 'outline',
};

export default function Campaigns() {
  const { supabase, context } = useCRM();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [form, setForm] = useState({
    name: '',
    description: '',
    channel: 'email' as CampaignChannel,
    status: 'draft' as CampaignStatus,
  });

  const tenantId = context?.tenant_id ?? null;

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_campaigns')
        .select('id, tenant_id, name, description, channel, status, start_at, end_at, target_count, sent_count, delivered_count, opened_count, clicked_count, converted_count, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setCampaigns((data ?? []) as Campaign[]);
    } catch (e) {
      logger.error({ event: 'campaigns.list.failed', error: String(e) });
      toast.error('Failed to load campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return campaigns.filter((c) => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (q && !c.name.toLowerCase().includes(q) && !(c.description ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [campaigns, search, statusFilter]);

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!tenantId) {
      toast.error('No tenant scope — cannot create campaign');
      return;
    }
    setCreating(true);
    try {
      const { error } = await supabase.from('v_campaigns').insert({
        tenant_id: tenantId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        channel: form.channel,
        status: form.status,
      });
      if (error) throw error;
      toast.success('Campaign created');
      setDialogOpen(false);
      setForm({ name: '', description: '', channel: 'email', status: 'draft' });
      fetchCampaigns();
    } catch (e) {
      logger.error({ event: 'campaigns.create.failed', error: String(e) });
      toast.error('Failed to create campaign');
    } finally {
      setCreating(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground">Marketing campaigns across email, SMS, WhatsApp, and more.</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                New campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create campaign</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="campaign-name">Name</Label>
                  <Input
                    id="campaign-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Q3 winback push"
                  />
                </div>
                <div>
                  <Label htmlFor="campaign-description">Description</Label>
                  <Textarea
                    id="campaign-description"
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    placeholder="Re-engage dormant accounts with personalised offers"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Channel</Label>
                    <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v as CampaignChannel }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="email">Email</SelectItem>
                        <SelectItem value="sms">SMS</SelectItem>
                        <SelectItem value="whatsapp">WhatsApp</SelectItem>
                        <SelectItem value="push">Push</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="phone">Phone</SelectItem>
                        <SelectItem value="multi">Multi-channel</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CampaignStatus }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="scheduled">Scheduled</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="paused">Paused</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={creating}>Cancel</Button>
                <Button onClick={handleCreate} disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>All campaigns</CardTitle>
              <div className="flex gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="pl-8 w-[200px]"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | CampaignStatus)}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {campaigns.length === 0 ? 'No campaigns yet — create your first one.' : 'No campaigns match the current filters.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Channel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Sent</TableHead>
                    <TableHead className="text-right">Opened</TableHead>
                    <TableHead className="text-right">Clicked</TableHead>
                    <TableHead className="text-right">Converted</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        {c.description && <div className="text-xs text-muted-foreground line-clamp-1">{c.description}</div>}
                      </TableCell>
                      <TableCell><Badge variant="outline">{c.channel}</Badge></TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[c.status]}>{c.status}</Badge></TableCell>
                      <TableCell className="text-right tabular-nums">{c.sent_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.opened_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.clicked_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.converted_count}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{format(new Date(c.created_at), 'MMM d, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

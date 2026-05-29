import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
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
import { useCRM } from '@/hooks/useCRM';
import { logger } from '@/lib/logger';

type CommissionRuleStatus = 'active' | 'inactive';

interface CommissionRule {
  id: string;
  tenant_id: string;
  name: string;
  rate_percent: number;
  account_id: string | null;
  owner_id: string | null;
  effective_from: string;
  effective_to: string | null;
  priority: number;
  status: CommissionRuleStatus;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface RuleFormState {
  name: string;
  rate_percent: string;
  owner_id: string;
  account_id: string;
  priority: string;
  effective_to: string;
  status: CommissionRuleStatus;
}

const EMPTY_FORM: RuleFormState = {
  name: '',
  rate_percent: '5',
  owner_id: '',
  account_id: '',
  priority: '100',
  effective_to: '',
  status: 'active',
};

export default function CommissionRules() {
  const { supabase, context } = useCRM();
  const tenantId = context?.tenant_id ?? null;

  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CommissionRuleStatus>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<RuleFormState>(EMPTY_FORM);

  const fetchRules = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('v_commission_rules')
        .select('*')
        .order('priority', { ascending: true })
        .order('effective_from', { ascending: false });
      if (error) throw error;
      setRules((data ?? []) as CommissionRule[]);
    } catch (e) {
      logger.error({ event: 'commission_rules.list.failed', error: String(e) });
      toast.error('Failed to load commission rules');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRules();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rules.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (q && !r.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rules, search, statusFilter]);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (rule: CommissionRule) => {
    setEditingId(rule.id);
    setForm({
      name: rule.name,
      rate_percent: String(rule.rate_percent),
      owner_id: rule.owner_id ?? '',
      account_id: rule.account_id ?? '',
      priority: String(rule.priority),
      effective_to: rule.effective_to ? rule.effective_to.slice(0, 10) : '',
      status: rule.status,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const rate = Number.parseFloat(form.rate_percent);
    const priority = Number.parseInt(form.priority, 10);
    if (!name) {
      toast.error('Name is required');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
      toast.error('Rate must be between 0 and 100');
      return;
    }
    if (!Number.isFinite(priority)) {
      toast.error('Priority must be a number');
      return;
    }
    if (!tenantId) {
      toast.error('No tenant scope — cannot save rule');
      return;
    }

    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      name,
      rate_percent: rate,
      owner_id: form.owner_id.trim() || null,
      account_id: form.account_id.trim() || null,
      priority,
      status: form.status,
      effective_to: form.effective_to ? new Date(form.effective_to).toISOString() : null,
    };

    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('v_commission_rules').update(payload).eq('id', editingId);
        if (error) throw error;
        toast.success('Rule updated');
      } else {
        const { error } = await supabase.from('v_commission_rules').insert(payload);
        if (error) throw error;
        toast.success('Rule created');
      }
      setDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      fetchRules();
    } catch (e) {
      logger.error({ event: 'commission_rules.save.failed', error: String(e) });
      toast.error(editingId ? 'Failed to update rule' : 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this commission rule? Existing commissions stay; the rule simply stops applying.')) return;
    try {
      const { error } = await supabase.from('v_commission_rules').delete().eq('id', id);
      if (error) throw error;
      toast.success('Rule deleted');
      fetchRules();
    } catch (e) {
      logger.error({ event: 'commission_rules.delete.failed', error: String(e) });
      toast.error('Failed to delete rule');
    }
  };

  const scopeLabel = (r: CommissionRule): string => {
    const parts: string[] = [];
    if (r.owner_id) parts.push(`owner=${r.owner_id.slice(0, 8)}…`);
    if (r.account_id) parts.push(`account=${r.account_id.slice(0, 8)}…`);
    return parts.length === 0 ? 'wildcard' : parts.join(' + ');
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Commission Rules</h1>
            <p className="text-muted-foreground">
              Per-tenant commission rates. The cross-module consumer picks the best-matching active rule when an opportunity wins;
              with no rule, the env default (currently 5%) applies.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}>
                <Plus className="mr-2 h-4 w-4" />
                New rule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Edit rule' : 'Create rule'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="rule-name">Name</Label>
                  <Input
                    id="rule-name"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Default 5%"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rule-rate">Rate (%)</Label>
                    <Input
                      id="rule-rate"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={form.rate_percent}
                      onChange={(e) => setForm((f) => ({ ...f, rate_percent: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="rule-priority">Priority</Label>
                    <Input
                      id="rule-priority"
                      type="number"
                      step="1"
                      value={form.priority}
                      onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">Lower wins ties.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rule-owner">Owner ID (optional)</Label>
                    <Input
                      id="rule-owner"
                      value={form.owner_id}
                      onChange={(e) => setForm((f) => ({ ...f, owner_id: e.target.value }))}
                      placeholder="uuid or blank for any"
                    />
                  </div>
                  <div>
                    <Label htmlFor="rule-account">Account ID (optional)</Label>
                    <Input
                      id="rule-account"
                      value={form.account_id}
                      onChange={(e) => setForm((f) => ({ ...f, account_id: e.target.value }))}
                      placeholder="uuid or blank for any"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="rule-effective-to">Effective until (optional)</Label>
                    <Input
                      id="rule-effective-to"
                      type="date"
                      value={form.effective_to}
                      onChange={(e) => setForm((f) => ({ ...f, effective_to: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v as CommissionRuleStatus }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Rules</CardTitle>
              <div className="flex gap-2">
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name…"
                  className="w-[200px]"
                />
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | CommissionRuleStatus)}>
                  <SelectTrigger className="w-[160px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
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
                {rules.length === 0
                  ? 'No rules yet — the env default of 5% applies to every commission.'
                  : 'No rules match the current filters.'}
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Rate</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Effective until</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.rate_percent}%</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{scopeLabel(r)}</TableCell>
                      <TableCell className="text-right tabular-nums">{r.priority}</TableCell>
                      <TableCell>
                        <Badge variant={r.status === 'active' ? 'default' : 'outline'}>{r.status}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.effective_to ? format(new Date(r.effective_to), 'MMM d, yyyy') : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(r)} aria-label="Edit rule">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(r.id)}
                            aria-label="Delete rule"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
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

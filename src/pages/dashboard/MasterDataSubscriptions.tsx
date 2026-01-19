import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { PlanCard } from '@/components/subscription/PlanCard';
import { UsageMetrics } from '@/components/subscription/UsageMetrics';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number | null;
  tier: string | null;
  features: any;
  limits: any;
  billing_period: string;
  is_active: boolean;
  plan_type: string;
  currency: string;
  sort_order: number | null;
}

interface Subscription {
  id: string;
  plan_id: string;
  status: string;
  current_period_start: string;
  current_period_end: string;
  trial_end: string | null;
  subscription_plans: Plan;
}

export default function MasterDataSubscriptions() {
  const { scopedDb, context, user } = useCRM();
  const { toast } = useToast();
  const [tab, setTab] = useState('plans');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlanDialog, setShowPlanDialog] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [planForm, setPlanForm] = useState<any>({
    name: '',
    slug: '',
    description: '',
    price_monthly: '',
    price_annual: '',
    tier: '',
    billing_period: 'monthly',
    plan_type: 'crm_base',
    currency: 'USD',
    is_active: true,
    sort_order: '',
    features: '[]',
    limits: '{"users":5}',
  });

  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loadingTenant, setLoadingTenant] = useState(false);

  useEffect(() => {
    loadPlans();
  }, []);

  useEffect(() => {
    if (tab === 'tenant') {
      loadTenantScopeData();
    }
  }, [tab, selectedTenantId, context.tenantId, context.isPlatformAdmin]);

  const resetPlanForm = () => {
    setEditingPlan(null);
    setPlanForm({
      name: '',
      slug: '',
      description: '',
      price_monthly: '',
      price_annual: '',
      tier: '',
      billing_period: 'monthly',
      plan_type: 'crm_base',
      currency: 'USD',
      is_active: true,
      sort_order: '',
      features: '[]',
      limits: '{"users":5}',
    });
  };

  const loadPlans = async () => {
    setLoadingPlans(true);
    try {
      const { data, error } = await scopedDb
        .from('subscription_plans', true)
        .select('*')
        .order('sort_order', { ascending: true })
        .order('price_monthly', { ascending: true });
      if (error) throw error;
      setPlans((data || []) as Plan[]);
    } catch (error: any) {
      toast({ title: 'Failed to load plans', description: error?.message || 'Error loading subscription plans', variant: 'destructive' });
    } finally {
      setLoadingPlans(false);
    }
  };

  const openCreatePlan = () => {
    resetPlanForm();
    setShowPlanDialog(true);
  };

  const openEditPlan = (plan: Plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      slug: plan.slug,
      description: plan.description || '',
      price_monthly: String(plan.price_monthly ?? ''),
      price_annual: plan.price_annual != null ? String(plan.price_annual) : '',
      tier: plan.tier || '',
      billing_period: plan.billing_period || 'monthly',
      plan_type: plan.plan_type || 'crm_base',
      currency: plan.currency || 'USD',
      is_active: plan.is_active,
      sort_order: plan.sort_order != null ? String(plan.sort_order) : '',
      features: JSON.stringify(plan.features ?? [], null, 2),
      limits: JSON.stringify(plan.limits ?? {}, null, 2),
    });
    setShowPlanDialog(true);
  };

  const parseJsonField = (value: string, fallback: any) => {
    if (!value || !value.trim()) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  };

  const handleSavePlan = async () => {
    try {
      const payload: any = {
        name: planForm.name.trim(),
        slug: planForm.slug.trim(),
        description: planForm.description.trim() || null,
        price_monthly: planForm.price_monthly ? Number(planForm.price_monthly) : 0,
        price_annual: planForm.price_annual ? Number(planForm.price_annual) : null,
        tier: planForm.tier.trim() || null,
        billing_period: planForm.billing_period || 'monthly',
        plan_type: planForm.plan_type || 'crm_base',
        currency: planForm.currency || 'USD',
        is_active: !!planForm.is_active,
        sort_order: planForm.sort_order ? Number(planForm.sort_order) : null,
        features: parseJsonField(planForm.features, []),
        limits: parseJsonField(planForm.limits, {}),
      };

      if (!payload.name || !payload.slug) {
        toast({ title: 'Validation error', description: 'Name and slug are required', variant: 'destructive' });
        return;
      }

      let error;
      if (editingPlan) {
        const res = await scopedDb
          .from('subscription_plans')
          .update(payload)
          .eq('id', editingPlan.id);
        error = res.error;
      } else {
        const res = await scopedDb
          .from('subscription_plans')
          .insert([payload]);
        error = res.error;
      }

      if (error) throw error;

      try {
        const userRes = await scopedDb.rpc('get_user_tenant_id', { check_user_id: user?.id || null });
        const actorTenantId = typeof userRes.data === 'string' ? userRes.data : null;
        await scopedDb.from('activities').insert({
          activity_type: 'system',
          status: 'completed',
          priority: 'low',
          subject: editingPlan ? 'Subscription plan updated' : 'Subscription plan created',
          description: editingPlan ? `Plan ${payload.name} updated` : `Plan ${payload.name} created`,
          tenant_id: actorTenantId,
          franchise_id: null,
        } as any);
      } catch {
      }

      toast({ title: 'Success', description: editingPlan ? 'Plan updated' : 'Plan created' });
      setShowPlanDialog(false);
      resetPlanForm();
      loadPlans();
    } catch (error: any) {
      toast({ title: 'Save failed', description: error?.message || 'Error saving plan', variant: 'destructive' });
    }
  };

  const handleDeletePlan = async (plan: Plan) => {
    try {
      const { error } = await scopedDb
        .from('subscription_plans')
        .delete()
        .eq('id', plan.id);
      if (error) throw error;

      try {
        const userRes = await scopedDb.rpc('get_user_tenant_id', { check_user_id: user?.id || null });
        const actorTenantId = typeof userRes.data === 'string' ? userRes.data : null;
        await scopedDb.from('activities').insert({
          activity_type: 'system',
          status: 'completed',
          priority: 'low',
          subject: 'Subscription plan deleted',
          description: `Plan ${plan.name} deleted`,
          tenant_id: actorTenantId,
          franchise_id: null,
        } as any);
      } catch {
      }

      toast({ title: 'Deleted', description: 'Plan deleted successfully' });
      loadPlans();
    } catch (error: any) {
      toast({ title: 'Delete failed', description: error?.message || 'Error deleting plan', variant: 'destructive' });
    }
  };

  const loadTenantScopeData = async () => {
    setLoadingTenant(true);
    try {
      const { data: planRows, error: planError } = await scopedDb
        .from('subscription_plans', true)
        .select('*')
        .eq('is_active', true)
        .eq('plan_type', 'crm_base')
        .order('price_monthly');
      if (planError) throw planError;
      setAvailablePlans((planRows || []) as Plan[]);

      if (context.isPlatformAdmin) {
        const { data: tenantRows, error: tenantError } = await scopedDb
          .from('tenants', true)
          .select('id, name')
          .eq('is_active', true)
          .order('name');
        if (tenantError) throw tenantError;
        setTenants(tenantRows || []);
      }

      const tenantScope = context.isPlatformAdmin ? selectedTenantId : context.tenantId;
      if (tenantScope) {
        const { data: subData, error: subError } = await scopedDb
          .from('tenant_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('tenant_id', tenantScope)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (subError) {
          setCurrentSubscription(null);
        } else {
          setCurrentSubscription(subData as any);
        }
      } else {
        setCurrentSubscription(null);
      }
    } catch (error) {
      setAvailablePlans([]);
      setCurrentSubscription(null);
    } finally {
      setLoadingTenant(false);
    }
  };

  const handleAssignPlanToTenant = async (planId: string) => {
    try {
      const selectedPlan = availablePlans.find(p => p.id === planId);
      if (!selectedPlan) return;
      if (!selectedPlan.is_active) {
        toast({ title: 'Unavailable', description: 'This plan is currently unavailable', variant: 'destructive' });
        return;
      }

      let effectiveTenantId: string | undefined = context.isPlatformAdmin
        ? (selectedTenantId ?? undefined)
        : context.tenantId;
      if (!effectiveTenantId && user?.id) {
        const { data: tid } = await scopedDb.rpc('get_user_tenant_id', { check_user_id: user.id });
        if (typeof tid === 'string') {
          effectiveTenantId = tid;
        }
      }

      if (!effectiveTenantId) {
        toast({ title: 'Select tenant', description: 'Select a tenant to assign a plan', variant: 'destructive' });
        return;
      }

      if (currentSubscription) {
        await scopedDb
          .from('tenant_subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', currentSubscription.id);
      }

      const { error } = await scopedDb
        .from('tenant_subscriptions')
        .insert([{
          tenant_id: effectiveTenantId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }]);

      if (error) throw error;

      const allowedTiers = ['free', 'basic', 'professional', 'enterprise'];
      const planTier = selectedPlan.tier || null;
      const derivedTier = planTier && allowedTiers.includes(planTier) ? planTier : null;

      try {
        await scopedDb
          .from('tenants')
          .update({ subscription_tier: derivedTier })
          .eq('id', effectiveTenantId);
      } catch {
      }

      try {
        await scopedDb.from('activities').insert({
          activity_type: 'system',
          status: 'completed',
          priority: 'low',
          subject: 'Tenant subscription updated',
          description: `Tenant subscription changed to plan ${selectedPlan.name}`,
          tenant_id: effectiveTenantId,
          franchise_id: null,
        } as any);
      } catch {
      }

      toast({ title: 'Plan assigned', description: 'Subscription updated successfully' });
      loadTenantScopeData();
    } catch (error: any) {
      toast({ title: 'Assignment failed', description: error?.message || 'Error assigning subscription plan', variant: 'destructive' });
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-500/10 text-green-500',
      trial: 'bg-blue-500/10 text-blue-500',
      past_due: 'bg-red-500/10 text-red-500',
      canceled: 'bg-gray-500/10 text-gray-500',
      expired: 'bg-gray-600/10 text-gray-600',
    };
    return colors[status] || 'bg-gray-500/10 text-gray-500';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription Master Data</h1>
          <p className="text-muted-foreground">Manage subscription plans and assignments for tenants</p>
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="plans">Plans Catalog</TabsTrigger>
            <TabsTrigger value="tenant">Tenant Assignments</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Subscription Plans</CardTitle>
                  <CardDescription>Create and manage subscription plans used across tenants and franchises</CardDescription>
                </div>
                <Dialog open={showPlanDialog} onOpenChange={setShowPlanDialog}>
                  <DialogTrigger asChild>
                    <Button onClick={openCreatePlan}>New Plan</Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'New Subscription Plan'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Input
                        placeholder="Name"
                        value={planForm.name}
                        onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                      />
                      <Input
                        placeholder="Slug"
                        value={planForm.slug}
                        onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                      />
                      <Input
                        placeholder="Monthly price"
                        type="number"
                        value={planForm.price_monthly}
                        onChange={(e) => setPlanForm({ ...planForm, price_monthly: e.target.value })}
                      />
                      <Input
                        placeholder="Annual price"
                        type="number"
                        value={planForm.price_annual}
                        onChange={(e) => setPlanForm({ ...planForm, price_annual: e.target.value })}
                      />
                      <Input
                        placeholder="Tier (free, basic, professional, enterprise, starter, business)"
                        value={planForm.tier}
                        onChange={(e) => setPlanForm({ ...planForm, tier: e.target.value })}
                      />
                      <Select
                        value={planForm.billing_period}
                        onValueChange={(v) => setPlanForm({ ...planForm, billing_period: v })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Billing period" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="annual">Annual</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input
                        placeholder="Currency"
                        value={planForm.currency}
                        onChange={(e) => setPlanForm({ ...planForm, currency: e.target.value })}
                      />
                      <Input
                        placeholder="Plan type"
                        value={planForm.plan_type}
                        onChange={(e) => setPlanForm({ ...planForm, plan_type: e.target.value })}
                      />
                      <Input
                        placeholder="Sort order"
                        type="number"
                        value={planForm.sort_order}
                        onChange={(e) => setPlanForm({ ...planForm, sort_order: e.target.value })}
                      />
                      <div className="flex items-center justify-between border rounded-md px-3 py-2">
                        <span className="text-sm">Active</span>
                        <Switch
                          checked={planForm.is_active}
                          onCheckedChange={(v) => setPlanForm({ ...planForm, is_active: v })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <Input
                          placeholder="Description"
                          value={planForm.description}
                          onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Features (JSON array)</label>
                        <textarea
                          className="w-full border rounded-md p-2 text-sm font-mono"
                          rows={4}
                          value={planForm.features}
                          onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-sm mb-1">Limits (JSON object)</label>
                        <textarea
                          className="w-full border rounded-md p-2 text-sm font-mono"
                          rows={4}
                          value={planForm.limits}
                          onChange={(e) => setPlanForm({ ...planForm, limits: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowPlanDialog(false)}>Cancel</Button>
                      <Button onClick={handleSavePlan}>{editingPlan ? 'Save changes' : 'Create plan'}</Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loadingPlans && (
                      <TableRow>
                        <TableCell colSpan={7}>Loading plans...</TableCell>
                      </TableRow>
                    )}
                    {!loadingPlans && plans.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-muted-foreground">
                          No subscription plans configured yet
                        </TableCell>
                      </TableRow>
                    )}
                    {!loadingPlans && plans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell>{plan.name}</TableCell>
                        <TableCell>{plan.slug}</TableCell>
                        <TableCell>{plan.tier || '-'}</TableCell>
                        <TableCell>{plan.billing_period}</TableCell>
                        <TableCell>
                          ${plan.price_monthly}
                        </TableCell>
                        <TableCell>
                          {plan.is_active ? (
                            <Badge className="bg-green-500/10 text-green-500">Active</Badge>
                          ) : (
                            <Badge variant="outline">Inactive</Badge>
                          )}
                        </TableCell>
                        <TableCell className="space-x-2 text-right">
                          <Button size="sm" variant="outline" onClick={() => openEditPlan(plan)}>
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDeletePlan(plan)}
                          >
                            Delete
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tenant" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Tenant Subscription Management</CardTitle>
                <CardDescription>Assign and manage subscription plans for tenants</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {context.isPlatformAdmin && (
                  <div className="flex items-center gap-3">
                    <Select
                      value={selectedTenantId || ''}
                      onValueChange={(v) => setSelectedTenantId(v)}
                    >
                      <SelectTrigger className="w-[280px]">
                        <SelectValue placeholder="Choose a tenant" />
                      </SelectTrigger>
                      <SelectContent>
                        {tenants.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!selectedTenantId && (
                      <span className="text-sm text-muted-foreground">
                        Select a tenant to view and change plan
                      </span>
                    )}
                  </div>
                )}

                {loadingTenant && (
                  <div className="text-sm text-muted-foreground">Loading subscription data...</div>
                )}

                {!loadingTenant && currentSubscription && (
                  <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{currentSubscription.subscription_plans.name}</div>
                        <Badge className={getStatusColor(currentSubscription.status)} variant="outline">
                          {currentSubscription.status}
                        </Badge>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          ${currentSubscription.subscription_plans.price_monthly}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          per {currentSubscription.subscription_plans.billing_period}
                        </p>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">Renewal Date</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm text-muted-foreground">
                          {new Date(currentSubscription.current_period_end).toLocaleString()}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {availablePlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrentPlan={currentSubscription?.plan_id === plan.id}
                      onSelect={() => handleAssignPlanToTenant(plan.id)}
                      showActions={true}
                    />
                  ))}
                </div>

                {context.tenantId && (
                  <UsageMetrics tenantId={context.tenantId} />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}


import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useCRM } from '@/hooks/useCRM';
import { useToast } from '@/hooks/use-toast';
import ActionsToolbar from '@/components/ui/ActionsToolbar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Calculator, Loader2 } from 'lucide-react';
import { calculateScaledPrice } from '@/utils/subscriptionScaling';

interface SubscriptionPlan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  plan_type: string;
  tier: string | null;
  billing_period: string;
  price_monthly: number;
  price_quarterly: number | null;
  price_annual: number | null;
  currency: string;
  features: any;
  limits: any;
  trial_period_days: number | null;
  deployment_model: string | null;
  supported_currencies: string[] | null;
  supported_languages: string[] | null;
  metadata: any;
  is_active: boolean;
  user_scaling_factor: number;
  min_users: number;
  max_users: number | null;
}

const emptyPlanForm: Partial<SubscriptionPlan> = {
  name: '',
  slug: '',
  description: '',
  plan_type: 'crm_base',
  tier: 'starter',
  billing_period: 'monthly',
  price_monthly: 0,
  price_quarterly: null,
  price_annual: null,
  currency: 'USD',
  features: {},
  limits: {},
  trial_period_days: 0,
  deployment_model: 'saas',
  supported_currencies: ['USD'],
  supported_languages: ['en'],
  metadata: {},
  is_active: true,
  user_scaling_factor: 0,
  min_users: 0,
  max_users: null,
};

export default function MasterDataSubscriptionPlans() {
  const { scopedDb, context } = useCRM();
  const { toast } = useToast();
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [planForm, setPlanForm] = useState<Partial<SubscriptionPlan>>(emptyPlanForm);
  const [previewUsers, setPreviewUsers] = useState<number>(10);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!context.isPlatformAdmin) {
      return;
    }
    loadPlans();
  }, [context.isPlatformAdmin]);

  const loadPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await scopedDb
        .from('subscription_plans', true)
        .select('*')
        .order('sort_order', { ascending: true });
      if (error) throw error;
      setPlans((data || []) as SubscriptionPlan[]);
    } catch (err: any) {
      toast({ title: 'Load failed', description: err?.message || 'Error loading subscription plans', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingPlan(null);
    setPlanForm(emptyPlanForm);
    setShowEdit(true);
  };

  const openEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan);
    setPlanForm({
      ...plan,
      features: plan.features || {},
      limits: plan.limits || {},
      metadata: plan.metadata || {},
      supported_currencies: plan.supported_currencies || ['USD'],
      supported_languages: plan.supported_languages || ['en'],
      user_scaling_factor: plan.user_scaling_factor || 0,
      min_users: plan.min_users || 0,
      max_users: plan.max_users || null,
    });
    setShowEdit(true);
  };

  const handleSave = async () => {
    const name = String(planForm.name || '').trim();
    const slug = String(planForm.slug || '').trim();
    if (!name || !slug) {
      toast({ title: 'Name and slug are required', variant: 'destructive' });
      return;
    }

    const payload = {
      name,
      slug,
      description: planForm.description || null,
      plan_type: planForm.plan_type || 'crm_base',
      tier: planForm.tier || null,
      billing_period: planForm.billing_period || 'monthly',
      price_monthly: Number(planForm.price_monthly || 0),
      price_quarterly: planForm.price_quarterly != null ? Number(planForm.price_quarterly) : null,
      price_annual: planForm.price_annual != null ? Number(planForm.price_annual) : null,
      currency: planForm.currency || 'USD',
      features: planForm.features || {},
      limits: planForm.limits || {},
      trial_period_days: planForm.trial_period_days != null ? Number(planForm.trial_period_days) : null,
      deployment_model: planForm.deployment_model || null,
      supported_currencies: planForm.supported_currencies || ['USD'],
      supported_languages: planForm.supported_languages || ['en'],
      metadata: planForm.metadata || {},
      is_active: planForm.is_active ?? true,
      user_scaling_factor: Number(planForm.user_scaling_factor || 0),
      min_users: Number(planForm.min_users || 0),
      max_users: planForm.max_users != null && String(planForm.max_users) !== '' ? Number(planForm.max_users) : null,
    };

    setSaving(true);
    try {
      if (editingPlan) {
        const { error } = await scopedDb
          .from('subscription_plans', true)
          .update(payload)
          .eq('id', editingPlan.id);
        if (error) throw error;
        await scopedDb.from('audit_logs').insert({
          action: 'update',
          resource_type: 'subscription_plan',
          resource_id: editingPlan.id,
          details: payload,
        });
        toast({ title: 'Plan updated' });
      } else {
        const { data, error } = await scopedDb
          .from('subscription_plans', true)
          .insert(payload)
          .select('id')
          .single();
        if (error) throw error;
        const createdId = (data as any)?.id;
        if (createdId) {
          await scopedDb.from('audit_logs').insert({
            action: 'create',
            resource_type: 'subscription_plan',
            resource_id: createdId,
            details: payload,
          });
        }
        toast({ title: 'Plan created' });
      }
      setShowEdit(false);
      loadPlans();
    } catch (err: any) {
      toast({ title: 'Save failed', description: err?.message || 'Error saving plan', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (plan: SubscriptionPlan) => {
    try {
      const { error } = await scopedDb
        .from('subscription_plans', true)
        .delete()
        .eq('id', plan.id);
      if (error) throw error;
      await scopedDb.from('audit_logs').insert({
        action: 'delete',
        resource_type: 'subscription_plan',
        resource_id: plan.id,
        details: { name: plan.name, slug: plan.slug },
      });
      toast({ title: 'Plan deleted' });
      loadPlans();
    } catch (err: any) {
      toast({ title: 'Delete failed', description: err?.message || 'Error deleting plan', variant: 'destructive' });
    }
  };

  const filteredPlans = plans.filter((p) =>
    String(p.name || '').toLowerCase().includes(search.toLowerCase()) ||
    String(p.slug || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!context.isPlatformAdmin) {
    return (
      <DashboardLayout>
        <div className="space-y-4">
          <h1 className="text-3xl font-bold">Subscription Plans</h1>
          <p className="text-muted-foreground">Only platform admins can manage subscription plans.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Master Data: Subscription Plans</h1>
          <p className="text-muted-foreground">
            Configure subscription plans, pricing tiers, billing cycles, and deployment options.
          </p>
        </div>

        <Tabs defaultValue="plans">
          <TabsList>
            <TabsTrigger value="plans">Plans</TabsTrigger>
            <TabsTrigger value="metadata">Hybrid & Metadata</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="mt-4 space-y-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search by name or slug"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Button variant="outline" onClick={loadPlans} disabled={loading}>
                Refresh
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Subscription Plans</CardTitle>
                <CardDescription>Core plan catalog for CRM and logistics modules</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionsToolbar>
                  <Button size="sm" onClick={openCreate}>
                    <Plus className="mr-1 h-4 w-4" /> New Plan
                  </Button>
                </ActionsToolbar>

                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Billing</TableHead>
                      <TableHead>Pricing</TableHead>
                      <TableHead>Tier</TableHead>
                      <TableHead>Deployment</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPlans.map((plan) => (
                      <TableRow key={plan.id}>
                        <TableCell className="font-medium">{plan.name}</TableCell>
                        <TableCell>{plan.slug}</TableCell>
                        <TableCell>{plan.billing_period}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-sm">
                            <span>${plan.price_monthly}/mo</span>
                            {plan.price_quarterly != null && <span>${plan.price_quarterly}/qtr</span>}
                            {plan.price_annual != null && <span>${plan.price_annual}/yr</span>}
                          </div>
                        </TableCell>
                        <TableCell>{plan.tier || '-'}</TableCell>
                        <TableCell>{plan.deployment_model || 'saas'}</TableCell>
                        <TableCell>
                          <Badge variant={plan.is_active ? 'default' : 'outline'}>
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="flex gap-2 justify-end">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button size="icon" variant="outline" onClick={() => openEdit(plan)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Edit plan</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="outline"
                                onClick={() => handleDelete(plan)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete plan</TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="metadata" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Hybrid Deployment & Localization</CardTitle>
                <CardDescription>
                  Configure multi-currency, multi-language, and deployment settings per plan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-2">
                  Use the plan editor to set deployment model, supported currencies and languages, and arbitrary metadata.
                  These attributes are read by CRM modules and billing integrations.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingPlan ? 'Edit Subscription Plan' : 'New Subscription Plan'}</DialogTitle>
            <DialogDescription>
              {editingPlan ? 'Modify the details of the existing subscription plan.' : 'Enter the details for the new subscription plan.'}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
              <div className="md:col-span-2">
                <h3 className="text-sm font-semibold">Plan Basics</h3>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-name">
                  Name
                </label>
                <Input
                  id="plan-name"
                  aria-required="true"
                  value={planForm.name || ''}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-slug">
                  Slug
                </label>
                <Input
                  id="plan-slug"
                  aria-required="true"
                  value={planForm.slug || ''}
                  onChange={(e) => setPlanForm({ ...planForm, slug: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="plan-description">
                  Description
                </label>
                <Textarea
                  id="plan-description"
                  value={planForm.description || ''}
                  onChange={(e) => setPlanForm({ ...planForm, description: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" id="plan-tier-label">
                  Tier
                </label>
                <Select
                  value={planForm.tier || 'starter'}
                  onValueChange={(v) => setPlanForm({ ...planForm, tier: v })}
                >
                  <SelectTrigger aria-labelledby="plan-tier-label">
                    <SelectValue placeholder="Select tier" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                    <SelectItem value="enterprise">Enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" id="plan-type-label">
                  Plan Type
                </label>
                <Select
                  value={planForm.plan_type || 'crm_base'}
                  onValueChange={(v) => setPlanForm({ ...planForm, plan_type: v })}
                >
                  <SelectTrigger aria-labelledby="plan-type-label">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="crm_base">CRM Base</SelectItem>
                    <SelectItem value="service_addon">Service Add-on</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" id="plan-billing-label">
                  Billing Period (primary)
                </label>
                <Select
                  value={planForm.billing_period || 'monthly'}
                  onValueChange={(v) => setPlanForm({ ...planForm, billing_period: v })}
                >
                  <SelectTrigger aria-labelledby="plan-billing-label">
                    <SelectValue placeholder="Select billing period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 mt-4">
                <h3 className="text-sm font-semibold">Pricing</h3>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-currency">
                  Currency
                </label>
                <Select
                  value={planForm.currency || 'USD'}
                  onValueChange={(v) => setPlanForm({ ...planForm, currency: v })}
                >
                  <SelectTrigger id="plan-currency">
                    <SelectValue placeholder="Select currency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-price-monthly">
                  Monthly Price
                </label>
                <Input
                  id="plan-price-monthly"
                  type="number"
                  aria-required="true"
                  value={planForm.price_monthly ?? 0}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, price_monthly: Number(e.target.value || 0) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-price-quarterly">
                  Quarterly Price
                </label>
                <Input
                  id="plan-price-quarterly"
                  type="number"
                  value={planForm.price_quarterly ?? ''}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      price_quarterly: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-price-annual">
                  Annual Price
                </label>
                <Input
                  id="plan-price-annual"
                  type="number"
                  value={planForm.price_annual ?? ''}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      price_annual: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-trial-days">
                  Trial Period (days)
                </label>
                <Input
                  id="plan-trial-days"
                  type="number"
                  value={planForm.trial_period_days ?? 0}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      trial_period_days: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" id="plan-deployment-label">
                  Deployment Model
                </label>
                <Select
                  value={planForm.deployment_model || 'saas'}
                  onValueChange={(v) => setPlanForm({ ...planForm, deployment_model: v })}
                >
                  <SelectTrigger aria-labelledby="plan-deployment-label">
                    <SelectValue placeholder="Select deployment model" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="on_premise">On-Premise</SelectItem>
                    <SelectItem value="hybrid">Hybrid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-supported-currencies">
                  Supported Currencies (comma-separated)
                </label>
                <Input
                  id="plan-supported-currencies"
                  value={(planForm.supported_currencies || ['USD']).join(',')}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      supported_currencies: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-supported-languages">
                  Supported Languages (comma-separated)
                </label>
                <Input
                  id="plan-supported-languages"
                  value={(planForm.supported_languages || ['en']).join(',')}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      supported_languages: e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
              <div className="space-y-2 md:col-span-2 border-t pt-4">
                <h3 className="text-lg font-medium flex items-center gap-2">
                  <Calculator className="h-5 w-5" /> User Scaling Configuration
                </h3>
                <p className="text-sm text-muted-foreground">
                  Define how the plan price scales with the number of users.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-scaling-factor">
                  User Scaling Factor (Price per User)
                </label>
                <Input
                  id="plan-scaling-factor"
                  type="number"
                  value={planForm.user_scaling_factor ?? 0}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, user_scaling_factor: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-min-users">
                  Minimum Users
                </label>
                <Input
                  id="plan-min-users"
                  type="number"
                  value={planForm.min_users ?? 0}
                  onChange={(e) =>
                    setPlanForm({ ...planForm, min_users: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="plan-max-users">
                  Maximum Users (Optional)
                </label>
                <Input
                  id="plan-max-users"
                  type="number"
                  placeholder="Unlimited"
                  value={planForm.max_users ?? ''}
                  onChange={(e) =>
                    setPlanForm({
                      ...planForm,
                      max_users: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>

              <div className="space-y-4 md:col-span-2 bg-muted/50 p-4 rounded-md">
                <h4 className="text-sm font-semibold">Scaling Preview</h4>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-1">
                    <label className="text-sm font-medium" htmlFor="plan-simulated-users">
                      Simulate Active Users
                    </label>
                    <Input
                      id="plan-simulated-users"
                      type="number"
                      value={previewUsers}
                      onChange={(e) => setPreviewUsers(Number(e.target.value))}
                    />
                  </div>
                  <div className="flex-1">
                    {(() => {
                      const result = calculateScaledPrice(planForm as any, previewUsers);
                      return (
                        <div className={`text-sm ${result.valid ? '' : 'text-destructive'}`}>
                          {result.valid ? (
                            <div>
                              <div className="font-bold text-lg">
                                ${result.monthly_price.toFixed(2)} / month
                              </div>
                              <div className="text-muted-foreground text-xs">
                                ${result.annual_price.toFixed(2)} / year
                              </div>
                            </div>
                          ) : (
                            <div className="font-medium">Invalid: {result.reason}</div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="space-y-2 md:col-span-2 border-t pt-4">
                <h3 className="text-sm font-semibold">Advanced Configuration</h3>
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="plan-features-json">
                  Feature Entitlements (JSON)
                </label>
                <Textarea
                  id="plan-features-json"
                  value={JSON.stringify(planForm.features || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || '{}');
                      setPlanForm({ ...planForm, features: parsed });
                    } catch {
                    }
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="plan-limits-json">
                  Limitations (JSON)
                </label>
                <Textarea
                  id="plan-limits-json"
                  value={JSON.stringify(planForm.limits || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || '{}');
                      setPlanForm({ ...planForm, limits: parsed });
                    } catch {
                    }
                  }}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-medium" htmlFor="plan-metadata-json">
                  Custom Metadata (JSON)
                </label>
                <Textarea
                  id="plan-metadata-json"
                  value={JSON.stringify(planForm.metadata || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      const parsed = JSON.parse(e.target.value || '{}');
                      setPlanForm({ ...planForm, metadata: parsed });
                    } catch {
                    }
                  }}
                />
              </div>
              <div className="flex items-center gap-2 md:col-span-2">
                <Switch
                  id="plan-active"
                  checked={planForm.is_active ?? true}
                  onCheckedChange={(checked) => setPlanForm({ ...planForm, is_active: checked })}
                />
                <label className="text-sm" htmlFor="plan-active">
                  Active
                </label>
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowEdit(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

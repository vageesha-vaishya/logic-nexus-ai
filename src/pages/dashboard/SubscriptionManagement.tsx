import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { PlanCard } from '@/components/subscription/PlanCard';
import { UsageMetrics } from '@/components/subscription/UsageMetrics';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { CreditCard, Package, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_annual: number | null;
  tier: string | null;
  features: any;
  billing_period: string;
  is_active: boolean;
  plan_type: string;
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

export default function SubscriptionManagement() {
  const [currentSubscription, setCurrentSubscription] = useState<Subscription | null>(null);
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const { supabase, context, user } = useCRM();
  const [tenants, setTenants] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);

  useEffect(() => {
    // Load tenants for platform admins to pick scope
    if (context.isPlatformAdmin) {
      fetchTenants();
    }
    fetchData();
  }, [context.tenantId, context.isPlatformAdmin, selectedTenantId]);

  const fetchData = async () => {
    try {
      // Fetch available plans first (public read)
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('plan_type', 'crm_base')
        .order('price_monthly');

      if (plansError) throw plansError;
      setAvailablePlans(plansData || []);

      // Fetch current subscription for the effective tenant scope
      const tenantScope = context.isPlatformAdmin ? selectedTenantId : context.tenantId;
      if (tenantScope) {
        const { data: subData, error: subError } = await supabase
          .from('tenant_subscriptions')
          .select('*, subscription_plans(*)')
          .eq('tenant_id', tenantScope)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (subError) {
          // Soft-fail: keep page usable even without subscription visibility
          console.warn('Subscription fetch blocked or failed:', subError.message);
          setCurrentSubscription(null);
        } else {
          setCurrentSubscription(subData);
        }
      } else {
        setCurrentSubscription(null);
      }
    } catch (error: any) {
      toast.error('Failed to load plans');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTenants = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      setTenants(data || []);
    } catch (error) {
      console.warn('Failed to load tenants', error);
    }
  };

  const handleSelectPlan = async (planId: string) => {
    try {
      const selectedPlan = availablePlans.find(p => p.id === planId);
      if (!selectedPlan) return;
      if (!selectedPlan.is_active) {
        toast.error('This plan is currently unavailable.');
        return;
      }

      // Resolve tenant_id robustly
      let effectiveTenantId: string | undefined = context.isPlatformAdmin
        ? (selectedTenantId ?? undefined)
        : context.tenantId;
      if (!effectiveTenantId && user?.id) {
        const { data: tid, error: tidError } = await supabase.rpc('get_user_tenant_id', { check_user_id: user.id });
        if (tidError) {
          console.warn('Failed to resolve tenant_id via RPC:', tidError.message);
        }
        effectiveTenantId = tid as string | undefined;
      }

      if (!effectiveTenantId) {
        throw new Error('Select a tenant to subscribe, or switch to a tenant role.');
      }

      // Cancel current subscription
      if (currentSubscription) {
        await supabase
          .from('tenant_subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() })
          .eq('id', currentSubscription.id);
      }

      // Create new subscription
      const { error } = await supabase
        .from('tenant_subscriptions')
        .insert([{ 
          tenant_id: effectiveTenantId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }]);

      if (error) throw error;

      toast.success(`Successfully subscribed to ${selectedPlan.name}`);
      fetchData();
    } catch (error: any) {
      toast.error('Failed to update subscription: ' + (error?.message || 'Unknown error'));
      console.error('Error:', error);
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

  if (loading) {
    return (
      <DashboardLayout>
        <div className="text-center py-12">Loading subscription data...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Subscription Management</h1>
          <p className="text-muted-foreground">Manage your subscription plans and usage</p>
        </div>

        {context.isPlatformAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Tenant Scope</CardTitle>
              <CardDescription>Select a tenant to manage subscriptions</CardDescription>
            </CardHeader>
            <CardContent className="flex items-center gap-3">
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
                <span className="text-sm text-muted-foreground">Pick a tenant to enable plan selection</span>
              )}
            </CardContent>
          </Card>
        )}

        {currentSubscription && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Current Plan</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
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
                <CreditCard className="h-4 w-4 text-muted-foreground" />
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
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {format(new Date(currentSubscription.current_period_end), 'MMM dd')}
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(currentSubscription.current_period_end), 'yyyy')}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="plans" className="space-y-6">
          <TabsList>
            <TabsTrigger value="plans">Available Plans</TabsTrigger>
            <TabsTrigger value="usage">Usage & Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Choose Your Plan</CardTitle>
                <CardDescription>
                  Select the plan that best fits your business needs
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {availablePlans.map((plan) => (
                    <PlanCard
                      key={plan.id}
                      plan={plan}
                      isCurrentPlan={currentSubscription?.plan_id === plan.id}
                      onSelect={handleSelectPlan}
                      showActions={true}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="usage" className="space-y-4">
            {context.tenantId && <UsageMetrics tenantId={context.tenantId} />}
            
            <Card>
              <CardHeader>
                <CardTitle>Billing History</CardTitle>
                <CardDescription>View your past invoices and payments</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground text-center py-8">
                  No billing history available yet
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
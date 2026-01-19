import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { Building2, CreditCard } from 'lucide-react';
import { format } from 'date-fns';

interface Tenant {
  id: string;
  name: string;
  tenant_subscriptions: Array<{
    id: string;
    status: string;
    current_period_end: string;
    subscription_plans: {
      name: string;
      price_monthly: number;
    };
  }>;
}

export default function TenantSubscription() {
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<Record<string, string>>({});
  const { supabase, context } = useCRM();

  useEffect(() => {
    if (!context.isPlatformAdmin) {
      navigate('/dashboard');
      return;
    }
    fetchData();
  }, [context.isPlatformAdmin]);

  const fetchData = async () => {
    try {
      // Fetch tenants with subscriptions
      const { data: tenantsData, error: tenantsError } = await supabase
        .from('tenants')
        .select(`
          *,
          tenant_subscriptions(
            id,
            status,
            current_period_end,
            subscription_plans(name, price_monthly)
          )
        `)
        .order('name');

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Fetch available plans
      const { data: plansData, error: plansError } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .eq('plan_type', 'crm_base')
        .order('price_monthly');

      if (plansError) throw plansError;
      setPlans(plansData || []);
    } catch (error: any) {
      toast.error('Failed to load data');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignPlan = async (tenantId: string) => {
    const planId = selectedPlan[tenantId];
    if (!planId) {
      toast.error('Please select a plan');
      return;
    }

    try {
      // Cancel existing active subscriptions
      await supabase
        .from('tenant_subscriptions')
        .update({ status: 'canceled', canceled_at: new Date().toISOString() })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      // Create new subscription
      const { data: inserted, error } = await supabase
        .from('tenant_subscriptions')
        .insert([{
          tenant_id: tenantId,
          plan_id: planId,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }]);

      if (error) throw error;

      const selected = plans.find(p => p.id === planId);
      const allowedTiers = ['free', 'basic', 'professional', 'enterprise'];
      const planTier = selected?.tier || null;
      const derivedTier = planTier && allowedTiers.includes(planTier) ? planTier : null;

      try {
        await supabase
          .from('tenants')
          .update({ subscription_tier: derivedTier })
          .eq('id', tenantId);
      } catch (tierError) {
        console.warn('Failed to sync tenant subscription_tier from plan:', tierError);
      }

      toast.success('Plan assigned successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to assign plan: ' + error.message);
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
        <div className="text-center py-12">Loading...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tenant Subscriptions</h1>
          <p className="text-muted-foreground">Manage subscription plans for all tenants</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Tenant Plans Assignment</CardTitle>
            <CardDescription>Assign and manage subscription plans for each tenant</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Current Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Renewal Date</TableHead>
                  <TableHead>Monthly Cost</TableHead>
                  <TableHead>Assign New Plan</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => {
                  const activeSub = tenant.tenant_subscriptions?.find(s => s.status === 'active');
                  
                  return (
                    <TableRow key={tenant.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-muted-foreground" />
                          {tenant.name}
                        </div>
                      </TableCell>
                      <TableCell>
                        {activeSub ? activeSub.subscription_plans.name : 'No Plan'}
                      </TableCell>
                      <TableCell>
                        {activeSub ? (
                          <Badge className={getStatusColor(activeSub.status)}>
                            {activeSub.status}
                          </Badge>
                        ) : (
                          <Badge variant="outline">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {activeSub 
                          ? format(new Date(activeSub.current_period_end), 'MMM dd, yyyy')
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        {activeSub ? (
                          <div className="flex items-center gap-1">
                            <CreditCard className="h-4 w-4 text-muted-foreground" />
                            ${activeSub.subscription_plans.price_monthly}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={selectedPlan[tenant.id] || ''}
                          onValueChange={(value) => setSelectedPlan({ ...selectedPlan, [tenant.id]: value })}
                        >
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="Select plan" />
                          </SelectTrigger>
                          <SelectContent>
                            {plans.map((plan) => (
                              <SelectItem key={plan.id} value={plan.id}>
                                {plan.name} - ${plan.price_monthly}/mo
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          onClick={() => handleAssignPlan(tenant.id)}
                          disabled={!selectedPlan[tenant.id]}
                        >
                          Assign
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {tenants.length === 0 && (
              <p className="text-center py-8 text-muted-foreground">
                No tenants found
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

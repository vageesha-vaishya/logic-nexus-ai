import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AccountForm } from '@/components/crm/AccountForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function AccountNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from('accounts')
        .insert({
          ...formData,
          tenant_id: context.tenantId,
          franchise_id: context.franchiseId,
          annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
          employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Account created successfully');
      navigate(`/dashboard/accounts/${data.id}`);
    } catch (error: any) {
      toast.error('Failed to create account');
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/accounts')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Account</h1>
            <p className="text-muted-foreground">Create a new company account</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Account Information</CardTitle>
          </CardHeader>
          <CardContent>
            <AccountForm
              onSubmit={handleCreate}
              onCancel={() => navigate('/dashboard/accounts')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

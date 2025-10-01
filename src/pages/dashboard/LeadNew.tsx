import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LeadForm } from '@/components/crm/LeadForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function LeadNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      const tenantId = context.isPlatformAdmin 
        ? formData.tenant_id 
        : context.tenantId;

      if (!tenantId) {
        toast.error('Please select a tenant');
        return;
      }

      const { data, error } = await supabase
        .from('leads')
        .insert({
          ...formData,
          tenant_id: tenantId,
          franchise_id: formData.franchise_id || context.franchiseId,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          expected_close_date: formData.expected_close_date || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Lead created successfully');
      navigate(`/dashboard/leads/${data.id}`);
    } catch (error: any) {
      toast.error('Failed to create lead');
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/leads')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Lead</h1>
            <p className="text-muted-foreground">Create a new sales lead</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Lead Information</CardTitle>
          </CardHeader>
          <CardContent>
            <LeadForm
              onSubmit={handleCreate}
              onCancel={() => navigate('/dashboard/leads')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

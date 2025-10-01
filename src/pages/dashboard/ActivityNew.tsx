import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/crm/ActivityForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function ActivityNew() {
  const navigate = useNavigate();
  const { supabase, context } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...formData,
          tenant_id: context.tenantId,
          franchise_id: context.franchiseId,
          account_id: formData.account_id === 'none' ? null : (formData.account_id || null),
          contact_id: formData.contact_id === 'none' ? null : (formData.contact_id || null),
          lead_id: formData.lead_id === 'none' ? null : (formData.lead_id || null),
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Activity created successfully');
      navigate('/dashboard/activities');
    } catch (error: any) {
      toast.error('Failed to create activity');
      console.error('Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard/activities')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">New Activity</h1>
            <p className="text-muted-foreground">Schedule a new activity or task</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Activity Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityForm
              onSubmit={handleCreate}
              onCancel={() => navigate('/dashboard/activities')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

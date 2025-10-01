import { useNavigate, useSearchParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ActivityForm } from '@/components/crm/ActivityForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function ActivityNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { supabase, context } = useCRM();
  
  const leadId = searchParams.get('leadId');

  const handleCreate = async (formData: any) => {
    try {
      let tenantId = context.tenantId;
      let franchiseId = context.franchiseId;

      // For platform admins, get tenant_id from related entity
      if (!tenantId) {
        if (formData.lead_id && formData.lead_id !== 'none') {
          const { data: lead } = await supabase
            .from('leads')
            .select('tenant_id, franchise_id')
            .eq('id', formData.lead_id)
            .single();
          if (lead) {
            tenantId = lead.tenant_id;
            franchiseId = lead.franchise_id;
          }
        } else if (formData.account_id && formData.account_id !== 'none') {
          const { data: account } = await supabase
            .from('accounts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.account_id)
            .single();
          if (account) {
            tenantId = account.tenant_id;
            franchiseId = account.franchise_id;
          }
        } else if (formData.contact_id && formData.contact_id !== 'none') {
          const { data: contact } = await supabase
            .from('contacts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.contact_id)
            .single();
          if (contact) {
            tenantId = contact.tenant_id;
            franchiseId = contact.franchise_id;
          }
        }
      }

      if (!tenantId) {
        toast.error('Please select a related lead, account, or contact');
        return;
      }

      const { data, error } = await supabase
        .from('activities')
        .insert({
          ...formData,
          tenant_id: tenantId,
          franchise_id: franchiseId,
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
              initialData={leadId ? { lead_id: leadId } : undefined}
              onSubmit={handleCreate}
              onCancel={() => navigate(leadId ? `/dashboard/leads/${leadId}` : '/dashboard/activities')}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

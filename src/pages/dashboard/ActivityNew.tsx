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
  const accountId = searchParams.get('accountId');
  const contactId = searchParams.get('contactId');
  const typeParam = searchParams.get('type');
  
  // Map 'event' to 'meeting' to match ActivityForm schema
  const activityType = (typeParam === 'event' ? 'meeting' : typeParam) as 'task' | 'meeting' | 'call' | 'email' | 'note' | undefined;

  const initialData = {
    activity_type: activityType || 'task',
    lead_id: leadId || null,
    account_id: accountId || null,
    contact_id: contactId || null,
    status: 'planned' as const,
    priority: 'medium' as const,
  };

  const handleCreate = async (formData: any) => {
    try {
      let tenantId = context.tenantId;
      let franchiseId = context.franchiseId;

      // For platform admins, get tenant_id from related entity if not in context
      if (!tenantId) {
        if (formData.lead_id) {
          const { data: lead } = await supabase
            .from('leads')
            .select('tenant_id, franchise_id')
            .eq('id', formData.lead_id)
            .single();
          if (lead) {
            tenantId = lead.tenant_id;
            franchiseId = lead.franchise_id;
          }
        } else if (formData.account_id) {
          const { data: account } = await supabase
            .from('accounts')
            .select('tenant_id, franchise_id')
            .eq('id', formData.account_id)
            .single();
          if (account) {
            tenantId = account.tenant_id;
            franchiseId = account.franchise_id;
          }
        } else if (formData.contact_id) {
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
        toast.error('Could not determine tenant context. Please select a related record.');
        return;
      }

      // Format description for specific types
      let description = formData.description;
      if (formData.activity_type === 'meeting' && formData.location) {
        description = description ? `${description}\n\nLocation: ${formData.location}` : `Location: ${formData.location}`;
      }

      // Handle email sending (placeholder)
      if (formData.activity_type === 'email' && formData.send_email) {
        if (!formData.to) {
          toast.error('Recipient email is required to send email');
          return;
        }
        // TODO: Implement actual email sending via Edge Function
        // For now, we just log it and append a note
        description = `${description}\n\n[Sent via system to ${formData.to}]`;
        toast.info('Email logged (sending functionality pending configuration)');
      }

      const { error } = await supabase
        .from('activities')
        .insert({
          ...formData,
          description,
          tenant_id: tenantId,
          franchise_id: franchiseId,
          created_by: (await supabase.auth.getUser()).data.user?.id
        });

      if (error) throw error;

      toast.success('Activity created successfully');
      navigate('/dashboard/activities');
    } catch (error: any) {
      console.error('Error creating activity:', error);
      toast.error('Failed to create activity');
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

        <ActivityForm 
          initialData={initialData}
          onSubmit={handleCreate}
          onCancel={() => navigate('/dashboard/activities')}
        />
      </div>
    </DashboardLayout>
  );
}

import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { OpportunityForm } from '@/components/crm/OpportunityForm';
import { EntityNewPageHeader } from '@/components/crm/EntityNewPageHeader';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';

export default function OpportunityNew() {
  const navigate = useNavigate();
  const { supabase, user, context, scopedDb } = useCRM();

  const handleSubmit = async (formData: any) => {
    try {
      const opportunityData = {
        name: formData.name,
        description: formData.description || null,
        stage: formData.stage,
        amount: formData.amount ? parseFloat(formData.amount) : null,
        probability: formData.probability ? parseInt(formData.probability) : null,
        close_date: formData.close_date || null,
        account_id: formData.account_id || null,
        contact_id: formData.contact_id || null,
        lead_id: formData.lead_id || null,
        lead_source: formData.lead_source || null,
        next_step: formData.next_step || null,
        competitors: formData.competitors || null,
        type: formData.type || null,
        forecast_category: formData.forecast_category || null,
        tenant_id: context.isPlatformAdmin ? formData.tenant_id : context.tenantId,
        franchise_id: formData.franchise_id || context.franchiseId,
        owner_id: user?.id,
        created_by: user?.id,
      };

      // Validate tenant_id
      if (!opportunityData.tenant_id) {
        toast.error('Tenant is required');
        return;
      }

      const { error } = await scopedDb
        .from('opportunities')
        .insert(opportunityData);

      if (error) throw error;

      toast.success('Opportunity created successfully');
      navigate('/dashboard/opportunities');
    } catch (error: any) {
      toast.error('Failed to create opportunity', {
        description: error.message,
      });
    }
  };

  const handleCancel = () => {
    navigate('/dashboard/opportunities');
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <EntityNewPageHeader
          title="New Opportunity"
          subtitle="Create a new sales opportunity"
          onBack={handleCancel}
        />

        <OpportunityForm onSubmit={handleSubmit} onCancel={handleCancel} />
      </div>
    </DashboardLayout>
  );
}
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';
import { ArrowLeft } from 'lucide-react';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
import { EnterpriseSheet } from '@/components/ui/enterprise/EnterpriseComponents';

export default function AccountNew() {
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      // For platform admins, use the tenant_id from form, otherwise use context
      const tenantId = context.isPlatformAdmin 
        ? (formData.tenant_id || null)
        : context.tenantId;

      if (!tenantId) {
        toast.error('Please select a tenant');
        return;
      }

      // Prepare data for insertion
      const accountData = {
        ...formData,
        tenant_id: tenantId,
        franchise_id: context.franchiseId,
        // Ensure numeric conversion
        annual_revenue: formData.annual_revenue ? parseFloat(formData.annual_revenue) : null,
        employee_count: formData.employee_count ? parseInt(formData.employee_count) : null,
        // Handle address object flattening if needed, or if UnifiedPartnerForm returns flattened data?
        // UnifiedPartnerForm returns nested address object. We need to flatten it.
        billing_street: formData.address?.street,
        billing_city: formData.address?.city,
        billing_state: formData.address?.state,
        billing_postal_code: formData.address?.postal_code,
        billing_country: formData.address?.country,
        // Remove address object to avoid Supabase error
        address: undefined,
        type: undefined // Remove form-specific type field
      };

      const { data, error } = await scopedDb
        .from('accounts')
        .insert(accountData)
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
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
        <EnterpriseFormLayout 
            title="New Account"
            breadcrumbs={[
                { label: 'Accounts', to: '/dashboard/accounts' },
                { label: 'New' },
            ]}
            status="Draft"
            actions={
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate('/dashboard/accounts')}
                    >
                        Cancel
                    </Button>
                </div>
            }
        >
            <EnterpriseSheet>
                <div className="p-6">
                    <UnifiedPartnerForm
                        entityType="account"
                        mode="create"
                        onSubmit={handleCreate}
                        onCancel={() => navigate('/dashboard/accounts')}
                    />
                </div>
            </EnterpriseSheet>
        </EnterpriseFormLayout>
    </div>
  );
}

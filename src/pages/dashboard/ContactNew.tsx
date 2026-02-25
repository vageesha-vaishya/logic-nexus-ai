import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { UnifiedPartnerForm } from '@/components/crm/UnifiedPartnerForm';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
import { EnterpriseSheet } from '@/components/ui/enterprise/EnterpriseComponents';

export default function ContactNew() {
  const navigate = useNavigate();
  const { context, scopedDb } = useCRM();

  const handleCreate = async (formData: any) => {
    try {
      // Platform admins must select a tenant
      if (context.isPlatformAdmin && !formData.tenant_id) {
        toast.error('Tenant is required');
        return;
      }

      const contactData = {
        ...formData,
        // ScopedDataAccess will automatically inject tenant_id and franchise_id from context
        // for non-platform admins. Platform admins must provide them in formData.
        account_id: formData.account_id === 'none' || formData.account_id === '' ? null : formData.account_id,
        type: undefined // Remove form-specific type field
      };

      const { data, error } = await scopedDb
        .from('contacts')
        .insert(contactData)
        .select()
        .single();

      if (error) throw error;

      toast.success('Contact created successfully');
      navigate(`/dashboard/contacts/${data.id}`);
    } catch (error: any) {
      toast.error('Failed to create contact');
      console.error('Error:', error);
    }
  };

  return (
    <div className="h-screen w-full bg-[#f9fafb] overflow-hidden">
        <EnterpriseFormLayout 
            title="New Contact"
            breadcrumbs={[
                { label: 'Contacts', to: '/dashboard/contacts' },
                { label: 'New' },
            ]}
            status="Draft"
            actions={
                <div className="flex items-center gap-2">
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => navigate('/dashboard/contacts')}
                    >
                        Cancel
                    </Button>
                </div>
            }
        >
            <EnterpriseSheet>
                <div className="p-6">
                    <UnifiedPartnerForm
                        entityType="contact"
                        mode="create"
                        onSubmit={handleCreate}
                        onCancel={() => navigate('/dashboard/contacts')}
                    />
                </div>
            </EnterpriseSheet>
        </EnterpriseFormLayout>
    </div>
  );
}

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
      if (context.isPlatformAdmin && !formData.tenant_id) {
        toast.error('Tenant is required');
        return;
      }

      const normalizeNullable = (value: unknown) => {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed === '' || trimmed === 'none') return null;
          return trimmed;
        }
        return value;
      };

      const normalizedAddress = formData.address && typeof formData.address === 'object'
        ? {
            street: normalizeNullable(formData.address.street) || '',
            city: normalizeNullable(formData.address.city) || '',
            state: normalizeNullable(formData.address.state) || '',
            postal_code: normalizeNullable(formData.address.postal_code) || '',
            country: normalizeNullable(formData.address.country) || '',
          }
        : {};

      const contactData = {
        tenant_id: context.isPlatformAdmin ? normalizeNullable(formData.tenant_id) : undefined,
        franchise_id: context.isPlatformAdmin ? normalizeNullable(formData.franchise_id) : undefined,
        account_id: normalizeNullable(formData.account_id),
        first_name: String(formData.first_name || '').trim(),
        last_name: String(formData.last_name || '').trim(),
        title: normalizeNullable(formData.job_title),
        email: normalizeNullable(formData.email),
        phone: normalizeNullable(formData.phone),
        mobile: normalizeNullable(formData.mobile),
        linkedin_url: normalizeNullable(formData.website),
        address: normalizedAddress,
        notes: normalizeNullable(formData.notes),
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
      toast.error('Failed to create contact', {
        description: error?.message || 'Unknown error',
      });
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

import { useNavigate } from 'react-router-dom';
import { EntityCreatePageShell } from '@/components/crm/EntityCreatePageShell';
import { useCRM } from '@/hooks/useCRM';
import { toast } from 'sonner';
import { AccountService } from '@/services/account-service';
import { AccountInput } from '@/lib/account-validation';
import { logger } from "@/lib/logger";

export default function AccountNew() {
  const navigate = useNavigate();
  const { context, supabase } = useCRM();

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

      // Prepare data for service
      const accountData: AccountInput = {
        name: formData.name || '', // Name is mandatory in form for company
        tax_id: formData.vat_number,
        website: formData.website,
        email: formData.email,
        phone: formData.phone,
        billing_address: {
            street: formData.address?.street,
            city: formData.address?.city,
            state: formData.address?.state,
            postal_code: formData.address?.postal_code,
            country: formData.address?.country,
        },
        shipping_address: { // Default shipping to billing if not provided (UI only has one address)
            street: formData.address?.street,
            city: formData.address?.city,
            state: formData.address?.state,
            postal_code: formData.address?.postal_code,
            country: formData.address?.country,
        },
        primary_contact: formData.first_name ? {
            first_name: formData.first_name,
            last_name: formData.last_name,
            email: formData.email, // Shared email if individual? UnifiedPartnerForm logic
            phone: formData.mobile || formData.phone,
            title: formData.job_title
        } : undefined,
        references: [], // Form doesn't capture refs yet
        notes: formData.notes ? [{ content: formData.notes, type: 'general' }] : [],
      };

      const accountService = new AccountService(supabase);
      const result = await accountService.createOrUpdateAccount(accountData, tenantId);

      if (result?.status === 'success') {
        toast.success('Account created successfully');
        navigate(`/dashboard/accounts/${result.account_id}`);
      } else {
        throw new Error('Unexpected response from server');
      }

    } catch (error: any) {
      toast.error(`Failed to create account: ${error.message}`);
      logger.error('Error:', error);
    }
  };

  return (
    <EntityCreatePageShell
      title="New Account"
      listLabel="Accounts"
      listPath="/dashboard/accounts"
      entityType="account"
      onSubmit={handleCreate}
    />
  );
}

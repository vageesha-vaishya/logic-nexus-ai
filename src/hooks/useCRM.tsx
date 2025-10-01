import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export function useCRM() {
  const { user, roles } = useAuth();

  const getCurrentContext = () => {
    const platformAdmin = roles.find(r => r.role === 'platform_admin');
    const tenantAdmin = roles.find(r => r.role === 'tenant_admin');
    const franchiseAdmin = roles.find(r => r.role === 'franchise_admin');
    const regularUser = roles.find(r => r.role === 'user');

    return {
      isPlatformAdmin: !!platformAdmin,
      isTenantAdmin: !!tenantAdmin,
      isFranchiseAdmin: !!franchiseAdmin,
      isUser: !!regularUser,
      tenantId: tenantAdmin?.tenant_id || franchiseAdmin?.tenant_id || regularUser?.tenant_id,
      franchiseId: franchiseAdmin?.franchise_id || regularUser?.franchise_id,
      userId: user?.id,
    };
  };

  return {
    user,
    context: getCurrentContext(),
    supabase,
  };
}

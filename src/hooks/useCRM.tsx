import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo } from 'react';

export function useCRM() {
  const { user, roles } = useAuth();
  const [pref, setPref] = useState<{ franchise_id: string | null; admin_override_enabled: boolean } | null>(null);
  const [loadingPref, setLoadingPref] = useState(false);

  const context = useMemo(() => {
    const platformAdmin = roles.find(r => r.role === 'platform_admin');
    const tenantAdmin = roles.find(r => r.role === 'tenant_admin');
    const franchiseAdmin = roles.find(r => r.role === 'franchise_admin');
    const regularUser = roles.find(r => r.role === 'user');

    const baseTenant = tenantAdmin?.tenant_id || franchiseAdmin?.tenant_id || regularUser?.tenant_id || null;
    const baseFranchise = franchiseAdmin?.franchise_id || regularUser?.franchise_id || null;
    const effectiveFranchise = pref?.franchise_id ?? baseFranchise;
    const adminOverride = !!pref?.admin_override_enabled;

    return {
      isPlatformAdmin: !!platformAdmin,
      isTenantAdmin: !!tenantAdmin,
      isFranchiseAdmin: !!franchiseAdmin,
      isUser: !!regularUser,
      tenantId: baseTenant,
      franchiseId: effectiveFranchise,
      adminOverrideEnabled: adminOverride,
      userId: user?.id,
    };
  }, [roles, pref, user?.id]);

  useEffect(() => {
    async function loadPref() {
      if (!user) return;
      setLoadingPref(true);
      const { data } = await supabase.from('user_preferences').select('franchise_id, admin_override_enabled').eq('user_id', user.id).limit(1).maybeSingle();
      if (data) {
        setPref({ franchise_id: data.franchise_id ?? null, admin_override_enabled: !!data.admin_override_enabled });
      } else {
        setPref(null);
      }
      setLoadingPref(false);
    }
    loadPref();
  }, [user?.id]);

  const setFranchisePreference = async (franchiseId: string | null, adminOverride?: boolean) => {
    if (!user) return;
    await (supabase as any).rpc('set_user_franchise_preference', {
      p_franchise_id: franchiseId,
      p_admin_override: adminOverride ?? pref?.admin_override_enabled ?? false,
    });
    const { data } = await supabase
      .from('user_preferences')
      .select('franchise_id, admin_override_enabled')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      setPref({ franchise_id: data.franchise_id ?? null, admin_override_enabled: !!data.admin_override_enabled });
    }
  };

  const setAdminOverride = async (enabled: boolean, franchiseIdOverride?: string | null) => {
    if (!user) return;
    await (supabase as any).rpc('set_admin_override', {
      p_enabled: enabled,
      p_franchise_id: franchiseIdOverride ?? pref?.franchise_id ?? null,
    });
    const { data } = await supabase
      .from('user_preferences')
      .select('franchise_id, admin_override_enabled')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    if (data) {
      setPref({ franchise_id: data.franchise_id ?? null, admin_override_enabled: !!data.admin_override_enabled });
    }
  };

  return {
    user,
    context,
    supabase,
    preferences: pref,
    loadingPreferences: loadingPref,
    setFranchisePreference,
    setAdminOverride,
  };
}

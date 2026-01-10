import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState, useMemo, useCallback } from 'react';

export function useCRM() {
  const { user, roles } = useAuth();
  const [pref, setPref] = useState<{ tenant_id: string | null; franchise_id: string | null; admin_override_enabled: boolean } | null>(null);
  const [loadingPref, setLoadingPref] = useState(false);

  const context = useMemo(() => {
    const platformAdmin = roles.find(r => r.role === 'platform_admin');
    const tenantAdmin = roles.find(r => r.role === 'tenant_admin');
    const franchiseAdmin = roles.find(r => r.role === 'franchise_admin');
    const regularUser = roles.find(r => r.role === 'user');

    const baseTenant = tenantAdmin?.tenant_id || franchiseAdmin?.tenant_id || regularUser?.tenant_id || null;
    const baseFranchise = franchiseAdmin?.franchise_id || regularUser?.franchise_id || null;
    const effectiveTenant = pref?.tenant_id ?? baseTenant;
    const effectiveFranchise = pref?.franchise_id ?? baseFranchise;
    const adminOverride = !!pref?.admin_override_enabled;

    return {
      isPlatformAdmin: !!platformAdmin,
      isTenantAdmin: !!tenantAdmin,
      isFranchiseAdmin: !!franchiseAdmin,
      isUser: !!regularUser,
      tenantId: effectiveTenant,
      franchiseId: effectiveFranchise,
      adminOverrideEnabled: adminOverride,
      userId: user?.id,
    };
  }, [roles, pref, user?.id]);

  useEffect(() => {
    async function loadPref() {
      if (!user) return;
      setLoadingPref(true);
      try {
        const { data } = await (supabase as any).from('user_preferences').select('tenant_id, franchise_id, admin_override_enabled').eq('user_id', user.id).limit(1).maybeSingle();
        if (data) {
          setPref({ 
            tenant_id: data.tenant_id ?? null, 
            franchise_id: data.franchise_id ?? null, 
            admin_override_enabled: !!data.admin_override_enabled 
          });
        } else {
          setPref(null);
        }
      } catch {
        setPref(null);
      }
      setLoadingPref(false);
    }
    loadPref();
  }, [user?.id]);

  const setScopePreference = useCallback(async (tenantId: string | null, franchiseId: string | null, adminOverride?: boolean) => {
    if (!user) return;
    try {
      await (supabase as any).rpc('set_user_scope_preference', {
        p_tenant_id: tenantId,
        p_franchise_id: franchiseId,
        p_admin_override: adminOverride ?? pref?.admin_override_enabled ?? false,
      });
      const { data } = await (supabase as any)
        .from('user_preferences')
        .select('tenant_id, franchise_id, admin_override_enabled')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (data) {
        setPref({ 
          tenant_id: data.tenant_id ?? null, 
          franchise_id: data.franchise_id ?? null, 
          admin_override_enabled: !!data.admin_override_enabled 
        });
      }
    } catch (error) {
      console.error('Failed to set scope preference:', error);
      // Fallback: Optimistically update state or show toast
    }
  }, [user, pref?.admin_override_enabled]);

  const setAdminOverride = useCallback(async (enabled: boolean, tenantIdOverride?: string | null, franchiseIdOverride?: string | null) => {
    if (!user) return;
    try {
      await (supabase as any).rpc('set_admin_override', {
        p_enabled: enabled,
        p_tenant_id: tenantIdOverride ?? pref?.tenant_id ?? null,
        p_franchise_id: franchiseIdOverride ?? pref?.franchise_id ?? null,
      });
      const { data } = await (supabase as any)
        .from('user_preferences')
        .select('tenant_id, franchise_id, admin_override_enabled')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      if (data) {
        setPref({ 
          tenant_id: data.tenant_id ?? null, 
          franchise_id: data.franchise_id ?? null, 
          admin_override_enabled: !!data.admin_override_enabled 
        });
      }
    } catch (error) {
      console.error('Failed to set admin override:', error);
    }
  }, [user, pref?.tenant_id, pref?.franchise_id]);

  return {
    user,
    context,
    supabase,
    preferences: pref,
    loadingPreferences: loadingPref,
    setScopePreference,
    setAdminOverride,
    // Backward compatibility wrapper
    setFranchisePreference: (fid: string | null, ao?: boolean) => setScopePreference(pref?.tenant_id ?? null, fid, ao),
  };
}

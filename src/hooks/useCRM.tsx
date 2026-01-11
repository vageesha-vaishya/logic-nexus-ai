import { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';

interface CRMContextType {
  user: any;
  context: DataAccessContext;
  supabase: any;
  scopedDb: ScopedDataAccess;
  preferences: { tenant_id: string | null; franchise_id: string | null; admin_override_enabled: boolean } | null;
  loadingPreferences: boolean;
  setScopePreference: (tenantId: string | null, franchiseId: string | null, adminOverride?: boolean) => Promise<void>;
  setAdminOverride: (enabled: boolean, tenantIdOverride?: string | null, franchiseIdOverride?: string | null) => Promise<void>;
  setFranchisePreference: (fid: string | null, ao?: boolean) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
  const { user, roles } = useAuth();
  const [pref, setPref] = useState<{ tenant_id: string | null; franchise_id: string | null; admin_override_enabled: boolean } | null>(null);
  const [loadingPref, setLoadingPref] = useState(false);
  
  // Track context version to force re-fetches when scope changes
  const [contextVersion, setContextVersion] = useState(0);

  const context = useMemo(() => {
    const platformAdmin = roles.find(r => r.role === 'platform_admin');
    const tenantAdmin = roles.find(r => r.role === 'tenant_admin');
    const franchiseAdmin = roles.find(r => r.role === 'franchise_admin');
    const regularUser = roles.find(r => r.role === 'user');

    const isPlatformAdmin = !!platformAdmin;
    const isTenantAdmin = !!tenantAdmin;
    const isFranchiseAdmin = !!franchiseAdmin;

    // Base scope from roles (source of truth for restricted users)
    const baseTenant = tenantAdmin?.tenant_id || franchiseAdmin?.tenant_id || regularUser?.tenant_id || null;
    const baseFranchise = franchiseAdmin?.franchise_id || regularUser?.franchise_id || null;

    // Effective scope logic
    let effectiveTenant = baseTenant;
    let effectiveFranchise = baseFranchise;
    let adminOverride = false;

    if (isPlatformAdmin) {
      // Platform Admin can override scope
      // If preference exists, use it. If not, default to Global (null)
      effectiveTenant = pref?.tenant_id ?? null;
      effectiveFranchise = pref?.franchise_id ?? null;
      adminOverride = !!pref?.admin_override_enabled;
    } else if (isTenantAdmin) {
      // Tenant Admin is bound to their tenant
      effectiveTenant = baseTenant;
      if (pref?.franchise_id) {
         effectiveFranchise = pref.franchise_id;
      } else {
         effectiveFranchise = null; // "All Franchises" in this tenant
      }
      adminOverride = false;
    } else {
      // Regular users and Franchise Admins are strictly bound
      effectiveTenant = baseTenant;
      effectiveFranchise = baseFranchise;
      adminOverride = false;
    }

    return {
      isPlatformAdmin,
      isTenantAdmin,
      isFranchiseAdmin,
      isUser: !!regularUser,
      tenantId: effectiveTenant,
      franchiseId: effectiveFranchise,
      adminOverrideEnabled: adminOverride,
      userId: user?.id,
      // Include version to track changes
      _version: contextVersion,
    };
  }, [roles, pref, user?.id, contextVersion]);

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
        // Increment version to trigger data re-fetches across all modules
        setContextVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Failed to set scope preference:', error);
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
        // Increment version to trigger data re-fetches across all modules
        setContextVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Failed to set admin override:', error);
    }
  }, [user, pref?.tenant_id, pref?.franchise_id]);

  const scopedDb = useMemo(() => new ScopedDataAccess(supabase, context), [context]);

  const value = {
    user,
    context,
    supabase,
    scopedDb,
    preferences: pref,
    loadingPreferences: loadingPref,
    setScopePreference,
    setAdminOverride,
    setFranchisePreference: (fid: string | null, ao?: boolean) => setScopePreference(pref?.tenant_id ?? null, fid, ao),
  };

  return <CRMContext.Provider value={value}>{children}</CRMContext.Provider>;
}

export function useCRM() {
  const context = useContext(CRMContext);
  if (context === undefined) {
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}

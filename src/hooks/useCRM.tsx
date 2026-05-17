import { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';
import { ScopedDataAccess, DataAccessContext } from '@/lib/db/access';
import { logger } from '@/lib/logger';

interface CRMContextType {
  user: any;
  context: DataAccessContext;
  supabase: any;
  scopedDb: ScopedDataAccess;
  /** true once auth + roles have finished loading; gates all scoped DB calls */
  contextReady: boolean;
  preferences: { tenant_id: string | null; franchise_id: string | null; admin_override_enabled: boolean } | null;
  loadingPreferences: boolean;
  setScopePreference: (tenantId: string | null, franchiseId: string | null, adminOverride?: boolean) => Promise<void>;
  setAdminOverride: (enabled: boolean, tenantIdOverride?: string | null, franchiseIdOverride?: string | null) => Promise<void>;
  setFranchisePreference: (fid: string | null, ao?: boolean) => Promise<void>;
}

const CRMContext = createContext<CRMContextType | undefined>(undefined);

export function CRMProvider({ children }: { children: ReactNode }) {
  const { user, roles, loading: authLoading, isPlatformAdmin: hasPlatformAdminAccess } = useAuth();
  const [pref, setPref] = useState<{ tenant_id: string | null; franchise_id: string | null; admin_override_enabled: boolean } | null>(null);
  const [loadingPref, setLoadingPref] = useState(false);
  
  const [contextVersion, setContextVersion] = useState(0);
  const ownedTenantId = useMemo(
    () => roles.find((role) => !!role.tenant_id)?.tenant_id ?? null,
    [roles]
  );
  const ownedFranchiseId = useMemo(
    () => roles.find((role) => !!role.franchise_id)?.franchise_id ?? null,
    [roles]
  );
  const hasTenantAdminAccess = useMemo(
    () => roles.some((role) => role.role === 'tenant_admin'),
    [roles]
  );

  const context = useMemo(() => {
    const tenantAdmin = roles.find(r => r.role === 'tenant_admin');
    const franchiseAdmin = roles.find(r => r.role === 'franchise_admin');
    const regularUser = roles.find(r => r.role === 'user');

    const isPlatformAdmin = hasPlatformAdminAccess();
    const isTenantAdmin = !!tenantAdmin;
    const isFranchiseAdmin = !!franchiseAdmin;

    const baseTenant = tenantAdmin?.tenant_id || franchiseAdmin?.tenant_id || regularUser?.tenant_id || null;
    const baseFranchise = franchiseAdmin?.franchise_id || regularUser?.franchise_id || null;

    let effectiveTenant = baseTenant;
    let effectiveFranchise = baseFranchise;
    let adminOverride = false;

    if (isPlatformAdmin) {
      adminOverride = !!pref?.admin_override_enabled;
      // If admin override is enabled, prioritize the selected tenant from preferences.
      // If not enabled, prioritize the owned tenant id if it exists.
      effectiveTenant = adminOverride ? (pref?.tenant_id ?? null) : (ownedTenantId ?? null);
      effectiveFranchise = adminOverride ? (pref?.franchise_id ?? null) : (ownedFranchiseId ?? null);
    } else if (isTenantAdmin) {
      effectiveTenant = baseTenant;
      adminOverride = !!pref?.admin_override_enabled;
      effectiveFranchise = adminOverride ? (pref?.franchise_id ?? null) : null;
    } else {
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
      ownedTenantId,
      ownedFranchiseId,
      adminOverrideEnabled: adminOverride,
      userId: user?.id,
      _version: contextVersion,
    };
  }, [roles, pref, user?.id, contextVersion, ownedTenantId, ownedFranchiseId, hasPlatformAdminAccess]);

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
      const isPlatformAdmin = hasPlatformAdminAccess();
      let nextTenantId = tenantId;
      let nextFranchiseId = franchiseId;

      if (!isPlatformAdmin) {
        nextTenantId = ownedTenantId;
        if (ownedFranchiseId) {
          nextFranchiseId = ownedFranchiseId;
        }
      } else {
        // Platform admins can switch to any tenant, but if they have an ownedTenantId,
        // we should still allow them to switch to others if they are in admin override mode.
        // The previous check was too restrictive.
        nextTenantId = tenantId;
      }

      await (supabase as any).rpc('set_user_scope_preference', {
        p_tenant_id: nextTenantId,
        p_franchise_id: nextFranchiseId,
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
        setContextVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Failed to set scope preference:', error);
      throw error;
    }
  }, [user, pref?.admin_override_enabled, ownedTenantId, ownedFranchiseId, hasPlatformAdminAccess]);

  const setAdminOverride = useCallback(async (enabled: boolean, tenantIdOverride?: string | null, franchiseIdOverride?: string | null) => {
    if (!user) return;
    try {
      const isPlatformAdmin = hasPlatformAdminAccess();
      let requestedTenantId: string | null = null;

      if (isPlatformAdmin) {
        requestedTenantId = tenantIdOverride !== undefined
          ? tenantIdOverride
          : (pref?.tenant_id ?? ownedTenantId ?? null);

        await (supabase as any).rpc('set_admin_override', {
          p_enabled: enabled,
          p_tenant_id: requestedTenantId,
          p_franchise_id: franchiseIdOverride ?? pref?.franchise_id ?? null,
        });
      } else if (hasTenantAdminAccess) {
        requestedTenantId = ownedTenantId;
        await (supabase as any).rpc('set_user_scope_preference', {
          p_tenant_id: ownedTenantId,
          p_franchise_id: enabled ? (franchiseIdOverride ?? pref?.franchise_id ?? null) : null,
          p_admin_override: enabled,
        });
      } else {
        throw new Error('Only platform admins and tenant admins can enable admin override');
      }

      // Fire-and-forget audit record — never throw
      try {
        await (supabase as any).schema('platform').from('audit_log').insert({
          domain:        'platform',
          op:            'admin_override',
          action:        enabled ? 'admin_override_enabled' : 'admin_override_disabled',
          tenant_id:     requestedTenantId ?? null,
          franchise_id:  franchiseIdOverride ?? pref?.franchise_id ?? null,
          acted_by:      user.id,
          user_id:       user.id,
          before:        { admin_override_enabled: !enabled },
          after:         { admin_override_enabled: enabled },
          resource_type: 'user_preferences',
          resource_id:   user.id,
        });
      } catch (_) { /* audit failure must never block the action */ }

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
        setContextVersion(v => v + 1);
      }
    } catch (error) {
      console.error('Failed to set admin override:', error);
      throw error;
    }
  }, [user, pref?.tenant_id, pref?.franchise_id, ownedTenantId, hasPlatformAdminAccess, hasTenantAdminAccess]);

  const scopedDb = useMemo(() => new ScopedDataAccess(supabase, context), [context]);

  const value = {
    user,
    context,
    supabase,
    scopedDb,
    contextReady: !authLoading,
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
    const storybookMock = typeof window !== 'undefined' ? (window as any).__STORYBOOK_CRM_MOCK__ : undefined;
    if (storybookMock) {
      return storybookMock as CRMContextType;
    }
    throw new Error('useCRM must be used within a CRMProvider');
  }
  return context;
}

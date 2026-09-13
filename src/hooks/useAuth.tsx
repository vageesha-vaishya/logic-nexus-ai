import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ROLE_PERMISSIONS, unionPermissions, type Permission } from '@/config/permissions';
import { RoleService } from '@/lib/api/roles';
import { ScopedDataAccess } from '@/lib/db/access';
import { logger } from '@/lib/logger';

type AppRole = 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user';

interface UserRole {
  role: AppRole;
  tenant_id: string | null;
  franchise_id: string | null;
}

interface Profile {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  must_change_password: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: any }>;
  signOut: () => Promise<{ error: any }>;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
  isPlatformAdmin: () => boolean;
  isTenantAdmin: () => boolean;
  isFranchiseAdmin: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function parseEmergencyBlockedEmails(): string[] {
  const configured = String(import.meta.env.VITE_EMERGENCY_BLOCKED_EMAILS || '').trim();
  if (!configured) return [];
  return configured
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmergencyBlockedEmail(email: string | null | undefined): boolean {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail) return false;
  return new Set(parseEmergencyBlockedEmails()).has(normalizedEmail);
}

export function hasVerifiedPlatformAdminAccess(
  platformAdminAccess: boolean,
  roles: Array<{ role: string }>,
  email?: string | null
): boolean {
  if (isEmergencyBlockedEmail(email)) return false;
  if (!platformAdminAccess) return false;
  return roles.some((role) => role.role === 'platform_admin');
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [platformAdminAccess, setPlatformAdminAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);
  // Which user's data is currently being loaded. Late-arriving permission
  // results (see loadUserData) only apply if this still matches, so a
  // sign-out / user switch mid-flight never gets overwritten by stale data.
  const activeLoadUserIdRef = useRef<string | null>(null);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId);

    if (error) {
      logger.error('Error fetching roles:', error);
      return [];
    }
    
    // Map legacy or alternative role names to system roles
    return (data || []).map((r: any) => ({
      ...r,
      role: r.role === 'super_admin' ? 'platform_admin' : r.role
    }));
  };

  const fetchCustomPermissions = async (userId: string): Promise<{ granted: Permission[], denied: Permission[] }> => {
    const { data, error } = await supabase
      .rpc('get_user_custom_permissions', { check_user_id: userId });

    if (error) {
      logger.error('Error fetching custom permissions:', error);
      return { granted: [], denied: [] };
    }
    
    const granted: Permission[] = [];
    const denied: Permission[] = [];
    
    (data || []).forEach((row: any) => {
      const perm = row.permission_key as Permission;
      if (row.access_type === 'grant') {
        granted.push(perm);
      } else if (row.access_type === 'deny') {
        denied.push(perm);
      }
    });
    
    return { granted, denied };
  };

  const fetchProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const fetchPlatformAdminAccess = async () => {
    const { data, error } = await (supabase as any).rpc('is_current_user_platform_admin');
    if (error) {
      logger.warn('Failed to resolve strict platform admin access', { error, component: 'AuthProvider' });
      return false;
    }
    return Boolean(data);
  };

  const loadUserData = async (currentUser: User) => {
    activeLoadUserIdRef.current = currentUser.id;
    try {
      logger.info('Loading user data', { userId: currentUser.id, component: 'AuthProvider' });

      // Load roles first so admin-gated UI (AdminScopeSwitcher, Transfer Center, etc.)
      // can appear even if other (slower) lookups are still running.
      // `real` lets the timer know whether the genuine fetch already won the
      // race. Without it the warning fired unconditionally 5s after start --
      // even on fast loads where nothing timed out -- which made the logs
      // read as if every permission lookup was failing all the time.
      const timeout = <T,>(ms: number, fallback: T, name: string, real?: Promise<unknown>) => {
        let settled = false;
        real?.then(() => { settled = true; }, () => { settled = true; });
        return new Promise<T>((resolve) => setTimeout(() => {
          if (!settled) {
            logger.warn(`Timeout loading ${name}`, { userId: currentUser.id, component: 'AuthProvider' });
          }
          resolve(fallback);
        }, ms));
      };

      const profileReal = fetchProfile(currentUser.id);
      const profilePromise = Promise.race([
        profileReal,
        timeout(5000, null, 'profile', profileReal)
      ]);

      // The `*Real` promises are kept separately from the timeout races so
      // that when a timeout wins, the genuine result isn't silently dropped
      // (Promise.race discards the loser) -- it's applied late instead. See
      // the late-apply block after the initial setPermissions below.
      const emptyCustomPerms = { granted: [] as Permission[], denied: [] as Permission[] };
      const customPermsReal = fetchCustomPermissions(currentUser.id).catch((e) => {
        logger.warn('Failed to load custom permissions', { error: e, component: 'AuthProvider' });
        return emptyCustomPerms;
      });
      const customPermsPromise = Promise.race([
        customPermsReal,
        timeout(5000, emptyCustomPerms, 'customPermissions', customPermsReal)
      ]);

      // Create a temporary scoped access with minimal context for fetching system definitions
      // These tables (auth_role_permissions, auth_role_hierarchy) are system-wide
      const systemContext = {
        isPlatformAdmin: false,
        isTenantAdmin: false,
        isFranchiseAdmin: false,
        userId: currentUser.id
      };
      const sda = new ScopedDataAccess(supabase, systemContext);
      const roleService = new RoleService(sda);

      const rolesReal = fetchUserRoles(currentUser.id);
      const rolesResult = await Promise.race([
        rolesReal,
        timeout(5000, [], 'userRoles', rolesReal)
      ]) as any[];

      setRoles(rolesResult);

      const dynamicMapReal = roleService.getRolePermissions(rolesResult).catch((e) => {
        logger.warn('Failed to load dynamic permissions', { error: e, component: 'AuthProvider' });
        return {} as Record<string, string[]>;
      });
      const dynamicMapPromise = Promise.race([
        dynamicMapReal,
        timeout(5000, {} as Record<string, string[]>, 'dynamicPermissions', dynamicMapReal),
      ]);

      const emptyHierarchy = { parentsToChildren: {}, childrenToParents: {}, available: false };
      const hierarchyReal = roleService.getRoleHierarchy().catch((e) => {
        logger.warn('Failed to load role hierarchy', { error: e, component: 'AuthProvider' });
        return emptyHierarchy;
      });
      const hierarchyPromise = Promise.race([
        hierarchyReal,
        timeout(5000, emptyHierarchy, 'roleHierarchy', hierarchyReal),
      ]);

      const platformAdminReal = fetchPlatformAdminAccess();
      const platformAdminPromise = Promise.race([
        platformAdminReal,
        timeout(5000, false, 'platformAdminAccess', platformAdminReal),
      ]);

      const [profileResult, customPermsResult, dynamicMapResult, hierarchyResult, platformAdminResult] = await Promise.all([
        profilePromise,
        customPermsPromise,
        dynamicMapPromise,
        hierarchyPromise,
        platformAdminPromise,
      ]);

      setProfile(profileResult);
      setPlatformAdminAccess(Boolean(platformAdminResult));

      const computeFinalPerms = (
        dynamicMapInput: Record<string, string[]> | null | undefined,
        hierarchyInput: unknown,
        customPerms: { granted: Permission[]; denied: Permission[] },
      ): Permission[] => {
        const dynamicMap = dynamicMapInput || {};
        const hierarchyParents = (hierarchyInput as any)?.childrenToParents || {};

        const standardPerms = unionPermissions(
          ...rolesResult.map((r) => {
            const base = (dynamicMap[r.role] as Permission[]) || ROLE_PERMISSIONS[r.role] || [];
            const collectAncestors = (roleId: string, visited = new Set<string>()): string[] => {
              if (visited.has(roleId)) return [];
              visited.add(roleId);
              const direct = hierarchyParents[roleId] || [];
              const all = [...direct];
              direct.forEach((pr: string) => {
                all.push(...collectAncestors(pr, visited));
              });
              return Array.from(new Set(all));
            };
            const parents = collectAncestors(r.role);
            const inherited = parents.flatMap((p: string) => ((dynamicMap[p] as Permission[]) || ROLE_PERMISSIONS[p] || []));
            return unionPermissions(base, inherited);
          })
        );

        const { granted, denied } = customPerms;
        // Merge granted permissions with standard permissions, then remove
        // denied ones (custom roles override).
        return unionPermissions(standardPerms, granted).filter((p) => !denied.includes(p));
      };

      const finalPerms = computeFinalPerms(dynamicMapResult, hierarchyResult, customPermsResult);
      setPermissions(finalPerms);
      logger.info('User data loaded successfully', { userId: currentUser.id, roleCount: rolesResult.length, permCount: finalPerms.length, component: 'AuthProvider' });

      // Late-apply. If any of the 5s timeouts above won its race, the
      // permission set just applied was computed from empty fallbacks --
      // and for a custom (non-built-in) role there is no static
      // ROLE_PERMISSIONS entry to fall back on, so it came out empty.
      // Previously that was permanent: the real fetch kept running but
      // Promise.race threw its result away, so one slow RPC on a slow
      // network left the whole session reading as "Access Denied" on
      // every ProtectedRoute. Now the genuine results are applied once
      // they land, guarded so they can't overwrite a different user's
      // session if the account changed in the meantime.
      void Promise.all([dynamicMapReal, hierarchyReal, customPermsReal]).then(
        ([realDynamic, realHierarchy, realCustom]) => {
          if (activeLoadUserIdRef.current !== currentUser.id) return;
          const latePerms = computeFinalPerms(realDynamic, realHierarchy, realCustom);
          if (latePerms.length === finalPerms.length && latePerms.every((p) => finalPerms.includes(p))) return;
          setPermissions(latePerms);
          logger.info('Applied late-arriving permission data', { userId: currentUser.id, permCount: latePerms.length, component: 'AuthProvider' });
        }
      );
    } catch (error: any) {
      logger.error('Error loading user data', { error: error.message, stack: error.stack, component: 'AuthProvider' });
      // Ensure we don't leave the app in a broken state
      setProfile(null);
      setRoles([]);
      setPermissions([]);
      setPlatformAdminAccess(false);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserData(user);
    }
  };

  useEffect(() => {
    if (!isSupabaseConfigured) {
      toast.error('Supabase is not configured');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let lastLoadedUserId: string | null = null;

    const applySession = (currentSession: Session | null, source: string) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);

      if (currentSession?.user) {
        logger.info(`Auth session applied`, { source, userId: currentSession.user.id, component: 'AuthProvider' });
        
        // Only load data if it's a new user or not yet loaded
        if (lastLoadedUserId !== currentSession.user.id) {
          lastLoadedUserId = currentSession.user.id;
          setProfile(null);
          setRoles([]);
          setPermissions([]);
          setPlatformAdminAccess(false);
          // Ensure loading is true while fetching user data
          setLoading(true);
          logger.info(`Starting user data load`, { userId: currentSession.user.id, component: 'AuthProvider' });
          loadUserData(currentSession.user)
            .then(() => {
              logger.info(`User data load completed`, { userId: currentSession.user.id, component: 'AuthProvider' });
            })
            .catch(err => {
              logger.error('Failed to load user data', { error: err, component: 'AuthProvider' });
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          // Same user, data already loaded or loading in progress.
          // Do NOT set loading to false here, as a previous fetch might still be running.
          logger.debug(`Skipping data load (already loaded/loading)`, { userId: currentSession.user.id, component: 'AuthProvider' });
        }
      } else {
        lastLoadedUserId = null;
        setProfile(null);
        setRoles([]);
        setPermissions([]);
        setPlatformAdminAccess(false);
        setLoading(false);
      }
    };

    // Safety timeout to prevent infinite loading state.
    // IMPORTANT: do NOT force-complete loading while an authenticated user's
    // roles/permissions are still being fetched, otherwise permission-gated
    // routes can incorrectly redirect to /unauthorized.
    const safetyTimeout = setTimeout(() => {
      setLoading((prev) => {
        if (!prev) return prev;

        // If we already have an authenticated user in-flight, keep waiting.
        if (lastLoadedUserId) {
          logger.warn('Auth loading is taking longer than expected; still waiting for user data...', { userId: lastLoadedUserId, component: 'AuthProvider' });
          // Force completion after 30s total (15s existing + 15s extra check effectively via loadUserData timeouts)
          // Actually, we should probably force it eventually to avoid permanent white screen.
          // But with the new timeouts in loadUserData, that should resolve naturally.
          return true;
        }

        logger.warn('Auth loading timed out (no authenticated user), forcing completion', { component: 'AuthProvider' });
        return false;
      });
    }, 15000);

    if (typeof window !== 'undefined') {
      const startAutoRefresh = (supabase.auth as any).startAutoRefresh;
      if (typeof startAutoRefresh === 'function') {
        startAutoRefresh.call(supabase.auth);
      }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      logger.info('Auth state change', { event, userId: currentSession?.user?.id, component: 'AuthProvider' });
      applySession(currentSession, `onAuthStateChange:${event}`);
    });

    // Initial session bootstrap
    supabase.auth
      .getSession()
      .then(async ({ data: { session: currentSession } }) => {
        if (cancelled) return;
        if (currentSession) {
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshData.session) {
            currentSession = refreshData.session;
          }
        }
        applySession(currentSession, 'getSession');
      })
      .catch((err) => {
        logger.error('getSession failed', { error: err, component: 'AuthProvider' });
        setLoading(false);
      });

    return () => {
      cancelled = true;
      if (typeof window !== 'undefined') {
        const stopAutoRefresh = (supabase.auth as any).stopAutoRefresh;
        if (typeof stopAutoRefresh === 'function') {
          stopAutoRefresh.call(supabase.auth);
        }
      }
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);


  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    const redirectUrl = `${window.location.origin}/`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: metadata
      }
    });
    return { error };
  };

  const signOut = async () => {
    // Clear state first to ensure immediate UI feedback
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
    setPlatformAdminAccess(false);
    
    try {
      // Use scope: 'local' to avoid CORS/network issues with global sign out
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        logger.error('Error signing out:', error);
        // Still navigate even if there's an error - user is already logged out locally
      }
      navigate('/auth');
      return { error };
    } catch (error) {
      logger.error('Unexpected error during sign out:', error);
      navigate('/auth');
      return { error: error as any };
    }
  };

  const hasRole = (role: AppRole) => {
    const result = roles.some(r => r.role === role);
    return result;
  };

  const isPlatformAdmin = () => {
    const effectiveEmail = user?.email || profile?.email || null;
    return hasVerifiedPlatformAdminAccess(platformAdminAccess, roles, effectiveEmail);
  };
  
  const isTenantAdmin = () => roles.some(r => r.role === 'tenant_admin');
  const isFranchiseAdmin = () => roles.some(r => r.role === 'franchise_admin');

  const hasPermission = (permission: Permission) => {
    // Platform admin has implicit full access
    const effectiveEmail = user?.email || profile?.email || null;
    const isAdmin = hasVerifiedPlatformAdminAccess(platformAdminAccess, roles, effectiveEmail);
    if (isAdmin) return true;
    
    // Check for wildcard permission or specific permission
    return permissions.includes('*') || permissions.includes(permission);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
      roles,
      permissions,
      loading,
      signIn,
      signUp,
      signOut,
      hasRole,
      hasPermission,
      isPlatformAdmin,
      isTenantAdmin,
      isFranchiseAdmin,
      refreshProfile
    }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

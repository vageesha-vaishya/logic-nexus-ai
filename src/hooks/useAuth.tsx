import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ROLE_PERMISSIONS, unionPermissions, type Permission } from '@/config/permissions';
import { RoleService } from '@/lib/api/roles';
import { ScopedDataAccess } from '@/lib/db/access';

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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const isFetchingRef = useRef(false);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching roles:', error);
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
      console.error('Error fetching custom permissions:', error);
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
      console.error('Error fetching profile:', error);
      return null;
    }
    return data;
  };

  const loadUserData = async (currentUser: User) => {
    try {
      console.log('Loading user data for:', currentUser.id);

      // Load roles first so admin-gated UI (AdminScopeSwitcher, Transfer Center, etc.)
      // can appear even if other (slower) lookups are still running.
      const profilePromise = fetchProfile(currentUser.id);
      const customPermsPromise = fetchCustomPermissions(currentUser.id);

      const timeout = <T,>(ms: number, fallback: T) =>
        new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms));

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

      const dynamicMapPromise = Promise.race([
        roleService.getRolePermissions().catch((e) => {
          console.warn('Failed to load dynamic permissions', e);
          return {} as Record<string, string[]>;
        }),
        timeout(2500, {} as Record<string, string[]>),
      ]);

      const hierarchyPromise = Promise.race([
        roleService.getRoleHierarchy().catch((e) => {
          console.warn('Failed to load role hierarchy', e);
          return { parentsToChildren: {}, childrenToParents: {}, available: false };
        }),
        timeout(2500, { parentsToChildren: {}, childrenToParents: {}, available: false }),
      ]);

      const rolesResult = await fetchUserRoles(currentUser.id);
      setRoles(rolesResult);

      const [profileResult, customPermsResult, dynamicMapResult, hierarchyResult] = await Promise.all([
        profilePromise,
        customPermsPromise,
        dynamicMapPromise,
        hierarchyPromise,
      ]);

      setProfile(profileResult);

      const dynamicMap = dynamicMapResult || {};
      const hierarchyParents = (hierarchyResult as any)?.childrenToParents || {};

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

      const { granted, denied } = customPermsResult;

      // Merge granted permissions with standard permissions
      const mergedPerms = unionPermissions(standardPerms, granted);

      // Remove denied permissions (custom roles override)
      const finalPerms = mergedPerms.filter((p) => !denied.includes(p));

      setPermissions(finalPerms);
      console.log('User data loaded successfully');
    } catch (error) {
      console.error('Error loading user data:', error);
      // Ensure we don't leave the app in a broken state
      setPermissions([]);
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
        console.log(`Auth session applied (${source})`, currentSession.user.id);
        
        // Only load data if it's a new user or not yet loaded
        if (lastLoadedUserId !== currentSession.user.id) {
          lastLoadedUserId = currentSession.user.id;
          // Ensure loading is true while fetching user data
          setLoading(true);
          console.log(`[Auth] Starting user data load for ${currentSession.user.id}`);
          loadUserData(currentSession.user)
            .then(() => {
              console.log(`[Auth] User data load completed for ${currentSession.user.id}`);
            })
            .catch(err => {
              console.error('[Auth] Failed to load user data:', err);
            })
            .finally(() => {
              setLoading(false);
            });
        } else {
          // Same user, data already loaded or loading in progress.
          // Do NOT set loading to false here, as a previous fetch might still be running.
          console.log(`[Auth] Skipping data load for ${currentSession.user.id} (already loaded/loading)`);
        }
      } else {
        lastLoadedUserId = null;
        setProfile(null);
        setRoles([]);
        setPermissions([]);
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
          console.warn('Auth loading is taking longer than expected; still waiting for user data...');
          return true;
        }

        console.warn('Auth loading timed out (no authenticated user), forcing completion');
        return false;
      });
    }, 15000);

    // Auth state listener MUST be synchronous; do not await or call Supabase inside callback.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      console.log('Auth state change:', event, currentSession?.user?.id);
      applySession(currentSession, `onAuthStateChange:${event}`);
    });

    // Initial session bootstrap
    supabase.auth
      .getSession()
      .then(({ data: { session: currentSession } }) => {
        if (cancelled) return;
        applySession(currentSession, 'getSession');
      })
      .catch((err) => {
        console.error('getSession failed', err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
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
    
    try {
      // Use scope: 'local' to avoid CORS/network issues with global sign out
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Error signing out:', error);
        // Still navigate even if there's an error - user is already logged out locally
      }
      navigate('/auth');
      return { error };
    } catch (error) {
      console.error('Unexpected error during sign out:', error);
      navigate('/auth');
      return { error: error as any };
    }
  };

  const hasRole = (role: AppRole) => {
    const result = roles.some(r => r.role === role);
    return result;
  };

  const isPlatformAdmin = () => {
    // Check if any role is platform_admin - this bypasses all permission checks
    const result = roles.some(r => r.role === 'platform_admin');
    return result;
  };
  
  const isTenantAdmin = () => roles.some(r => r.role === 'tenant_admin');
  const isFranchiseAdmin = () => roles.some(r => r.role === 'franchise_admin');

  const hasPermission = (permission: Permission) => {
    // Platform admin has implicit full access - check directly against roles array
    const isAdmin = roles.some(r => r.role === 'platform_admin');
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

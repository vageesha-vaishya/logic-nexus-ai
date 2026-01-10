import { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ROLE_PERMISSIONS, unionPermissions, type Permission } from '@/config/permissions';
import { RoleService } from '@/lib/api/roles';

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
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  hasPermission: (permission: Permission) => boolean;
  isPlatformAdmin: () => boolean;
  isTenantAdmin: () => boolean;
  isFranchiseAdmin: () => boolean;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserRoles = async (userId: string) => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching roles:', error);
      return [];
    }
    return data || [];
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
      
      // Fetch all required data in parallel for performance
      const [
        profileResult, 
        rolesResult, 
        customPermsResult,
        dynamicMapResult, 
        hierarchyResult
      ] = await Promise.all([
        fetchProfile(currentUser.id),
        fetchUserRoles(currentUser.id),
        fetchCustomPermissions(currentUser.id),
        RoleService.getRolePermissions().catch(e => {
          console.warn('Failed to load dynamic permissions', e);
          return {} as Record<string, string[]>;
        }),
        RoleService.getRoleHierarchy().catch(e => {
          console.warn('Failed to load role hierarchy', e);
          return { parentsToChildren: {}, childrenToParents: {}, available: false };
        })
      ]);

      setProfile(profileResult);
      setRoles(rolesResult);
      
      const dynamicMap = dynamicMapResult;
      const hierarchyParents = hierarchyResult.childrenToParents || {};

      const standardPerms = unionPermissions(
        ...rolesResult.map(r => {
          const base = (dynamicMap[r.role] as Permission[]) || ROLE_PERMISSIONS[r.role] || [];
          const collectAncestors = (roleId: string, visited = new Set<string>()): string[] => {
            if (visited.has(roleId)) return [];
            visited.add(roleId);
            const direct = hierarchyParents[roleId] || [];
            const all = [...direct];
            direct.forEach(pr => {
              all.push(...collectAncestors(pr, visited));
            });
            return Array.from(new Set(all));
          };
          const parents = collectAncestors(r.role);
          const inherited = parents.flatMap(p => ((dynamicMap[p] as Permission[]) || ROLE_PERMISSIONS[p] || []));
          return unionPermissions(base, inherited);
        })
      );
      
      const { granted, denied } = customPermsResult;
      
      // Merge granted permissions with standard permissions
      const mergedPerms = unionPermissions(standardPerms, granted);
      
      // Remove denied permissions (custom roles override)
      const finalPerms = mergedPerms.filter(p => !denied.includes(p));
      
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

    // Safety timeout to prevent infinite loading state
    const safetyTimeout = setTimeout(() => {
      setLoading(prev => {
        if (prev) {
          console.warn('Auth loading timed out, forcing completion');
          return false;
        }
        return prev;
      });
    }, 5000); // 5 seconds timeout

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log('Auth state change:', event, currentSession?.user?.id);
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
          await loadUserData(currentSession.user);
        } else {
          setProfile(null);
          setRoles([]);
          setPermissions([]);
        }
        setLoading(false);
      }
    );

    // Check for existing session (fallback if listener doesn't fire immediately)
    supabase.auth.getSession().then(async ({ data: { session: currentSession } }) => {
      if (currentSession?.user) {
         // Only act if we're still waiting for the listener or state is out of sync
         // checking !session is tricky due to closure, but we can check if loading is still true
         // effectively, we just ensure data is loaded.
         if (!session) { 
            console.log('Session found via getSession', currentSession.user.id);
            setSession(currentSession);
            setUser(currentSession.user);
            await loadUserData(currentSession.user);
            setLoading(false);
         }
      } else if (!currentSession) {
        console.log('No session found via getSession');
        setLoading(false);
      }
    }).catch(err => {
      console.error('getSession failed', err);
      setLoading(false);
    });

    return () => {
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
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setPermissions([]);
  };

  const hasRole = (role: AppRole) => {
    return roles.some(r => r.role === role);
  };

  const isPlatformAdmin = () => hasRole('platform_admin');
  const isTenantAdmin = () => hasRole('tenant_admin');
  const isFranchiseAdmin = () => hasRole('franchise_admin');

  const hasPermission = (permission: Permission) => {
    // Platform admin has implicit full access
    if (isPlatformAdmin()) return true;
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

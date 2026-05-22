import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Bug, Check, ChevronLeft, Copy, Loader2, LogOut, Menu } from 'lucide-react';
import { useSidebar } from '@/components/ui/sidebar';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { StickyActionsBar } from '@/components/ui/StickyActionsBar';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';
import { DomainSwitcher } from '@/components/navigation/DomainSwitcher';
import { MembershipSwitcher } from './MembershipSwitcher';
import { usePipeline } from '@/components/debug/pipeline/PipelineContext';
import { PipelineDashboard } from '@/components/debug/pipeline/PipelineDashboard';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { OnboardingTour } from '@/components/system/OnboardingTour';
import { ConsentBanner } from '@/components/system/ConsentBanner';
import { HelpDialog } from '@/components/system/HelpDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { APP_MENU } from '@/config/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { GlobalSearch } from '@/components/ui/global-search';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ServiceStatusBadge } from '@/components/dev/ServiceStatusBadge';
import { DarkModeToggle } from '@/components/system/DarkModeToggle';
import { TradingModeToggle } from '@/components/system/TradingModeToggle';
import { AIAssistantPanel } from '@/features/markets/components/AIAssistantPanel';
import { InAppNotificationBell, useNotificationsRealtime } from '@/features/notifications';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

type ActiveSurface = {
  routeName: string;
  routePath: string;
};

type HeaderBannerState = {
  visible: boolean;
  content: string;
  height: string;
  background: string;
  color: string;
};

type TenantBannerInfo = {
  id: string;
  name: string;
  subscriptionStatus: string;
};

type FranchiseBannerInfo = {
  id: string;
  name: string;
  region: string;
};

function normalizePattern(pattern: string) {
  return pattern.split('#')[0];
}

export function resolveActiveSurface(pathname: string, hash = ''): ActiveSurface | null {
  const navEntries = APP_MENU.flatMap(({ items }) =>
    items.flatMap((item) => {
      const screens = (item.screens ?? []).map((screen) => ({
        routeName: `${item.name} / ${screen.name}`,
        routePath: normalizePattern(screen.path),
        routeHash: screen.path.includes('#') ? `#${screen.path.split('#')[1]}` : '',
        basePath: item.path.split('/').slice(0, 3).join('/'),
      }));
      return [
        {
          routeName: item.name,
          routePath: item.path,
          routeHash: '',
          basePath: item.path.split('/').slice(0, 3).join('/'),
        },
        ...screens,
      ];
    }),
  );

  const exact = navEntries.find((entry) => {
    if (!matchPath({ path: entry.routePath, end: true }, pathname)) {
      return false;
    }
    if (entry.routeHash) {
      return entry.routeHash === hash;
    }
    return true;
  });
  if (exact) {
    return {
      routeName: exact.routeName,
      routePath: exact.routePath,
    };
  }

  const soft = navEntries.find((entry) => {
    if (entry.basePath === '/dashboard') {
      return pathname === '/dashboard';
    }
    return pathname.startsWith(entry.basePath);
  });

  if (!soft) return null;
  return {
    routeName: soft.routeName,
    routePath: soft.routePath,
  };
}

export function resolveBreadcrumbTrail(activeSurface: ActiveSurface | null): string[] {
  if (!activeSurface || activeSurface.routeName === 'Home') return [];
  return activeSurface.routeName
    .split(' / ')
    .map((segment) => segment.trim())
    .filter(Boolean);
}

const safelyRemoveRealtimeChannel = (channel: Parameters<typeof supabase.removeChannel>[0]) => {
  void supabase.removeChannel(channel).catch(() => undefined);
};

function StickyActionsMount() {
  const { actions } = useStickyActions();
  return <StickyActionsBar left={actions.left} right={actions.right} />;
}

function PipelineTrigger() {
  const { toggleDashboard } = usePipeline();
  const [isValidating, setIsValidating] = useState(false);
  const { scopedDb } = useCRM();

  const handleOpen = async () => {
    if (isValidating) return;
    setIsValidating(true);
    try {
      const { data } = await (scopedDb as any).rpc('validate_debug_access_attempt', { p_action: 'open_dashboard' });
      if (data === true) {
        toggleDashboard();
      }
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <Button variant="ghost" size="icon" onClick={handleOpen} title="Pipeline Debugger" aria-label="Pipeline Debugger" disabled={isValidating}>
      {isValidating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bug className="h-4 w-4" />}
    </Button>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useKeyboardShortcuts();
  // Global price-alert Realtime subscription — active on all dashboard pages
  useNotificationsRealtime();
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar: toggleAppSidebar, isMobile: isMobileSidebar } = useSidebar();
  const { user, profile, roles, signOut, refreshProfile } = useAuth();
  const { context, scopedDb } = useCRM();
  const { enabled: userInfoHeaderEnabled } = useAppFeatureFlag(FEATURE_FLAGS.USER_INFO_HEADER_MODULE, false);
  const { enabled: userInfoHeaderDualModeEnabled } = useAppFeatureFlag(FEATURE_FLAGS.USER_INFO_HEADER_DUAL_MODE, false);
  const { enabled: debugHeaderButtonEnabled } = useAppFeatureFlag(FEATURE_FLAGS.HEADER_DEBUG_BUTTON, false);
  const activeSurface = resolveActiveSurface(location.pathname, location.hash);
  const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantBannerInfo | null>(null);
  const [franchiseInfo, setFranchiseInfo] = useState<FranchiseBannerInfo | null>(null);
  const [scopeInfoLoading, setScopeInfoLoading] = useState(false);
  const [scopeInfoError, setScopeInfoError] = useState<string | null>(null);
  const [tenantCopied, setTenantCopied] = useState(false);
  const [userCopied, setUserCopied] = useState(false);
  const [scopeRefreshTick, setScopeRefreshTick] = useState(0);
  const [headerBanner, setHeaderBanner] = useState<HeaderBannerState>({
    visible: false,
    content: '',
    height: '48px',
    background: 'hsl(217 91% 60%)',
    color: 'hsl(0 0% 100%)',
  });
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [isPasswordSaving, setIsPasswordSaving] = useState(false);
  const [isResetSending, setIsResetSending] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileCsrfToken, setProfileCsrfToken] = useState('');

  const roleLabel = useMemo(() => {
    if (roles.some((role) => role.role === 'platform_admin')) return 'Platform Admin';
    if (roles.some((role) => role.role === 'tenant_admin')) return 'Tenant Admin';
    if (roles.some((role) => role.role === 'franchise_admin')) return 'Franchise Admin';
    return 'User';
  }, [roles]);

  const userDisplayName = useMemo(() => {
    const profileName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    if (profileName) return profileName;
    const metadataName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.user_metadata?.username;
    if (typeof metadataName === 'string' && metadataName.trim()) return metadataName.trim();
    return user?.email || 'Authenticated User';
  }, [profile?.first_name, profile?.last_name, user?.email, user?.user_metadata]);

  const userInitials = useMemo(() => {
    const parts = userDisplayName.split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return userDisplayName.slice(0, 2).toUpperCase();
  }, [userDisplayName]);

  useEffect(() => {
    const root = document.documentElement;
    const syncBanner = () => {
      const cs = getComputedStyle(root);
      const normalizeColor = (raw: string, fallback: string) => {
        const value = raw.trim();
        if (!value) return fallback;
        if (
          value.startsWith('hsl(') ||
          value.startsWith('rgb(') ||
          value.startsWith('#') ||
          value.startsWith('var(') ||
          value.startsWith('color-mix(')
        ) {
          return value;
        }
        return `hsl(${value})`;
      };
      const visible = root.getAttribute('data-header-banner-visible') === '1' || cs.getPropertyValue('--header-banner-visible').trim() === '1';
      const content = root.getAttribute('data-header-banner-content') || '';
      const height = cs.getPropertyValue('--header-banner-height').trim() || '48px';
      const background = normalizeColor(cs.getPropertyValue('--header-banner-bg'), 'hsl(217 91% 60%)');
      const color = normalizeColor(cs.getPropertyValue('--header-banner-text'), 'hsl(0 0% 100%)');
      setHeaderBanner({ visible, content, height, background, color });
    };
    syncBanner();
    const observer = new MutationObserver(syncBanner);
    observer.observe(root, { attributes: true, attributeFilter: ['style', 'class', 'data-header-banner-visible', 'data-header-banner-content'] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadScopeInfo = async () => {
      if (!userInfoHeaderEnabled) return;
      setScopeInfoLoading(true);
      setScopeInfoError(null);
      try {
        if (context.tenantId) {
          const { data: tenantData } = await scopedDb
            .from('tenants', true)
            .select('*')
            .eq('id', context.tenantId)
            .maybeSingle();
          if (!cancelled && tenantData) {
            const statusRaw =
              tenantData.subscription_status ||
              tenantData.subscription ||
              tenantData.status ||
              (tenantData.is_active === false ? 'inactive' : 'active');
            setTenantInfo({
              id: tenantData.id,
              name: tenantData.name || 'Tenant',
              subscriptionStatus: String(statusRaw || 'active'),
            });
          } else if (!cancelled) {
            setTenantInfo(null);
          }
        } else if (!cancelled) {
          setTenantInfo(null);
        }

        if (context.franchiseId) {
          const { data: franchiseData } = await scopedDb
            .from('franchises', true)
            .select('*')
            .eq('id', context.franchiseId)
            .maybeSingle();
          if (!cancelled && franchiseData) {
            setFranchiseInfo({
              id: franchiseData.id,
              name: franchiseData.name || 'Franchise',
              region: Array.isArray(franchiseData.regions)
                ? franchiseData.regions.filter(Boolean).join(', ')
                : String(franchiseData.region || franchiseData.region_name || franchiseData.code || 'N/A'),
            });
          } else if (!cancelled) {
            setFranchiseInfo(null);
          }
        } else if (!cancelled) {
          setFranchiseInfo(null);
        }
      } catch {
        if (!cancelled) {
          setTenantInfo(null);
          setFranchiseInfo(null);
          setScopeInfoError('Unable to load scope information');
        }
      } finally {
        if (!cancelled) {
          setScopeInfoLoading(false);
        }
      }
    };
    loadScopeInfo();
    return () => {
      cancelled = true;
    };
  }, [context.franchiseId, context.tenantId, scopeRefreshTick, scopedDb, userInfoHeaderEnabled]);

  useEffect(() => {
    if (!user?.id) return;

    const authSubscription = supabase.auth.onAuthStateChange((event) => {
      if (event === 'USER_UPDATED') {
        refreshProfile();
      }
    });

    const channel = supabase
      .channel(`dashboard-context-live-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` },
        async () => {
          await refreshProfile();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_roles', filter: `user_id=eq.${user.id}` },
        async () => {
          await refreshProfile();
          setScopeRefreshTick((value) => value + 1);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_preferences', filter: `user_id=eq.${user.id}` },
        async () => {
          await refreshProfile();
          setScopeRefreshTick((value) => value + 1);
        },
      );

    if (context.tenantId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tenants', filter: `id=eq.${context.tenantId}` },
        () => {
          setScopeRefreshTick((value) => value + 1);
        },
      );
    }

    if (context.franchiseId) {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'franchises', filter: `id=eq.${context.franchiseId}` },
        () => {
          setScopeRefreshTick((value) => value + 1);
        },
      );
    }

    channel.subscribe();

    return () => {
      authSubscription.data.subscription.unsubscribe();
      safelyRemoveRealtimeChannel(channel);
    };
  }, [context.franchiseId, context.tenantId, refreshProfile, user?.id]);

  const subscriptionTone = useMemo(() => {
    const status = (tenantInfo?.subscriptionStatus || '').toLowerCase();
    if (status.includes('active')) return 'text-emerald-200 border-emerald-200/40';
    if (status.includes('expired')) return 'text-amber-200 border-amber-200/40';
    if (status.includes('suspended') || status.includes('inactive')) return 'text-rose-200 border-rose-200/40';
    return 'text-white border-white/40';
  }, [tenantInfo?.subscriptionStatus]);

  const copyTenantId = async () => {
    const tenantId = tenantInfo?.id || context.tenantId;
    if (!tenantId) return;
    try {
      await navigator.clipboard.writeText(tenantId);
      setTenantCopied(true);
      window.setTimeout(() => setTenantCopied(false), 1200);
    } catch {
      setTenantCopied(false);
    }
  };

  const copyUserId = async () => {
    if (!user?.id) return;
    try {
      await navigator.clipboard.writeText(user.id);
      setUserCopied(true);
      window.setTimeout(() => setUserCopied(false), 1200);
    } catch {
      setUserCopied(false);
    }
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;
    let token = window.sessionStorage.getItem('profile:csrf-token');
    if (!token) {
      token = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
      window.sessionStorage.setItem('profile:csrf-token', token);
    }
    setProfileCsrfToken(token);
  }, []);

  const writeProfileAuditLog = async (action: string, details: Record<string, unknown>) => {
    const { error } = await scopedDb.from('audit_logs').insert({
      user_id: user?.id || null,
      tenant_id: context.tenantId || null,
      franchise_id: context.franchiseId || null,
      action,
      resource_type: 'profile_security',
      resource_id: user?.id || null,
      details,
    });
    if (error) {
      return;
    }
  };

  const validatePasswordPolicy = (value: string) => {
    if (value.length < 12) return false;
    if (!/[a-z]/.test(value)) return false;
    if (!/[A-Z]/.test(value)) return false;
    if (!/[0-9]/.test(value)) return false;
    if (!/[^A-Za-z0-9]/.test(value)) return false;
    return true;
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    const storedToken = typeof window !== 'undefined' ? window.sessionStorage.getItem('profile:csrf-token') : '';
    if (!profileCsrfToken || !storedToken || storedToken !== profileCsrfToken) {
      toast.error('Security validation failed. Refresh and try again.');
      return;
    }
    if (!currentPassword) {
      toast.error('Enter your current password.');
      return;
    }
    if (!validatePasswordPolicy(nextPassword)) {
      toast.error('New password must be 12+ chars with upper, lower, number, and symbol.');
      return;
    }
    if (nextPassword !== confirmPassword) {
      toast.error('New password and confirmation do not match.');
      return;
    }
    if (currentPassword === nextPassword) {
      toast.error('New password must be different from current password.');
      return;
    }

    setIsPasswordSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData?.session;
      if (!session?.user) {
        throw new Error('Session expired. Sign in again.');
      }
      if (session.expires_at && (session.expires_at * 1000) - Date.now() < 120000) {
        const { error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) throw refreshError;
      }

      const signInEmail = session.user.email || user?.email;
      if (!signInEmail) {
        throw new Error('Unable to verify current session email.');
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password: currentPassword,
      });
      if (verifyError) {
        throw new Error('Current password is incorrect.');
      }

      const { error: updateError } = await supabase.auth.updateUser({ password: nextPassword });
      if (updateError) throw updateError;

      await writeProfileAuditLog('user_password_changed', {
        source: 'dashboard_header_profile_menu',
        method: 'password_update',
      });

      await supabase.auth.refreshSession();
      await refreshProfile();
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to change password.');
    } finally {
      setIsPasswordSaving(false);
    }
  };

  const handlePasswordReset = async () => {
    const targetEmail = user?.email || profile?.email;
    if (!targetEmail) {
      toast.error('No account email found for password reset.');
      return;
    }
    setIsResetSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(targetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (error) throw error;
      await writeProfileAuditLog('user_password_reset_requested', {
        source: 'dashboard_header_profile_menu',
        target_email: targetEmail,
      });
      toast.success('Password reset email sent.');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send password reset email.');
    } finally {
      setIsResetSending(false);
    }
  };

  const handleSignOut = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error('Signed out locally, but server sign out returned an error.');
    }
  };

  const canShowDebugButton = context.isPlatformAdmin && debugHeaderButtonEnabled;

  return (
    <TooltipProvider>
      <div ref={shellRef} className="min-h-screen flex w-full relative">
        <ConsentBanner />
        <OnboardingTour />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[100] focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
        >
          Skip to main content
        </a>
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header
            ref={headerRef}
            className="h-12 border-b flex items-center px-3 gap-3 bg-background sticky top-0 z-10 overflow-visible relative"
            style={{
              height: headerBanner.visible ? headerBanner.height : undefined,
              color: headerBanner.visible ? headerBanner.color : undefined,
            }}
            aria-label={headerBanner.content || undefined}
          >
            {headerBanner.visible && (
              <div
                className="absolute inset-0 z-[1] pointer-events-none"
                style={{ backgroundColor: headerBanner.background }}
                role="status"
                aria-live="polite"
              />
            )}
            {headerBanner.visible && userInfoHeaderEnabled && (
              <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center px-2 sm:px-4">
                <div className="w-full max-w-[95vw] sm:max-w-[82vw] rounded-md border border-white/30 bg-black/20 px-2 sm:px-3 py-1.5 backdrop-blur-md pointer-events-auto">
                  <div className="flex items-center gap-2 text-[11px] sm:text-sm text-white overflow-hidden">
                    <Avatar className="h-6 w-6 border border-white/40">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayName} />
                      <AvatarFallback className="text-[10px] font-semibold bg-white/20 text-white">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold truncate max-w-[14ch] sm:max-w-[22ch]" title={userDisplayName}>{userDisplayName}</span>
                    {user?.id && (
                      <span className="hidden sm:inline-flex items-center gap-1 text-white/90 truncate">
                        <span className="truncate max-w-[22ch]" title={user.id}>User ID: {user.id}</span>
                        <button
                          type="button"
                          onClick={copyUserId}
                          className="inline-flex items-center justify-center rounded-sm p-0.5 hover:bg-white/20"
                          aria-label="Copy user ID"
                          title="Copy user ID"
                        >
                          {userCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </span>
                    )}
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30 shrink-0">{roleLabel}</Badge>
                    {scopeInfoLoading && (
                      <span className="inline-flex items-center gap-1 text-white/90 shrink-0">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        <span>Loading scope</span>
                      </span>
                    )}
                    {scopeInfoError && (
                      <span className="inline-flex items-center gap-1 text-amber-100 truncate">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>{scopeInfoError}</span>
                      </span>
                    )}
                    {!scopeInfoLoading && !scopeInfoError && (
                      <>
                        <span className="truncate">Tenant: {tenantInfo?.name || 'Global Scope'}</span>
                        <span className="hidden md:inline-flex items-center gap-1 truncate">
                          <span>ID: {tenantInfo?.id || context.tenantId || 'N/A'}</span>
                          {(tenantInfo?.id || context.tenantId) && (
                            <button
                              type="button"
                              onClick={copyTenantId}
                              className="inline-flex items-center justify-center rounded-sm p-0.5 hover:bg-white/20"
                              aria-label="Copy tenant ID"
                              title="Copy tenant ID"
                            >
                              {tenantCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            </button>
                          )}
                        </span>
                        <Badge variant="outline" className={subscriptionTone}>
                          Subscription: {tenantInfo?.subscriptionStatus || 'N/A'}
                        </Badge>
                      </>
                    )}
                    {context.franchiseId && (
                      <span className="hidden lg:inline truncate">
                        Franchise: {franchiseInfo?.name || 'Franchise'} ({franchiseInfo?.id || context.franchiseId}) • {franchiseInfo?.region || 'N/A'}
                      </span>
                    )}
                    {!context.tenantId && !scopeInfoLoading && (
                      <span className="inline-flex items-center gap-1 text-white/90 truncate">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                        <span>No tenant scope selected</span>
                      </span>
                    )}
                    {userInfoHeaderDualModeEnabled && (
                      <Badge variant="outline" className="hidden xl:inline-flex border-white/40 text-white/90">
                        {headerBanner.content}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}
            {headerBanner.visible && !userInfoHeaderEnabled && (
              <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center px-4">
                <span className="text-sm font-medium tracking-wide truncate max-w-[65vw]">
                  {headerBanner.content}
                </span>
              </div>
            )}
            <div className="relative z-[3] flex items-center gap-3 w-full">
              {isMobileSidebar && (
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Open navigation menu"
                  onClick={toggleAppSidebar}
                  className="md:hidden"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                aria-label="Go back"
                onClick={() => navigate(-1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Breadcrumb className="hidden md:block rounded-md bg-background/90 px-2 py-1 shadow-sm">
                <BreadcrumbList className="text-foreground font-medium">
                  <BreadcrumbItem>
                    <BreadcrumbLink asChild className="text-foreground">
                      <Link to="/dashboard">Dashboard</Link>
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  {breadcrumbTrail.map((segment) => (
                    <Fragment key={segment}>
                      <BreadcrumbSeparator className="text-foreground/90" />
                      <BreadcrumbItem>
                        <BreadcrumbPage className="text-foreground font-semibold">{segment}</BreadcrumbPage>
                      </BreadcrumbItem>
                    </Fragment>
                  ))}
                </BreadcrumbList>
              </Breadcrumb>
              <div className="flex-1" />
              <GlobalSearch />
              <ServiceStatusBadge />
              <TradingModeToggle />
              <DarkModeToggle />
              <InAppNotificationBell />
              <HelpDialog />
              {canShowDebugButton && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">
                      <PipelineTrigger />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open Pipeline Debugger</TooltipContent>
                </Tooltip>
              )}
              <MembershipSwitcher />
              <DomainSwitcher />
              <AdminScopeSwitcher />
              <ObjectMenu />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-9 px-2 gap-2">
                    <Avatar className="h-7 w-7 border">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayName} />
                      <AvatarFallback className="text-[11px] font-semibold">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="hidden lg:inline-block max-w-[16ch] truncate">{userDisplayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>
                    <div className="font-medium truncate">{userDisplayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{profile?.email || user?.email || 'No email'}</div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onSelect={() => setProfileDialogOpen(true)}>
                    Profile & Security
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={handleSignOut} className="text-red-600 focus:text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Sign Out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>
          <main id="main-content" role="main" className="flex-1 p-4 bg-muted/30 pb-24 outline-none overflow-x-hidden" style={{ backgroundImage: 'var(--app-background, none)' }} tabIndex={-1}>
            <FeatureErrorBoundary featureName="Dashboard Content">
              {children}
            </FeatureErrorBoundary>
            <StickyActionsMount />
          </main>
        </div>
        {canShowDebugButton && <PipelineDashboard />}
        <AIAssistantPanel />
        <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
          <DialogContent className="sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle>Profile & Security</DialogTitle>
              <DialogDescription>Manage your account details and security settings.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">System Information</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium truncate">{userDisplayName}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">User ID</span>
                    <span className="font-mono text-xs truncate max-w-[62%]" title={user?.id || 'N/A'}>{user?.id || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Email</span>
                    <span className="truncate">{profile?.email || user?.email || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Role</span>
                    <span>{roleLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Tenant</span>
                    <span className="truncate">{tenantInfo?.name || context.tenantId || 'Global Scope'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Tenant ID</span>
                    <span className="font-mono text-xs truncate max-w-[62%]" title={tenantInfo?.id || context.tenantId || 'N/A'}>
                      {tenantInfo?.id || context.tenantId || 'N/A'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Franchise</span>
                    <span className="truncate">{franchiseInfo?.name || context.franchiseId || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Franchise ID</span>
                    <span className="font-mono text-xs truncate max-w-[62%]" title={franchiseInfo?.id || context.franchiseId || 'N/A'}>
                      {franchiseInfo?.id || context.franchiseId || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <h3 className="text-sm font-semibold">Change Password</h3>
                <input type="hidden" value={profileCsrfToken} readOnly />
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    disabled={isPasswordSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    value={nextPassword}
                    onChange={(event) => setNextPassword(event.target.value)}
                    disabled={isPasswordSaving}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    disabled={isPasswordSaving}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Use 12+ characters with uppercase, lowercase, number, and symbol.</p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button type="submit" disabled={isPasswordSaving}>
                    {isPasswordSaving ? 'Updating...' : 'Update Password'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handlePasswordReset} disabled={isResetSending}>
                    {isResetSending ? 'Sending reset...' : 'Send Password Reset Email'}
                  </Button>
                </div>
              </form>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
}

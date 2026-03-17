import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bug, ChevronLeft } from 'lucide-react';
import { Link, matchPath, useLocation, useNavigate } from 'react-router-dom';
import { useStickyActions } from '@/components/layout/StickyActionsContext';
import { StickyActionsBar } from '@/components/ui/StickyActionsBar';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';
import { DomainSwitcher } from '@/components/navigation/DomainSwitcher';
import { usePipeline } from '@/components/debug/pipeline/PipelineContext';
import { PipelineDashboard } from '@/components/debug/pipeline/PipelineDashboard';
import { FeatureErrorBoundary } from '@/components/FeatureErrorBoundary';
import { OnboardingTour } from '@/components/system/OnboardingTour';
import { HelpDialog } from '@/components/system/HelpDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { APP_MENU } from '@/config/navigation';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
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

function StickyActionsMount() {
  const { actions } = useStickyActions();
  return <StickyActionsBar left={actions.left} right={actions.right} />;
}

function PipelineTrigger() {
  const { toggleDashboard } = usePipeline();
  return (
    <Button variant="ghost" size="icon" onClick={toggleDashboard} title="Pipeline Debugger" aria-label="Pipeline Debugger">
      <Bug className="h-4 w-4" />
    </Button>
  );
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  useKeyboardShortcuts();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, profile, roles } = useAuth();
  const { context, scopedDb } = useCRM();
  const { enabled: userInfoHeaderEnabled } = useAppFeatureFlag(FEATURE_FLAGS.USER_INFO_HEADER_MODULE, false);
  const { enabled: debugHeaderButtonEnabled } = useAppFeatureFlag(FEATURE_FLAGS.HEADER_DEBUG_BUTTON, false);
  const activeSurface = resolveActiveSurface(location.pathname, location.hash);
  const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [tenantInfo, setTenantInfo] = useState<TenantBannerInfo | null>(null);
  const [franchiseInfo, setFranchiseInfo] = useState<FranchiseBannerInfo | null>(null);
  const [headerBanner, setHeaderBanner] = useState<HeaderBannerState>({
    visible: false,
    content: '',
    height: '48px',
    background: 'hsl(217 91% 60%)',
    color: 'hsl(0 0% 100%)',
  });

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
              region: String(franchiseData.region || franchiseData.region_name || franchiseData.code || 'N/A'),
            });
          }
        } else if (!cancelled) {
          setFranchiseInfo(null);
        }
      } catch {
        if (!cancelled) {
          setTenantInfo(null);
          setFranchiseInfo(null);
        }
      }
    };
    loadScopeInfo();
    return () => {
      cancelled = true;
    };
  }, [context.franchiseId, context.tenantId, scopedDb, userInfoHeaderEnabled]);

  const canShowDebugButton = context.isPlatformAdmin && debugHeaderButtonEnabled;

  return (
    <TooltipProvider>
      <div ref={shellRef} className="min-h-screen flex w-full relative">
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
              <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center px-4">
                <div className="max-w-[72vw] rounded-md border border-white/30 bg-black/20 px-3 py-1.5 backdrop-blur-md">
                  <div className="flex items-center gap-2 text-xs sm:text-sm text-white">
                    <Avatar className="h-6 w-6 border border-white/40">
                      <AvatarImage src={profile?.avatar_url || undefined} alt={userDisplayName} />
                      <AvatarFallback className="text-[10px] font-semibold bg-white/20 text-white">{userInitials}</AvatarFallback>
                    </Avatar>
                    <span className="font-semibold truncate max-w-[22ch]">{userDisplayName}</span>
                    <Badge variant="secondary" className="bg-white/20 text-white border-white/30">{roleLabel}</Badge>
                    <span className="truncate">Tenant: {tenantInfo?.name || 'Global Scope'}</span>
                    <span className="hidden lg:inline truncate">ID: {tenantInfo?.id || context.tenantId || 'N/A'}</span>
                    <span className="hidden md:inline truncate">Subscription: {tenantInfo?.subscriptionStatus || 'N/A'}</span>
                    {context.franchiseId && (
                      <span className="hidden xl:inline truncate">
                        Franchise: {franchiseInfo?.name || 'Franchise'} ({franchiseInfo?.id || context.franchiseId}) • {franchiseInfo?.region || 'N/A'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
            {headerBanner.visible && !userInfoHeaderEnabled && (
              <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center px-4">
                <span className="text-sm font-medium tracking-wide truncate max-w-[65vw]">
                  {headerBanner.content || 'System notification'}
                </span>
              </div>
            )}
            <div className="relative z-[3] flex items-center gap-3 w-full">
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
              <DomainSwitcher />
              <AdminScopeSwitcher />
              <ObjectMenu />
            </div>
          </header>
          <main id="main-content" className="flex-1 p-4 bg-muted/30 pb-24 outline-none overflow-x-hidden" style={{ backgroundImage: 'var(--app-background, none)' }} tabIndex={-1}>
            <FeatureErrorBoundary featureName="Dashboard Content">
              {children}
            </FeatureErrorBoundary>
            <StickyActionsMount />
          </main>
        </div>
        {canShowDebugButton && <PipelineDashboard />}
      </div>
    </TooltipProvider>
  );
}

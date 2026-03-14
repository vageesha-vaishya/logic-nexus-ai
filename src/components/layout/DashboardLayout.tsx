import { SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { ObjectMenu } from './ObjectMenu';
import { Button } from '@/components/ui/button';
import { Bug, ChevronLeft, Search } from 'lucide-react';
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
import { APP_MENU } from '@/config/navigation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { GlobalSearch } from '@/components/ui/global-search';

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
  const activeSurface = resolveActiveSurface(location.pathname, location.hash);
  const breadcrumbTrail = resolveBreadcrumbTrail(activeSurface);
  const [showGlobalSearch, setShowGlobalSearch] = useState(true);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const [headerBanner, setHeaderBanner] = useState<HeaderBannerState>({
    visible: false,
    content: '',
    height: '48px',
    background: 'hsl(217 91% 60%)',
    color: 'hsl(0 0% 100%)',
  });

  useEffect(() => {
    const saved = localStorage.getItem('shell:showGlobalSearch');
    if (saved === 'false') {
      setShowGlobalSearch(false);
    }
  }, []);

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

  const toggleGlobalSearch = () => {
    setShowGlobalSearch((prev) => {
      const next = !prev;
      localStorage.setItem('shell:showGlobalSearch', String(next));
      return next;
    });
  };

  return (
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
          className="h-12 border-b flex items-center px-3 gap-3 bg-background sticky top-0 z-10 overflow-hidden relative"
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
          {headerBanner.visible && (
            <div className="absolute inset-0 z-[2] pointer-events-none flex items-center justify-center px-4">
              <span className="text-sm font-medium tracking-wide truncate max-w-[65vw]">
                {headerBanner.content || 'System notification'}
              </span>
            </div>
          )}
          <div className="relative z-[3] flex items-center gap-3 w-full">
            <SidebarTrigger />
            <Button
              variant="ghost"
              size="icon"
              aria-label="Go back"
              onClick={() => navigate(-1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Breadcrumb className="hidden md:block">
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/dashboard">Dashboard</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {breadcrumbTrail.map((segment) => (
                  <Fragment key={segment}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      <BreadcrumbPage>{segment}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleGlobalSearch}
              aria-label={showGlobalSearch ? 'Hide global search' : 'Show global search'}
              title={showGlobalSearch ? 'Hide global search' : 'Show global search'}
              className="hidden xl:inline-flex"
            >
              <Search className="h-4 w-4" />
            </Button>
            <div className={cn('hidden xl:block', !showGlobalSearch && 'hidden')}>
              <GlobalSearch />
            </div>
            <HelpDialog />
            <PipelineTrigger />
            <DomainSwitcher />
            <AdminScopeSwitcher />
            <ObjectMenu />
          </div>
        </header>
        <main id="main-content" className="flex-1 p-4 bg-muted/30 pb-24 outline-none" style={{ backgroundImage: 'var(--app-background, none)' }} tabIndex={-1}>
          <FeatureErrorBoundary featureName="Dashboard Content">
            {children}
          </FeatureErrorBoundary>
          <StickyActionsMount />
        </main>
      </div>
      <PipelineDashboard />
    </div>
  );
}

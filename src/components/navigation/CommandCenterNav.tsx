import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { 
  Search, 
  ChevronDown, 
  Settings,
  GitBranch,
  FileText,
  Package,
  Users,
  ArrowRightLeft,
  Activity,
  Globe,
  LucideIcon
} from 'lucide-react';
import { APP_MENU } from '@/config/navigation';
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { Input } from '@/components/ui/input';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { cn } from '@/lib/utils';
import { useDomain } from '@/contexts/DomainContext';
import { FEATURE_FLAGS, useAppFeatureFlag } from '@/lib/feature-flags';
import { useAuth } from '@/hooks/useAuth';
import { DEFAULT_MENU_GROUP_STRIP_COLORS } from '@/hooks/useTheme';

interface MenuItem {
  title: string;
  url: string;
  icon: LucideIcon;
  roles?: string[];
  permissions?: string[];
  group?: string;
}

interface MenuGroup {
  id: string;
  label: string;
  items: MenuItem[];
  defaultOpen?: boolean;
}

const HIDDEN_SALES_ITEM_TITLES = new Set(['Dashboards', 'Reports']);
const CRM_ITEM_TITLES = new Set([
  'Leads',
  'Tasks/Activities',
  'Opportunities',
  'Accounts',
  'Contacts',
]);
const SALES_PRIORITY_ITEM_TITLES = ['Quotes', 'Quote Templates'];
const GROUPS_STORAGE_KEY = 'sidebar:groups';
const EXPANDED_ITEMS_STORAGE_KEY = 'sidebar:expandedItems';
const AMRO_COLLAPSED_STORAGE_KEY = 'sidebar:amroCollapsed';
const GROUP_STRIP_COLOR_TOKEN: Record<string, { cssVar: string; fallback: string }> = {
  crm: { cssVar: '--menu-strip-crm', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.crm },
  sales: { cssVar: '--menu-strip-sales', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.sales },
  financials: { cssVar: '--menu-strip-financials', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.financials },
  logistics: { cssVar: '--menu-strip-logistics', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.logistics },
  uim: { cssVar: '--menu-strip-uim', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.other },
  amro: { cssVar: '--menu-strip-amro', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.amro },
  markets: { cssVar: '--menu-strip-markets', fallback: '#0d9488' },
  admin: { cssVar: '--menu-strip-administration', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.administration },
  administration: { cssVar: '--menu-strip-administration', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.administration },
  other: { cssVar: '--menu-strip-other', fallback: DEFAULT_MENU_GROUP_STRIP_COLORS.other },
};
const GROUP_THEME: Record<string, { heading: string; trigger: string; item: string; active: string; icon: string; iconActive: string; panel: string }> = {
  crm: {
    heading: 'text-violet-700 dark:text-violet-300',
    trigger: 'hover:bg-violet-500/10 hover:text-violet-900 dark:hover:text-violet-100',
    item: 'hover:bg-violet-500/10',
    active: 'border-violet-500/30 bg-gradient-to-r from-violet-500/20 to-violet-500/5 text-violet-900 dark:text-violet-100',
    icon: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
    iconActive: 'bg-violet-500/20 text-violet-900 dark:text-violet-100',
    panel: 'border-violet-500/10 bg-gradient-to-br from-violet-500/[0.06] via-transparent to-transparent',
  },
  sales: {
    heading: 'text-blue-700 dark:text-blue-300',
    trigger: 'hover:bg-blue-500/10 hover:text-blue-900 dark:hover:text-blue-100',
    item: 'hover:bg-blue-500/10',
    active: 'border-blue-500/30 bg-gradient-to-r from-blue-500/20 to-blue-500/5 text-blue-900 dark:text-blue-100',
    icon: 'bg-blue-500/10 text-blue-700 dark:text-blue-300',
    iconActive: 'bg-blue-500/20 text-blue-900 dark:text-blue-100',
    panel: 'border-blue-500/10 bg-gradient-to-br from-blue-500/[0.06] via-transparent to-transparent',
  },
  financials: {
    heading: 'text-emerald-700 dark:text-emerald-300',
    trigger: 'hover:bg-emerald-500/10 hover:text-emerald-900 dark:hover:text-emerald-100',
    item: 'hover:bg-emerald-500/10',
    active: 'border-emerald-500/30 bg-gradient-to-r from-emerald-500/20 to-emerald-500/5 text-emerald-900 dark:text-emerald-100',
    icon: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    iconActive: 'bg-emerald-500/20 text-emerald-900 dark:text-emerald-100',
    panel: 'border-emerald-500/10 bg-gradient-to-br from-emerald-500/[0.06] via-transparent to-transparent',
  },
  logistics: {
    heading: 'text-amber-700 dark:text-amber-300',
    trigger: 'hover:bg-amber-500/10 hover:text-amber-900 dark:hover:text-amber-100',
    item: 'hover:bg-amber-500/10',
    active: 'border-amber-500/30 bg-gradient-to-r from-amber-500/20 to-amber-500/5 text-amber-900 dark:text-amber-100',
    icon: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
    iconActive: 'bg-amber-500/20 text-amber-900 dark:text-amber-100',
    panel: 'border-amber-500/10 bg-gradient-to-br from-amber-500/[0.06] via-transparent to-transparent',
  },
  uim: {
    heading: 'text-indigo-700 dark:text-indigo-300',
    trigger: 'hover:bg-indigo-500/10 hover:text-indigo-900 dark:hover:text-indigo-100',
    item: 'hover:bg-indigo-500/10',
    active: 'border-indigo-500/30 bg-gradient-to-r from-indigo-500/20 to-indigo-500/5 text-indigo-900 dark:text-indigo-100',
    icon: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
    iconActive: 'bg-indigo-500/20 text-indigo-900 dark:text-indigo-100',
    panel: 'border-indigo-500/10 bg-gradient-to-br from-indigo-500/[0.06] via-transparent to-transparent',
  },
  amro: {
    heading: 'text-cyan-700 dark:text-cyan-300',
    trigger: 'hover:bg-cyan-500/10 hover:text-cyan-900 dark:hover:text-cyan-100',
    item: 'hover:bg-cyan-500/10',
    active: 'border-cyan-500/30 bg-gradient-to-r from-cyan-500/20 to-cyan-500/5 text-cyan-900 dark:text-cyan-100',
    icon: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300',
    iconActive: 'bg-cyan-500/20 text-cyan-900 dark:text-cyan-100',
    panel: 'border-cyan-500/10 bg-gradient-to-br from-cyan-500/[0.06] via-transparent to-transparent',
  },
  admin: {
    heading: 'text-fuchsia-700 dark:text-fuchsia-300',
    trigger: 'hover:bg-fuchsia-500/10 hover:text-fuchsia-900 dark:hover:text-fuchsia-100',
    item: 'hover:bg-fuchsia-500/10',
    active: 'border-fuchsia-500/30 bg-gradient-to-r from-fuchsia-500/20 to-fuchsia-500/5 text-fuchsia-900 dark:text-fuchsia-100',
    icon: 'bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300',
    iconActive: 'bg-fuchsia-500/20 text-fuchsia-900 dark:text-fuchsia-100',
    panel: 'border-fuchsia-500/10 bg-gradient-to-br from-fuchsia-500/[0.06] via-transparent to-transparent',
  },
  markets: {
    heading: 'text-teal-700 dark:text-teal-300',
    trigger: 'hover:bg-teal-500/10 hover:text-teal-900 dark:hover:text-teal-100',
    item: 'hover:bg-teal-500/10',
    active: 'border-teal-500/30 bg-gradient-to-r from-teal-500/20 to-teal-500/5 text-teal-900 dark:text-teal-100',
    icon: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
    iconActive: 'bg-teal-500/20 text-teal-900 dark:text-teal-100',
    panel: 'border-teal-500/10 bg-gradient-to-br from-teal-500/[0.06] via-transparent to-transparent',
  },
};

// Domain-only builds (VITE_DOMAIN_ONLY=markets, etc.) never reach these
// routes — they aren't in the Markets manifest. Gating the prefetcher
// map on the env literal lets Vite's define-replacement substitute the
// string at build time; the ternary then constant-folds to `{}` and
// Rollup drops the dynamic imports, pruning ~500 kB of orphan chunks
// from the APK. The unified web build keeps the full prefetch behaviour.
const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> =
  import.meta.env.VITE_DOMAIN_ONLY
    ? {}
    : {
        '/dashboard': () => import('@/pages/dashboard/Dashboards'),
        '/dashboard/leads/pipeline': () => import('@/pages/dashboard/LeadsPipeline'),
        '/dashboard/opportunities/pipeline': () => import('@/pages/dashboard/OpportunitiesPipeline'),
        '/dashboard/accounts/pipeline': () => import('@/pages/dashboard/AccountsPipeline'),
        '/dashboard/contacts/pipeline': () => import('@/pages/dashboard/ContactsPipeline'),
        '/dashboard/quotes/pipeline': () => import('@/pages/dashboard/QuotesPipeline'),
        '/dashboard/bookings': () => import('@/pages/dashboard/Bookings'),
        '/dashboard/shipments/pipeline': () => import('@/pages/dashboard/ShipmentsPipeline'),
        '/dashboard/uim': () => import('@/pages/dashboard/UimShell'),
        '/dashboard/settings': () => import('@/pages/dashboard/Settings'),
      };

const IDLE_PREFETCH_ROUTES = [
  '/dashboard',
  '/dashboard/leads/pipeline',
  '/dashboard/opportunities/pipeline',
  '/dashboard/shipments/pipeline',
];

export function CommandCenterNav() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const { availableDomains } = useDomain();
  const { hasRole, hasPermission, isPlatformAdmin: isAuthPlatformAdmin } = useAuth();
  const { enabled: amroRbacFixEnabled } = useAppFeatureFlag(FEATURE_FLAGS.AMRO_RBAC_FIX_ENABLED, true);
  // Phase 1 (2026-05-22): platform-admin short-circuits removed.
  // Per docs/plans/2026-05-20-multi-domain-platform-sequence-design.md §B.3,
  // production behaviour now matches paying-customer behaviour — nav
  // visibility is driven solely by tenant_domain_assignments. Verified safe:
  // every active tenant on prod has AMRO + MARKETS assignments via the
  // 2026-04-11 (AMRO) and 2026-05-20 (MARKETS) seed-and-assign migrations.
  const hasAmroDomain = availableDomains.some(
    (domain) => String(domain.code || '').trim().toUpperCase() === 'AMRO',
  );
  const hasMarketsDomain = availableDomains.some(
    (domain) => String(domain.code || '').trim().toUpperCase() === 'MARKETS',
  );
  const prefetchedRoutes = useRef(new Set<string>());
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    const getStoredExpandedItems = () => {
      const localValue = localStorage.getItem(EXPANDED_ITEMS_STORAGE_KEY);
      if (localValue) return localValue;
      const sessionValue = sessionStorage.getItem(EXPANDED_ITEMS_STORAGE_KEY);
      if (sessionValue) {
        localStorage.setItem(EXPANDED_ITEMS_STORAGE_KEY, sessionValue);
      }
      return sessionValue;
    };
    try {
      const saved = getStoredExpandedItems();
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [amroGroupCollapsed, setAmroGroupCollapsed] = useState<boolean>(() => {
    const getStoredValue = () => {
      const localValue = localStorage.getItem(AMRO_COLLAPSED_STORAGE_KEY);
      if (localValue) return localValue;
      const sessionValue = sessionStorage.getItem(AMRO_COLLAPSED_STORAGE_KEY);
      if (sessionValue) {
        localStorage.setItem(AMRO_COLLAPSED_STORAGE_KEY, sessionValue);
      }
      return sessionValue;
    };
    try {
      const saved = getStoredValue();
      return saved ? Boolean(JSON.parse(saved)) : false;
    } catch {
      return false;
    }
  });
  
  // Manage collapsible states with persistence
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const defaults = {
      crm: true,
      sales: false,
      logistics: false,
      uim: false,
      amro: false,
      markets: false,
      financials: false,
      admin: false,
    };

    const normalizeStoredGroups = (value: unknown) => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return defaults;
      }
      const stored = value as Record<string, unknown>;
      const legacySalesState = typeof stored.sales === 'boolean' ? stored.sales : defaults.sales;
      const normalized: Record<string, boolean> = {
        ...defaults,
        ...Object.fromEntries(
          Object.entries(stored).filter(([, groupOpen]) => typeof groupOpen === 'boolean')
        ) as Record<string, boolean>,
      };
      if (typeof stored.crm !== 'boolean') {
        normalized.crm = legacySalesState;
        normalized.sales = defaults.sales;
      }
      return normalized;
    };

    const getStoredGroups = () => {
      const localValue = localStorage.getItem(GROUPS_STORAGE_KEY);
      if (localValue) return localValue;
      const sessionValue = sessionStorage.getItem(GROUPS_STORAGE_KEY);
      if (sessionValue) {
        localStorage.setItem(GROUPS_STORAGE_KEY, sessionValue);
      }
      return sessionValue;
    };

    try {
      const saved = getStoredGroups();
      return saved ? normalizeStoredGroups(JSON.parse(saved)) : defaults;
    } catch {
      return defaults;
    }
  });

  const toggleGroup = (group: string) => {
    if (group === 'amro') {
      setAmroGroupCollapsed((prevCollapsed) => {
        const nextCollapsed = !prevCollapsed;
        localStorage.setItem(AMRO_COLLAPSED_STORAGE_KEY, JSON.stringify(nextCollapsed));
        setOpenGroups((prevGroups) => {
          const nextGroups = { ...prevGroups, amro: !nextCollapsed };
          localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(nextGroups));
          return nextGroups;
        });
        return nextCollapsed;
      });
      return;
    }

    setOpenGroups(prev => {
      const next = { ...prev, [group]: !prev[group] };
      if ((group === 'crm' || group === 'sales') && !prev[group]) {
        const otherGroup = group === 'crm' ? 'sales' : 'crm';
        next[otherGroup] = false;
      }
      localStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const prefetchRoute = useCallback((route: string) => {
    if (prefetchedRoutes.current.has(route)) {
      return;
    }
    const prefetcher = ROUTE_PREFETCHERS[route];
    if (!prefetcher) {
      return;
    }
    prefetchedRoutes.current.add(route);
    prefetcher().catch(() => {
      prefetchedRoutes.current.delete(route);
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const idleRunner = () => {
      IDLE_PREFETCH_ROUTES.forEach(prefetchRoute);
    };
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(idleRunner, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const timeoutId = globalThis.setTimeout(idleRunner, 700);
    return () => globalThis.clearTimeout(timeoutId);
  }, [prefetchRoute]);

  const toggleExpandedItems = (groupId: string) => {
    setExpandedItems((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] };
      localStorage.setItem(EXPANDED_ITEMS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  // 1. Aggregate all menu items
  const menuGroups: MenuGroup[] = useMemo(() => {
    const canAccessItem = (item: MenuItem) => {
      const roleAllowed = !item.roles || item.roles.length === 0 || item.roles.some((role) => hasRole(role as any)) || isAuthPlatformAdmin();
      const permissionAllowed = !item.permissions || item.permissions.length === 0 || item.permissions.some((permission) => hasPermission(permission as any));
      return roleAllowed && permissionAllowed;
    };

    const mapModuleItems = (label: string) =>
      (APP_MENU.find((m) => m.label === label)?.items ?? []).map((item) => ({
        title: item.name,
        url: item.path,
        icon: item.icon,
        roles: (item as any).roles,
        permissions: (item as any).permissions,
      }));

    // Sales & CRM
    const baseSalesItems = mapModuleItems('Sales').filter((item) => !HIDDEN_SALES_ITEM_TITLES.has(item.title));
    const crmItems = baseSalesItems.filter((item) => CRM_ITEM_TITLES.has(item.title));
    const salesItems = [
      ...SALES_PRIORITY_ITEM_TITLES.flatMap((title) => baseSalesItems.filter((item) => item.title === title)),
      ...baseSalesItems.filter((item) => !CRM_ITEM_TITLES.has(item.title) && !SALES_PRIORITY_ITEM_TITLES.includes(item.title)),
    ];

    // Logistics
    const logisticsItems = mapModuleItems('Logistics');
    const uimItems = mapModuleItems('UIM');
    const amroItems = hasAmroDomain
      ? mapModuleItems('AMRO').filter((item) => (amroRbacFixEnabled ? canAccessItem(item) : true))
      : [];

    const marketsItems = hasMarketsDomain
      ? mapModuleItems('Markets').filter(canAccessItem)
      : [];

    // Financials (Finance + Billing)
    const financialItems = [
      ...mapModuleItems('Finance'),
      ...mapModuleItems('Billing'),
    ];

    // Admin
    const adminItems = [
      { title: 'Lead Assignment', url: '/dashboard/lead-assignment', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_assignment.manage'] },
      { title: 'Lead Routing', url: '/dashboard/lead-routing', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_routing.manage'] },
      { title: 'Tenants', url: '/dashboard/tenants', icon: FileText, roles: ['platform_admin'], permissions: ['admin.tenants.manage'] },
      { title: 'Business Domain Assignments', url: '/dashboard/settings/domains', icon: Globe, roles: ['platform_admin'] },
      { title: 'Franchises', url: '/dashboard/franchises', icon: Package, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.franchises.manage'] },
      { title: 'Users', url: '/dashboard/users', icon: Users, roles: ['platform_admin', 'tenant_admin', 'franchise_admin'], permissions: ['admin.users.manage'] },
      { title: 'Transfer Center', url: '/dashboard/transfers', icon: ArrowRightLeft, roles: ['platform_admin'], permissions: ['transfers.view'] },
      { title: 'System Logs', url: '/dashboard/system-logs', icon: Activity, roles: ['platform_admin'] },
      { title: 'Settings', url: '/dashboard/settings', icon: Settings, roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
    ];

    return [
      { id: 'crm', label: 'CRM', items: crmItems },
      { id: 'sales', label: 'Sales', items: salesItems },
      { id: 'markets', label: 'Markets', items: marketsItems },
      { id: 'financials', label: 'Financials', items: financialItems },
      { id: 'logistics', label: 'Logistics', items: logisticsItems },
      { id: 'uim', label: 'UIM', items: uimItems },
      { id: 'amro', label: 'AMRO', items: amroItems },
      { id: 'admin', label: 'Administration', items: adminItems },
    ].filter((group) => group.items.length > 0);
  }, [amroRbacFixEnabled, hasAmroDomain, hasMarketsDomain, hasPermission, hasRole, isAuthPlatformAdmin]);

  // 2. Filter Logic
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return menuGroups;

    const query = searchQuery.toLowerCase();
    
    return menuGroups.map(group => ({
      ...group,
      items: group.items.filter(item => 
        item.title.toLowerCase().includes(query)
      )
    })).filter(group => group.items.length > 0);
  }, [menuGroups, searchQuery]);

  const getGroupTheme = (groupId: string) => GROUP_THEME[groupId] ?? GROUP_THEME.crm;
  const getGroupStripColor = (groupId: string) => {
    const token = GROUP_STRIP_COLOR_TOKEN[groupId] ?? GROUP_STRIP_COLOR_TOKEN.other;
    return `hsl(var(${token.cssVar}, ${token.fallback}))`;
  };

  const getNavClass = (groupId: string, isActive: boolean) => {
    const theme = getGroupTheme(groupId);
    if (collapsed) {
      return cn(
        "group/menu-link relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl border text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
        isActive
          ? cn("font-semibold shadow-sm ring-1 ring-inset", theme.active)
          : cn("border-transparent text-muted-foreground hover:text-foreground hover:scale-[1.03]", theme.item),
      );
    }

    return cn(
      "group/menu-link relative flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2.5 text-sm leading-5 transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
      isActive
        ? cn("font-semibold shadow-sm", theme.active)
        : cn("border-transparent text-muted-foreground hover:text-foreground hover:translate-x-0.5", theme.item),
    );
  };

  const renderMenuItem = (item: MenuItem, groupId: string) => {
    const theme = getGroupTheme(groupId);
    const node = (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
          <NavLink 
            to={item.url} 
            end={item.url === '/dashboard'} 
            className={({ isActive }) => getNavClass(groupId, isActive)}
            onClick={(e) => {
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                navigate(item.url);
              }
            }}
            onMouseEnter={() => prefetchRoute(item.url)}
            onFocus={() => prefetchRoute(item.url)}
            aria-label={item.title}
          >
            {({ isActive }) => (
              <>
                <span
                  aria-hidden="true"
                  data-menu-strip={groupId}
                  className={cn(
                    "absolute bg-current/0 transition-opacity duration-200",
                    collapsed ? "left-1.5 top-1.5 h-1.5 w-7 rounded-full" : "left-0.5 top-1.5 bottom-1.5 w-1 rounded-full",
                    isActive ? "opacity-100" : "opacity-75",
                  )}
                  style={{ backgroundColor: getGroupStripColor(groupId) }}
                />
                <span
                  className={cn(
                    "flex shrink-0 items-center justify-center rounded-md transition-all duration-200",
                    collapsed ? "h-8 w-8" : "h-7 w-7",
                    isActive ? theme.iconActive : theme.icon,
                  )}
                >
                  <item.icon className={cn("shrink-0", collapsed ? "h-[18px] w-[18px]" : "h-4 w-4")} />
                </span>
                {!collapsed && <span className="truncate font-medium">{item.title}</span>}
                {!collapsed && isActive && <span className="ml-auto h-2.5 w-2.5 rounded-full" style={{ backgroundColor: getGroupStripColor(groupId) }} />}
              </>
            )}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );

    if (item.roles || item.permissions) {
      return (
        <RoleGuard key={item.url} roles={(item.roles as any) || []} permissions={(item.permissions as any)}>
        {node}
      </RoleGuard>
      );
    }
    return node;
  };

  return (
    <div className="flex flex-col gap-2 pb-2">
      {/* Search Bar - Only visible when expanded */}
      {!collapsed && (
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
              aria-label="Search modules"
              className="h-9 rounded-lg border-sidebar-border/60 bg-background/60 pl-8 transition-colors focus:bg-background"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Menu Groups */}
      {filteredGroups.map((group) => {
        // If searching, show flattened lists (always open)
        // If not searching, use collapsible behavior (except for first group usually)
        const isSearchActive = !!searchQuery.trim();
        const hasActiveItem = group.items.some((item) =>
          item.url !== '/dashboard' && (location.pathname === item.url || location.pathname.startsWith(`${item.url}/`))
        );
        const isOpen = group.id === 'amro'
          ? isSearchActive || group.defaultOpen || (!amroGroupCollapsed && (openGroups[group.id] || hasActiveItem))
          : isSearchActive || openGroups[group.id] || group.defaultOpen || hasActiveItem;
        const isLowFrequencyGroup = group.id === 'logistics' || group.id === 'uim' || group.id === 'financials' || group.id === 'admin' || group.id === 'amro';
        const isExpanded = !!expandedItems[group.id];
        const visibleItems =
          !isSearchActive && !collapsed && isLowFrequencyGroup && !isExpanded
            ? group.items.slice(0, 6)
            : group.items;
        const hiddenCount = group.items.length - visibleItems.length;

        const theme = getGroupTheme(group.id);

        return (
          <Collapsible 
            key={group.id} 
            open={isOpen} 
            onOpenChange={() => !isSearchActive && toggleGroup(group.id)}
            disabled={isSearchActive || group.defaultOpen} // Disable toggle if searching or if forced open
          >
            <SidebarGroup className={cn("rounded-xl border px-1.5 py-1", collapsed ? "border-transparent bg-transparent" : theme.panel)}>
              <SidebarGroupLabel asChild>
                {group.defaultOpen || isSearchActive ? (
                  <div className={cn("flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide", theme.heading, collapsed && "hidden")}>
                    {group.label}
                  </div>
                ) : (
                  <CollapsibleTrigger asChild>
                    <button
                      type="button"
                      className={cn(
                        "group flex w-full cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs font-semibold tracking-wide transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar",
                        theme.heading,
                        theme.trigger,
                      )}
                      aria-label={`Toggle ${group.label} menu`}
                      aria-expanded={isOpen}
                    >
                      {!collapsed && (
                        <>
                          <span className="flex items-center gap-2">
                            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: getGroupStripColor(group.id) }} />
                            <span>{group.label}</span>
                          </span>
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-300 ease-out", !isOpen && "-rotate-90")} />
                        </>
                      )}
                    </button>
                  </CollapsibleTrigger>
                )}
              </SidebarGroupLabel>
              <CollapsibleContent
                forceMount={isSearchActive || group.defaultOpen ? true : undefined}
                className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"
              >
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map((item) => renderMenuItem(item, group.id))}
                  </SidebarMenu>
                  {!isSearchActive && !collapsed && isLowFrequencyGroup && hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedItems(group.id)}
                      aria-label={`Show more ${group.label} items`}
                      className="mt-2 w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Show {hiddenCount} more
                    </button>
                  )}
                  {!isSearchActive && !collapsed && isLowFrequencyGroup && hiddenCount === 0 && isExpanded && group.items.length > 6 && (
                    <button
                      type="button"
                      onClick={() => toggleExpandedItems(group.id)}
                      aria-label={`Show fewer ${group.label} items`}
                      className="mt-2 w-full rounded-md px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      Show less
                    </button>
                  )}
                </SidebarGroupContent>
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
        );
      })}
      
      {filteredGroups.length === 0 && searchQuery && (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          No modules found for "{searchQuery}"
        </div>
      )}
    </div>
  );
}

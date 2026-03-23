import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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

const ROUTE_PREFETCHERS: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => import('@/pages/dashboard/Dashboards'),
  '/dashboard/leads/pipeline': () => import('@/pages/dashboard/LeadsPipeline'),
  '/dashboard/opportunities/pipeline': () => import('@/pages/dashboard/OpportunitiesPipeline'),
  '/dashboard/accounts/pipeline': () => import('@/pages/dashboard/AccountsPipeline'),
  '/dashboard/contacts/pipeline': () => import('@/pages/dashboard/ContactsPipeline'),
  '/dashboard/quotes/pipeline': () => import('@/pages/dashboard/QuotesPipeline'),
  '/dashboard/bookings': () => import('@/pages/dashboard/Bookings'),
  '/dashboard/shipments/pipeline': () => import('@/pages/dashboard/ShipmentsPipeline'),
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
  const { availableDomains, isPlatformAdmin } = useDomain();
  const { hasRole, hasPermission, isPlatformAdmin: isAuthPlatformAdmin } = useAuth();
  const { enabled: amroRbacFixEnabled } = useAppFeatureFlag(FEATURE_FLAGS.AMRO_RBAC_FIX_ENABLED, true);
  const hasAmroDomain = isPlatformAdmin || availableDomains.some((domain) => String(domain.code || '').trim().toUpperCase() === 'AMRO');
  const prefetchedRoutes = useRef(new Set<string>());
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('sidebar:expandedItems');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  
  // Manage collapsible states with persistence
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('sidebar:groups');
      return saved ? JSON.parse(saved) : {
        logistics: false,
        amro: false,
        financials: false,
        admin: false,
        sales: true, // Default open for core group
      };
    } catch {
      return {
        logistics: false,
        amro: false,
        financials: false,
        admin: false,
        sales: true,
      };
    }
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => {
      const next = { ...prev, [group]: !prev[group] };
      sessionStorage.setItem('sidebar:groups', JSON.stringify(next));
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
      sessionStorage.setItem('sidebar:expandedItems', JSON.stringify(next));
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
    const salesItems = mapModuleItems('Sales').filter((item) => !['Dashboards', 'Reports'].includes(item.title));

    // Logistics
    const logisticsItems = mapModuleItems('Logistics');
    const amroItems = hasAmroDomain
      ? mapModuleItems('AMRO').filter((item) => (amroRbacFixEnabled ? canAccessItem(item) : true))
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
      { title: 'Franchises', url: '/dashboard/franchises', icon: Package, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.franchises.manage'] },
      { title: 'Users', url: '/dashboard/users', icon: Users, roles: ['platform_admin', 'tenant_admin', 'franchise_admin'], permissions: ['admin.users.manage'] },
      { title: 'Transfer Center', url: '/dashboard/transfers', icon: ArrowRightLeft, roles: ['platform_admin'], permissions: ['transfers.view'] },
      { title: 'System Logs', url: '/dashboard/system-logs', icon: Activity, roles: ['platform_admin'] },
      { title: 'Settings', url: '/dashboard/settings', icon: Settings, roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
    ];

    return [
      { id: 'sales', label: 'CRM & Sales', items: salesItems, defaultOpen: true as const },
      { id: 'financials', label: 'Financials', items: financialItems },
      { id: 'logistics', label: 'Logistics', items: logisticsItems },
      { id: 'amro', label: 'AMRO', items: amroItems },
      { id: 'admin', label: 'Administration', items: adminItems },
    ].filter((group) => group.items.length > 0);
  }, [amroRbacFixEnabled, hasAmroDomain, hasPermission, hasRole, isAuthPlatformAdmin]);

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

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  const renderMenuItem = (item: MenuItem) => {
    const node = (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
          <NavLink 
            to={item.url} 
            end={item.url === '/dashboard'} 
            className={getNavClass}
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
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
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
    <div className="flex flex-col gap-2">
      {/* Search Bar - Only visible when expanded */}
      {!collapsed && (
        <div className="px-4 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search modules..."
              aria-label="Search modules"
              className="pl-8 h-9 bg-background/50 focus:bg-background transition-colors"
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
        const isOpen = isSearchActive || openGroups[group.id] || group.defaultOpen;
        const isLowFrequencyGroup = group.id === 'logistics' || group.id === 'financials' || group.id === 'admin' || group.id === 'amro';
        const isExpanded = !!expandedItems[group.id];
        const visibleItems =
          !isSearchActive && !collapsed && isLowFrequencyGroup && !isExpanded
            ? group.items.slice(0, 6)
            : group.items;
        const hiddenCount = group.items.length - visibleItems.length;

        return (
          <Collapsible 
            key={group.id} 
            open={isOpen} 
            onOpenChange={() => !isSearchActive && toggleGroup(group.id)}
            disabled={isSearchActive || group.defaultOpen} // Disable toggle if searching or if forced open
          >
            <SidebarGroup>
              <SidebarGroupLabel asChild>
                {group.defaultOpen || isSearchActive ? (
                  <div className={cn("flex w-full items-center justify-between px-2 py-1.5 text-xs font-semibold text-muted-foreground", collapsed && "hidden")}>
                    {group.label}
                  </div>
                ) : (
                  <CollapsibleTrigger
                    className="flex w-full items-center justify-between hover:text-foreground transition-colors group px-2 py-1.5 cursor-pointer"
                    aria-label={`Toggle ${group.label} menu`}
                    aria-expanded={isOpen}
                  >
                    {!collapsed && (
                      <>
                        <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">{group.label}</span>
                        <ChevronDown className={cn("h-3 w-3 text-muted-foreground transition-transform duration-200", !isOpen && "-rotate-90")} />
                      </>
                    )}
                  </CollapsibleTrigger>
                )}
              </SidebarGroupLabel>
              <CollapsibleContent forceMount={isSearchActive || group.defaultOpen ? true : undefined}>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {visibleItems.map(renderMenuItem)}
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

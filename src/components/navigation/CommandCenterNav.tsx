import React, { useState, useMemo } from 'react';
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

export function CommandCenterNav() {
  const { state } = useSidebar();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  // Manage collapsible states with persistence
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const saved = sessionStorage.getItem('sidebar:groups');
      return saved ? JSON.parse(saved) : {
        logistics: false,
        financials: false,
        admin: false,
        sales: true, // Default open for core group
      };
    } catch {
      return {
        logistics: false,
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

  // 1. Aggregate all menu items
  const menuGroups: MenuGroup[] = useMemo(() => {
    // Sales & CRM
    const salesItems = (APP_MENU.find((m) => m.label === 'Sales')?.items ?? []).map((i) => ({
      title: i.name,
      url: i.path,
      icon: i.icon,
      roles: (i as any).roles,
      permissions: (i as any).permissions,
    })).filter(i => !['Dashboards', 'Reports'].includes(i.title));

    // Logistics
    const logisticsItems = (APP_MENU.find((m) => m.label === 'Logistics')?.items ?? []).map((i) => ({
      title: i.name,
      url: i.path,
      icon: i.icon,
      roles: (i as any).roles,
      permissions: (i as any).permissions,
    }));

    // Financials (Finance + Billing)
    const financialItems = [
      ...(APP_MENU.find((m) => m.label === 'Finance')?.items ?? []).map((i) => ({
        title: i.name,
        url: i.path,
        icon: i.icon,
        roles: (i as any).roles,
        permissions: (i as any).permissions,
      })),
      ...(APP_MENU.find((m) => m.label === 'Billing')?.items ?? []).map((i) => ({
        title: i.name,
        url: i.path,
        icon: i.icon,
        roles: (i as any).roles,
        permissions: (i as any).permissions,
      })),
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
      { title: 'Settings', url: '/dashboard/settings', icon: Settings, roles: ['platform_admin', 'tenant_admin', 'franchise_admin'], permissions: ['admin.settings.manage'] },
    ];

    return [
      { id: 'sales', label: 'CRM & Sales', items: salesItems, defaultOpen: true as const },
      { id: 'financials', label: 'Financials', items: financialItems },
      { id: 'logistics', label: 'Logistics', items: logisticsItems },
      { id: 'admin', label: 'Administration', items: adminItems },
    ];
  }, []);

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
              console.log('Navigating to:', item.url);
              // Force navigation if default behavior fails or gets blocked
              if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
                e.preventDefault();
                navigate(item.url);
              }
            }}
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
                  <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-foreground transition-colors group px-2 py-1.5 cursor-pointer">
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
                    {group.items.map(renderMenuItem)}
                  </SidebarMenu>
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

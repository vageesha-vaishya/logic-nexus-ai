import { Home, Building2, Users, UserPlus, CheckSquare, Package, FileText, Settings, LogOut, TrendingUp, GitBranch, ArrowRightLeft, Mail, Loader2, Activity, ChevronDown, ChevronRight, CreditCard, DollarSign } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import Logo from '@/components/branding/Logo';
import { APP_MENU } from '@/config/navigation';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { RoleGuard } from '@/components/auth/RoleGuard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, profile } = useAuth();
  const collapsed = state === 'collapsed';
  const location = useLocation();
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [isSigningOut, setIsSigningOut] = useState(false);

  // Group open/close states
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    logistics: false,
    financials: false,
    admin: false,
  });

  const toggleGroup = (group: string) => {
    setOpenGroups(prev => ({ ...prev, [group]: !prev[group] }));
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      const { error } = await signOut();
      if (error) {
        toast.error("Sign out failed, but you have been logged out locally.");
      }
    } catch (e) {
      console.error(e);
      toast.error("An unexpected error occurred during sign out.");
    } finally {
      setIsSigningOut(false);
    }
  };

  // Use Salesforce-style order from navigation config
  const salesItems = (APP_MENU.find((m) => m.label === 'Sales')?.items ?? []).map((i) => ({
    title: i.name,
    url: i.path,
    icon: i.icon,
    roles: (i as any).roles,
    permissions: (i as any).permissions,
  })).filter(i => !['Dashboards', 'Reports', 'Quotes'].includes(i.title));

  const logisticsItems = (APP_MENU.find((m) => m.label === 'Logistics')?.items ?? []).map((i) => ({
    title: i.name,
    url: i.path,
    icon: i.icon,
    roles: (i as any).roles,
    permissions: (i as any).permissions,
  }));

  const financialItems = [
    ...(APP_MENU.find((m) => m.label === 'Sales')?.items ?? [])
      .filter(i => i.name === 'Quotes')
      .map(i => ({ title: i.name, url: i.path, icon: i.icon, roles: (i as any).roles, permissions: (i as any).permissions })),
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

  const adminItems = [
    { title: 'Lead Assignment', url: '/dashboard/lead-assignment', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_assignment.manage'] },
    { title: 'Lead Routing', url: '/dashboard/lead-routing', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_routing.manage'] },
    { title: 'Tenants', url: '/dashboard/tenants', icon: FileText, roles: ['platform_admin'], permissions: ['admin.tenants.manage'] },
    { title: 'Franchises', url: '/dashboard/franchises', icon: Package, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.franchises.manage'] },
    { title: 'Users', url: '/dashboard/users', icon: Users, roles: ['platform_admin', 'tenant_admin', 'franchise_admin'], permissions: ['admin.users.manage'] },
    { title: 'Transfer Center', url: '/dashboard/transfers', icon: ArrowRightLeft, roles: ['platform_admin'], permissions: ['transfers.view'] },
    { title: 'System Logs', url: '/dashboard/system-logs', icon: Activity, roles: ['platform_admin'] },
  ];

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
      isActive ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  const renderMenuItem = (item: any) => {
    const node = (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild tooltip={collapsed ? item.title : undefined}>
          <NavLink to={item.url} end={item.url === '/dashboard'} className={getNavClass}>
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="truncate">{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );

    if (item.roles || item.permissions) {
      return (
        <RoleGuard key={item.title} roles={item.roles || []} permissions={item.permissions}>
          {node}
        </RoleGuard>
      );
    }
    return node;
  };

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-64'} collapsible="icon">
      <div className="flex h-16 items-center border-b px-4 shrink-0">
        {collapsed ? (
          <div className="flex w-full justify-center">
            <Logo size={28} />
          </div>
        ) : (
          <Logo size={32} showWordmark wordmarkClassName="hidden sm:block" />
        )}
      </div>

      <SidebarContent ref={scrollRef} className="py-2">
        {/* Core Sales & CRM Group - Always Visible */}
        <SidebarGroup>
          <SidebarGroupLabel className={collapsed ? 'hidden' : ''}>CRM & Sales</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {salesItems.map(renderMenuItem)}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Financials Group - Collapsible */}
        <Collapsible open={openGroups.financials} onOpenChange={() => toggleGroup('financials')}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-foreground transition-colors group">
                {!collapsed && (
                  <>
                    <span>Financials</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !openGroups.financials && "-rotate-90")} />
                  </>
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {financialItems.map(renderMenuItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Logistics Group - Collapsible */}
        <Collapsible open={openGroups.logistics} onOpenChange={() => toggleGroup('logistics')}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-foreground transition-colors group">
                {!collapsed && (
                  <>
                    <span>Logistics</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !openGroups.logistics && "-rotate-90")} />
                  </>
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {logisticsItems.map(renderMenuItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Admin Group - Collapsible */}
        <Collapsible open={openGroups.admin} onOpenChange={() => toggleGroup('admin')}>
          <SidebarGroup>
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between hover:text-foreground transition-colors group">
                {!collapsed && (
                  <>
                    <span>Administration</span>
                    <ChevronDown className={cn("h-3 w-3 transition-transform duration-200", !openGroups.admin && "-rotate-90")} />
                  </>
                )}
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {adminItems.map(renderMenuItem)}
                  <RoleGuard roles={["platform_admin","tenant_admin","franchise_admin"] as any} permissions={["admin.settings.manage"] as any}>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip={collapsed ? "Settings" : undefined}>
                        <NavLink to="/dashboard/settings" className={getNavClass}>
                          <Settings className="h-4 w-4 shrink-0" />
                          {!collapsed && <span>Settings</span>}
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </RoleGuard>
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter className="border-t p-4">
        {!collapsed && profile && (
          <div className="mb-3 space-y-1">
            <p className="text-sm font-medium truncate">
              {profile.first_name} {profile.last_name}
            </p>
            <p className="text-xs text-muted-foreground truncate">{profile.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          className="w-full justify-start"
          onClick={handleSignOut}
          disabled={isSigningOut}
          aria-label={collapsed ? "Sign Out" : undefined}
        >
          {isSigningOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
          {!collapsed && <span className="ml-2">{isSigningOut ? 'Signing Out...' : 'Sign Out'}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

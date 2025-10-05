import { Home, Building2, Users, UserPlus, CheckSquare, Package, FileText, Settings, LogOut, TrendingUp, GitBranch, Mail } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
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

export function AppSidebar() {
  const { state } = useSidebar();
  const { signOut, profile } = useAuth();
  const collapsed = state === 'collapsed';

  // Use Salesforce-style order from navigation config
  const salesItems = (APP_MENU.find((m) => m.label === 'Sales')?.items ?? []).map((i) => ({
    title: i.name,
    url: i.path,
    icon: i.icon,
  }));

  const logisticsItems = (APP_MENU.find((m) => m.label === 'Logistics')?.items ?? []).map((i) => ({
    title: i.name,
    url: i.path,
    icon: i.icon,
  }));

  const adminItems = [
    { title: 'Lead Assignment', url: '/dashboard/lead-assignment', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_assignment.manage'] },
    { title: 'Lead Routing', url: '/dashboard/lead-routing', icon: GitBranch, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.lead_routing.manage'] },
    { title: 'Tenants', url: '/dashboard/tenants', icon: FileText, roles: ['platform_admin'], permissions: ['admin.tenants.manage'] },
    { title: 'Franchises', url: '/dashboard/franchises', icon: Package, roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.franchises.manage'] },
    { title: 'Users', url: '/dashboard/users', icon: Users, roles: ['platform_admin', 'tenant_admin', 'franchise_admin'], permissions: ['admin.users.manage'] },
  ];

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted/50';

  return (
    <Sidebar className={collapsed ? 'w-14' : 'w-64'} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>
            {collapsed ? (
              <div className="flex justify-center">
                <Logo size={32} />
              </div>
            ) : (
              <Logo size={36} showWordmark wordmarkClassName="hidden sm:block" />
            )}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {salesItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && <span>Logistics</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {logisticsItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            {!collapsed && <span>Administration</span>}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <RoleGuard key={item.title} roles={item.roles as any} permissions={item.permissions as any}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.url} className={getNavClass}>
                        <item.icon className="h-4 w-4" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </RoleGuard>
              ))}
              <RoleGuard roles={["platform_admin","tenant_admin","franchise_admin"] as any} permissions={["admin.settings.manage"] as any}>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild>
                    <NavLink to="/dashboard/settings" className={getNavClass}>
                      <Settings className="h-4 w-4" />
                      {!collapsed && <span>Settings</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </RoleGuard>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
          onClick={signOut}
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="ml-2">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}

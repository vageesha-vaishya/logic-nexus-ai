import React, { ReactNode, useState, useEffect } from 'react';
import { 
  LayoutGrid, 
  ShoppingCart, 
  FileText, 
  Users, 
  CreditCard, 
  BarChart2, 
  Settings, 
  Bot, 
  MessageSquare, 
  Clock, 
  UserCircle, 
  LogOut,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  List,
  Kanban,
  Calendar,
  PieChart,
  Activity,
  ArrowDownToLine,
  Upload,
  Download,
  Settings2,
  Table,
  Building,
  Menu,
  Home,
  Store,
  Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useCRM } from '@/hooks/useCRM';
import { useAuth } from '@/hooks/useAuth';
import { AdvancedSearchFilter, FilterCriterion } from './AdvancedSearchFilter';
import { ViewMode } from '@/components/ui/view-toggle';
import { useSalesDashboard } from '@/contexts/SalesDashboardContext';
import { toast } from 'sonner';
import { QuotationSidebar } from './QuotationSidebar';

interface QuotationManagerLayoutProps {
  children: ReactNode;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  activeFilters: FilterCriterion[];
  onFilterApply: (filters: FilterCriterion[], matchMode: 'all' | 'any') => void;
  onRemoveFilter: (id: string) => void;
  pagination: {
    current: number;
    total: number;
    pageSize: number;
    onPageChange: (page: number) => void;
  };
}

export function QuotationManagerLayout({
  children,
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchChange,
  activeFilters,
  onFilterApply,
  onRemoveFilter,
  pagination
}: QuotationManagerLayoutProps) {
  const { context, scopedDb, setScopePreference, preferences } = useCRM();
  const { signOut, profile } = useAuth();
  const { 
    handleNavigation, 
    handleAction, 
    unreadMessages, 
    dueActivities, 
    companyName: defaultCompanyName, 
    userRole 
  } = useSalesDashboard();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const [tenants, setTenants] = useState<any[]>([]);
  const [franchises, setFranchises] = useState<any[]>([]);
  
  // Load scope data
  useEffect(() => {
    const loadScopeData = async () => {
      try {
        // Load Tenants if Platform Admin
        if (context.isPlatformAdmin) {
          const { data: tData } = await scopedDb.from('tenants', true).select('id, name').order('name');
          setTenants(tData || []);
        }

        // Load Franchises based on current effective tenant
        const targetTenantId = context.isPlatformAdmin ? (preferences?.tenant_id || context.tenantId) : context.tenantId;

        if (targetTenantId) {
          const { data: fData } = await scopedDb.from('franchises', true).select('id, name').eq('tenant_id', targetTenantId).order('name');
          setFranchises(fData || []);
        } else {
          setFranchises([]);
        }
      } catch (error) {
        console.error("Failed to load scope data", error);
      }
    };
    loadScopeData();
  }, [context.isPlatformAdmin, context.tenantId, preferences?.tenant_id, scopedDb]);

  const handleTenantSwitch = async (tId: string) => {
    const newVal = tId === 'all' ? null : tId;
    await setScopePreference(newVal, null);
    toast.success(`Switched to ${newVal ? 'Tenant Scope' : 'Global View'}`);
  };

  const handleFranchiseSwitch = async (fId: string) => {
    const currentTenantId = preferences?.tenant_id || context.tenantId;
    const newVal = fId === 'all' ? null : fId;
    await setScopePreference(currentTenantId, newVal);
    toast.success(`Switched to ${newVal ? 'Franchise Scope' : 'All Franchises'}`);
  };

  // Compute display name
  const currentTenantName = tenants.find(t => t.id === (preferences?.tenant_id || context.tenantId))?.name;
  const currentFranchiseName = franchises.find(f => f.id === (preferences?.franchise_id || context.franchiseId))?.name;
  
  let displayCompanyName = defaultCompanyName;
  if (currentFranchiseName) {
    displayCompanyName = currentFranchiseName;
  } else if (currentTenantName) {
    displayCompanyName = currentTenantName;
  } else if (context.isPlatformAdmin && !preferences?.tenant_id) {
    displayCompanyName = "Global Admin";
  }

  const startRecord = (pagination.current - 1) * pagination.pageSize + 1;
  const endRecord = Math.min(pagination.current * pagination.pageSize, pagination.total);

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      
      {/* --- Top Header Strip --- */}
      <header className="h-14 bg-[#714B67] text-white flex items-center justify-between px-4 shadow-sm shrink-0 z-50">
        {/* Left Section */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10" 
            title="Main Menu"
            onClick={() => handleNavigation('/dashboard')}
          >
            <Home className="h-5 w-5" />
          </Button>
          
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10" 
            title="Module Panel"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="text-white hover:bg-white/10 font-semibold text-lg tracking-tight px-2">
                Sales
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56">
              <DropdownMenuLabel>Sales Overview</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/sales')}>
                <BarChart2 className="mr-2 h-4 w-4" />
                Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/sales/performance')}>
                <Activity className="mr-2 h-4 w-4" />
                Performance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <nav className="flex items-center gap-1 ml-4 text-sm hidden md:flex">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 h-8 px-3">
                  Orders
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/quotes/pipeline')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Quotations
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/orders')}>
                  <ShoppingCart className="mr-2 h-4 w-4" />
                  Orders
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/team')}>
                  <Users className="mr-2 h-4 w-4" />
                  Sales Team
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/accounts')}>
                  <Building className="mr-2 h-4 w-4" />
                  Customers
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 h-8 px-3">
                  To Invoice
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/invoicing/orders')}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Orders to Invoice
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 h-8 px-3">
                  Reports
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/reports/sales')}>
                  <BarChart2 className="mr-2 h-4 w-4" />
                  Sales Analysis
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/reports/reps')}>
                  <Users className="mr-2 h-4 w-4" />
                  Rep Performance
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white/10 h-8 px-3">
                  Configuration
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleAction('config')}>
                  <Settings className="mr-2 h-4 w-4" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/settings/teams')}>Sales Teams</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation('/dashboard/settings/activities')}>Activity Types</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
             <Button 
                variant="ghost" 
                className="text-white hover:bg-white/10 h-8 px-3 gap-2 border border-white/20 ml-2 bg-white/5"
                onClick={() => handleAction('ai_quote')}
            >
                <Bot className="h-4 w-4" />
                AI Quotation
            </Button>
          </nav>
        </div>

        {/* Right Section */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10 relative"
            onClick={() => handleAction('messages')}
            title="Messages"
          >
            <MessageSquare className="h-5 w-5" />
            {unreadMessages > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full border border-[#714B67]" />
            )}
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10 relative"
            onClick={() => handleAction('activities')}
            title="Activities Due"
          >
            <Clock className="h-5 w-5" />
            {dueActivities > 0 && (
              <span className="absolute top-2 right-2 h-2 w-2 bg-yellow-500 rounded-full border border-[#714B67]" />
            )}
          </Button>
          
          <div className="h-6 w-px bg-white/20 mx-1 hidden md:block" />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-white hover:bg-white/10 h-8 px-3 hidden md:flex">
                {displayCompanyName}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Switch Company</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {/* Platform Admin: Tenant Switcher */}
              {context.isPlatformAdmin && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Building className="mr-2 h-4 w-4" />
                    <span>Tenant</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-0">
                    <DropdownMenuItem onSelect={() => handleTenantSwitch('all')}>
                      <span className={!preferences?.tenant_id ? "font-bold" : ""}>All Tenants</span>
                      {!preferences?.tenant_id && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    {tenants.map(t => (
                      <DropdownMenuItem key={t.id} onSelect={() => handleTenantSwitch(t.id)}>
                        <span className={preferences?.tenant_id === t.id ? "font-bold" : ""}>{t.name}</span>
                        {preferences?.tenant_id === t.id && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* Franchise Switcher */}
              {(context.isTenantAdmin || (context.isPlatformAdmin && (preferences?.tenant_id || context.tenantId))) && (
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>
                    <Store className="mr-2 h-4 w-4" />
                    <span>Franchise</span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="p-0 max-h-[300px] overflow-y-auto">
                    <DropdownMenuItem onSelect={() => handleFranchiseSwitch('all')}>
                      <span className={!preferences?.franchise_id ? "font-bold" : ""}>All Franchises</span>
                      {!preferences?.franchise_id && <Check className="ml-auto h-4 w-4" />}
                    </DropdownMenuItem>
                    {franchises.map(f => (
                      <DropdownMenuItem key={f.id} onSelect={() => handleFranchiseSwitch(f.id)}>
                        <span className={preferences?.franchise_id === f.id ? "font-bold" : ""}>{f.name}</span>
                        {preferences?.franchise_id === f.id && <Check className="ml-auto h-4 w-4" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )}

              {/* If just a user with no switch options */}
              {!context.isPlatformAdmin && !context.isTenantAdmin && (
                <DropdownMenuItem disabled>
                  No other companies available
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="text-white hover:bg-white/10 h-10 pl-2 pr-1 gap-2 rounded-full md:rounded-md">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-medium leading-none">{profile?.first_name || 'User'}</p>
                  <p className="text-[10px] opacity-70">{userRole}</p>
                </div>
                <UserCircle className="h-8 w-8" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>My Account</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/profile')}>Profile</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigation('/dashboard/settings')}>Preferences</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => signOut()} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <QuotationSidebar />
        <div className="flex flex-col flex-1 overflow-hidden min-w-0">
          {/* --- Sub-Header Strip (Control Panel) --- */}
          <div className="h-16 bg-white border-b flex items-center justify-between px-4 shrink-0 gap-4 shadow-sm z-40">
        {/* Left: Actions */}
        <div className="flex items-center gap-3">
          <Button 
            className="bg-[#714B67] hover:bg-[#5e3d55] text-white gap-2 shadow-sm"
            onClick={() => handleNavigation('/dashboard/quotes/new')}
          >
            <Plus className="h-4 w-4" />
            New
          </Button>
          
          <h1 className="text-xl font-semibold text-gray-800 ml-2 hidden md:block">Quotations</h1>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="text-gray-500">
                <Settings2 className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => handleAction('import')}>
                <Upload className="mr-2 h-4 w-4" />
                Import Records
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleAction('export')}>
                <Download className="mr-2 h-4 w-4" />
                Export All
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Middle: Search & Filter */}
        <div className="flex-1 max-w-3xl flex items-center gap-2">
           <div className="relative flex-1 group">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-[#714B67] transition-colors" />
            <Input 
              placeholder="Search quotations..." 
              className="pl-9 h-10 bg-gray-50 border-gray-200 focus:bg-white transition-all focus:ring-1 focus:ring-[#714B67]"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
            />
          </div>
          <AdvancedSearchFilter 
            activeFilters={activeFilters}
            onFilterApply={onFilterApply}
            onRemoveFilter={onRemoveFilter}
          />
        </div>

        {/* Right: View Controls & Pagination */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1 text-sm text-gray-600 bg-gray-50 px-2 py-1 rounded border hidden lg:flex">
            <span className="font-medium">{pagination.total > 0 ? startRecord : 0}-{endRecord}</span>
            <span className="text-gray-400">/</span>
            <span>{pagination.total}</span>
          </div>
          
          <div className="flex items-center border rounded-md overflow-hidden bg-white shadow-sm">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-none border-r hover:bg-gray-50"
              disabled={pagination.current <= 1}
              onClick={() => pagination.onPageChange(pagination.current - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-none hover:bg-gray-50"
              disabled={endRecord >= pagination.total}
              onClick={() => pagination.onPageChange(pagination.current + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg gap-0.5">
            <Button 
              variant={viewMode === 'list' ? 'white' : 'ghost'} 
              size="icon" 
              className={`h-8 w-8 ${viewMode === 'list' ? 'shadow-sm text-[#714B67]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => onViewModeChange('list')}
              title="List View"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'board' ? 'white' : 'ghost'} 
              size="icon" 
              className={`h-8 w-8 ${viewMode === 'board' ? 'shadow-sm text-[#714B67]' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => onViewModeChange('board')}
              title="Kanban View"
            >
              <Kanban className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 hidden sm:flex" title="Calendar View">
              <Calendar className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 hidden sm:flex" title="Pivot View">
              <Table className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 hidden sm:flex" title="Graph View">
              <BarChart2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-gray-600 hidden sm:flex" title="Activity View">
              <Activity className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <main className="flex-1 overflow-auto p-4 md:p-6 relative">
        {children}
      </main>
      </div>
    </div>
    </div>
  );
}

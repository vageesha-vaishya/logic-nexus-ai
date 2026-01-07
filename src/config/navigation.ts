import { type LucideIcon, Home, TrendingUp, UserPlus, CheckSquare, FileText, Building2, Users, Megaphone, BarChart3, PieChart, MessageSquare, UsersRound, CalendarDays, MoreHorizontal, Package, Warehouse, Truck, CreditCard, DollarSign, FileCheck, Ship, MapPin, Users2, Box, Ruler, PackageCheck, Globe, Cog, Palette, GitBranch, Database } from 'lucide-react';
import type { Permission } from '@/config/permissions';

export type MenuScreen = {
  name: string;
  path: string;
  description?: string;
};

export type MenuItem = {
  name: string;
  path: string;
  icon: LucideIcon;
  description?: string;
  screens?: MenuScreen[];
  roles?: Array<'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user'>;
  permissions?: Permission[];
};

export type MenuModule = {
  label: string;
  items: MenuItem[];
};

export const APP_MENU: MenuModule[] = [
  {
    label: 'Sales',
    items: [
      // Place Home at the top
      { name: 'Home', path: '/dashboard', icon: Home, description: 'Overview homepage' },
      // Workflow sequence
      {
        name: 'Leads',
        path: '/dashboard/leads/pipeline',
        icon: UserPlus,
        description: 'Prospects to qualify',
        screens: [
          { name: 'Activity', path: '/dashboard/leads/:id#activity', description: 'Tasks, calls, meetings' },
          { name: 'Details', path: '/dashboard/leads/:id#details', description: 'Lead information' },
          { name: 'Chatter', path: '/dashboard/leads/:id#chatter', description: 'Collaboration feed' },
          { name: 'News', path: '/dashboard/leads/:id#news', description: 'Company/lead news' },
        ],
      },
      { name: 'Tasks/Activities', path: '/dashboard/activities', icon: CheckSquare, description: 'Activity management' },
      { name: 'Opportunities', path: '/dashboard/opportunities/pipeline', icon: TrendingUp, description: 'Deals and pipeline' },
      { name: 'Accounts', path: '/dashboard/accounts/pipeline', icon: Building2, description: 'Organizations and customers' },
      { name: 'Contacts', path: '/dashboard/contacts/pipeline', icon: Users, description: 'People tied to accounts' },
      { name: 'Quotes', path: '/dashboard/quotes/pipeline', icon: FileCheck, description: 'Sales quotes and proposals' },
      { name: 'Quote Templates', path: '/dashboard/quotes/templates', icon: FileText, description: 'Manage quote templates', permissions: ['quotes.templates.manage'] },

      // Remaining items
      { name: 'Files', path: '/dashboard/files', icon: FileText, description: 'Documents and attachments' },
      { name: 'Campaigns', path: '/dashboard/campaigns', icon: Megaphone, description: 'Marketing campaigns' },
      { name: 'Dashboards', path: '/dashboard/dashboards', icon: BarChart3, description: 'Visual dashboards' },
      { name: 'Reports', path: '/dashboard/reports', icon: PieChart, description: 'Analytics and reports' },
      { name: 'Chatter', path: '/dashboard/chatter', icon: MessageSquare, description: 'Collaboration feed' },
      { name: 'Groups', path: '/dashboard/groups', icon: UsersRound, description: 'Team groups' },
      { name: 'Calendar', path: '/dashboard/calendar', icon: CalendarDays, description: 'Events and schedules' },
      { name: 'More', path: '/dashboard/more', icon: MoreHorizontal, description: 'Additional tools' },
    ],
  },
  {
    label: 'Logistics',
    items: [
      { name: 'Shipments', path: '/dashboard/shipments/pipeline', icon: Package, description: 'Track shipments' },
      { name: 'Warehouses', path: '/dashboard/warehouses', icon: Warehouse, description: 'Manage warehouses' },
      { name: 'Vehicles', path: '/dashboard/vehicles', icon: Truck, description: 'Fleet management' },
      { name: 'Carriers', path: '/dashboard/carriers', icon: Ship, description: 'Shipping carriers' },
      { name: 'Consignees', path: '/dashboard/consignees', icon: Users2, description: 'Shipping receivers' },
      { name: 'Ports & Locations', path: '/dashboard/ports-locations', icon: MapPin, description: 'Ports and facilities' },
      { name: 'Package Categories', path: '/dashboard/package-categories', icon: Box, description: 'Container types' },
      { name: 'Package Sizes', path: '/dashboard/package-sizes', icon: Ruler, description: 'Container dimensions' },
      { name: 'Cargo Types', path: '/dashboard/cargo-types', icon: PackageCheck, description: 'Cargo classifications' },
      { name: 'Cargo Details', path: '/dashboard/cargo-details', icon: Package, description: 'Configure cargo details per service' },
      { name: 'Incoterms', path: '/dashboard/incoterms', icon: Globe, description: 'Trade terms' },
      { name: 'Service Types', path: '/dashboard/service-types', icon: Cog, description: 'Define allowed service type values', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Service Type Mappings', path: '/dashboard/service-type-mappings', icon: GitBranch, description: 'Manage service type mappings', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Services', path: '/dashboard/services', icon: Package, description: 'Manage tenant service catalog', roles: ['platform_admin','tenant_admin','franchise_admin'] },
    ],
  },
  {
    label: 'Billing',
    items: [
      { name: 'My Subscription', path: '/dashboard/subscriptions', icon: CreditCard, description: 'Manage subscription' },
      { name: 'Tenant Plans', path: '/dashboard/tenant-subscriptions', icon: DollarSign, description: 'Assign tenant plans' },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'System Settings', path: '/dashboard/settings', icon: Cog, description: 'Account and app settings' },
      { name: 'Roles & Permissions', path: '/dashboard/settings/permissions', icon: Cog, description: 'Configure access control', permissions: ['admin.settings.manage'] },
      { name: 'Theme Management', path: '/dashboard/themes', icon: Palette, description: 'Customize theme' },
      { name: 'Subscription', path: '/dashboard/settings/subscription', icon: CreditCard, description: 'Manage plan and usage' },
      { name: 'Data Management', path: '/dashboard/settings/data-management', icon: Cog, description: 'Database options and quote numbering' },
      { name: 'Database Export', path: '/dashboard/settings/database-export', icon: Database, description: 'Export tables and backups' },
      { name: 'Master Data (Geography)', path: '/dashboard/settings/master-data', icon: Globe, description: 'Continents, countries, states, cities' },
      { name: 'Master Data (HTS Codes)', path: '/dashboard/settings/master-data-hts', icon: FileText, description: 'HTS/Schedule B codes manager' },
      { name: 'Quote Numbering', path: '/dashboard/settings/quote-numbers', icon: FileCheck, description: 'Prefixes and reset policy' },
      { name: 'UI Forms Demo', path: '/dashboard/ui-forms-demo', icon: FileText, description: 'Phase 1–2 form patterns' },
      { name: 'UI Advanced Demo', path: '/dashboard/ui-advanced-demo', icon: FileCheck, description: 'Phase 3–5 advanced fields' },
    ],
  },
];

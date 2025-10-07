import { type LucideIcon, Home, TrendingUp, UserPlus, CheckSquare, FileText, Building2, Users, Megaphone, BarChart3, PieChart, MessageSquare, UsersRound, CalendarDays, MoreHorizontal, Package, Warehouse, Truck, CreditCard, DollarSign, FileCheck, Ship, MapPin, Users2, Box, Ruler, PackageCheck, Globe, Cog, Palette } from 'lucide-react';

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
};

export type MenuModule = {
  label: string;
  items: MenuItem[];
};

export const APP_MENU: MenuModule[] = [
  {
    label: 'Sales',
    items: [
      { name: 'Home', path: '/dashboard', icon: Home, description: 'Overview homepage' },
      { name: 'Opportunities', path: '/dashboard/opportunities', icon: TrendingUp, description: 'Deals and pipeline' },
      { name: 'Quotes', path: '/dashboard/quotes', icon: FileCheck, description: 'Sales quotes and proposals' },
      {
        name: 'Leads',
        path: '/dashboard/leads',
        icon: UserPlus,
        description: 'Prospects to qualify',
        screens: [
          { name: 'Activity', path: '/dashboard/leads/:id#activity', description: 'Tasks, calls, meetings' },
          { name: 'Details', path: '/dashboard/leads/:id#details', description: 'Lead information' },
          { name: 'Chatter', path: '/dashboard/leads/:id#chatter', description: 'Collaboration feed' },
          { name: 'News', path: '/dashboard/leads/:id#news', description: 'Company/lead news' },
        ],
      },
      { name: 'Tasks', path: '/dashboard/activities', icon: CheckSquare, description: 'Activity management' },
      { name: 'Files', path: '/dashboard/files', icon: FileText, description: 'Documents and attachments' },
      { name: 'Accounts', path: '/dashboard/accounts', icon: Building2, description: 'Organizations and customers' },
      { name: 'Contacts', path: '/dashboard/contacts', icon: Users, description: 'People tied to accounts' },
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
      { name: 'Shipments', path: '/dashboard/shipments', icon: Package, description: 'Track shipments' },
      { name: 'Warehouses', path: '/dashboard/warehouses', icon: Warehouse, description: 'Manage warehouses' },
      { name: 'Vehicles', path: '/dashboard/vehicles', icon: Truck, description: 'Fleet management' },
      { name: 'Carriers', path: '/dashboard/carriers', icon: Ship, description: 'Shipping carriers' },
      { name: 'Consignees', path: '/dashboard/consignees', icon: Users2, description: 'Shipping receivers' },
      { name: 'Ports & Locations', path: '/dashboard/ports-locations', icon: MapPin, description: 'Ports and facilities' },
      { name: 'Package Categories', path: '/dashboard/package-categories', icon: Box, description: 'Container types' },
      { name: 'Package Sizes', path: '/dashboard/package-sizes', icon: Ruler, description: 'Container dimensions' },
      { name: 'Cargo Types', path: '/dashboard/cargo-types', icon: PackageCheck, description: 'Cargo classifications' },
      { name: 'Incoterms', path: '/dashboard/incoterms', icon: Globe, description: 'Trade terms' },
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
      { name: 'Theme Management', path: '/dashboard/themes', icon: Palette, description: 'Customize theme' },
      { name: 'Subscription', path: '/dashboard/settings/subscription', icon: CreditCard, description: 'Manage plan and usage' },
      { name: 'UI Forms Demo', path: '/dashboard/ui-forms-demo', icon: FileText, description: 'Phase 1–2 form patterns' },
      { name: 'UI Advanced Demo', path: '/dashboard/ui-advanced-demo', icon: FileCheck, description: 'Phase 3–5 advanced fields' },
    ],
  },
];
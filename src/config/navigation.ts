import { type LucideIcon, Home, TrendingUp, UserPlus, CheckSquare, FileText, Building2, Users, Megaphone, BarChart3, PieChart, MessageSquare, UsersRound, CalendarDays, MoreHorizontal, Package, Warehouse, Truck, CreditCard, DollarSign, FileCheck, Ship, MapPin, Users2, Box, Ruler, PackageCheck, Globe, Cog, Palette, GitBranch, Database, ArrowRightLeft, Anchor, LineChart, Landmark, BookOpen, ShieldAlert, Mail, Wallet, Eye, Brain, Newspaper, CandlestickChart, Activity, Flag, Wifi, PiggyBank } from 'lucide-react';
import type { AppRole, Permission } from '@/config/permissions';

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
  roles?: AppRole[];
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
      { name: 'Migration Baseline', path: '/dashboard/migration-baseline', icon: LineChart, description: 'Compatibility baseline and dual-run migration KPIs', permissions: ['dashboards.view'] },
      { name: 'CRM Workspace', path: '/dashboard/crm-workspace', icon: BarChart3, description: 'Integrated CRM prototype workspace', permissions: ['dashboards.view', 'leads.view'] },
      // Duplicate entry removed to fix key conflict
      // { name: 'Leads Workspace', path: '/dashboard/leads/pipeline', icon: Users, description: 'Leads-focused workspace variant' },
      { name: 'Reports', path: '/dashboard/reports', icon: PieChart, description: 'Analytics and reports', permissions: ['reports.view'] },
      { name: 'Chatter', path: '/dashboard/chatter', icon: MessageSquare, description: 'Collaboration feed' },
      { name: 'Groups', path: '/dashboard/groups', icon: UsersRound, description: 'Team groups' },
      { name: 'Calendar', path: '/dashboard/calendar', icon: CalendarDays, description: 'Events and schedules' },
      { name: 'More', path: '/dashboard/more', icon: MoreHorizontal, description: 'Additional tools' },
    ],
  },
  {
    label: 'Logistics',
    items: [
      { name: 'Bookings', path: '/dashboard/bookings', icon: BookOpen, description: 'Manage bookings' },
      { name: 'Shipments', path: '/dashboard/shipments/pipeline', icon: Package, description: 'Track shipments' },
      { name: 'Warehouses', path: '/dashboard/warehouses', icon: Warehouse, description: 'Manage warehouses' },
      { name: 'Vehicles', path: '/dashboard/vehicles', icon: Truck, description: 'Fleet management' },
      { name: 'Rate Management', path: '/dashboard/rate-management', icon: LineChart, description: 'Market analysis & rate sheets' },
      { name: 'Vendors', path: '/dashboard/vendors', icon: Building2, description: 'Manage carriers & partners' },
      { name: 'Carriers', path: '/dashboard/carriers', icon: Ship, description: 'Shipping carriers' },
      { name: 'Consignees', path: '/dashboard/consignees', icon: Users2, description: 'Shipping receivers' },
      { name: 'Ports & Locations', path: '/dashboard/ports-locations', icon: MapPin, description: 'Ports and facilities' },
      { name: 'Package Categories', path: '/dashboard/package-categories', icon: Box, description: 'Container types' },
      { name: 'Package Sizes', path: '/dashboard/package-sizes', icon: Ruler, description: 'Container dimensions' },
      { name: 'Container Tracking', path: '/dashboard/container-tracking', icon: Box, description: 'Container inventory & location' },
      { name: 'Container Analytics', path: '/dashboard/container-analytics', icon: BarChart3, description: 'Container inventory & utilization' },
      { name: 'Vessel Types', path: '/dashboard/vessel-types', icon: Ship, description: 'Vessel type definitions' },
      { name: 'Vessel Classes', path: '/dashboard/vessel-classes', icon: Ship, description: 'Vessel class definitions' },
      { name: 'Vessels', path: '/dashboard/vessels', icon: Anchor, description: 'Fleet management' },
      { name: 'Cargo Types', path: '/dashboard/cargo-types', icon: PackageCheck, description: 'Cargo classifications' },
      { name: 'Cargo Details', path: '/dashboard/cargo-details', icon: Package, description: 'Configure cargo details per service' },
      { name: 'Incoterms', path: '/dashboard/incoterms', icon: Globe, description: 'Trade terms' },
      { name: 'Service Types', path: '/dashboard/service-types', icon: Cog, description: 'Define allowed service type values', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Service Type Mappings', path: '/dashboard/service-type-mappings', icon: GitBranch, description: 'Manage service type mappings', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Services', path: '/dashboard/services', icon: Package, description: 'Manage tenant service catalog', roles: ['platform_admin','tenant_admin','franchise_admin'] },
    ],
  },
  {
    label: 'UIM',
    items: [
      { name: 'Overview', path: '/dashboard/uim', icon: Database, description: 'UIM module landing and rollout checkpoints', permissions: ['dashboards.view'] },
      { name: 'Item Master', path: '/dashboard/uim/item-master', icon: PackageCheck, description: 'Catalog and SKU master shell', permissions: ['dashboards.view'] },
      { name: 'Stock Ledger', path: '/dashboard/uim/stock-ledger', icon: FileText, description: 'Immutable inventory ledger timeline shell', permissions: ['dashboards.view'] },
      { name: 'Reservations', path: '/dashboard/uim/reservations', icon: CheckSquare, description: 'Soft reservation lifecycle shell', permissions: ['dashboards.view'] },
      { name: 'Issue & Consume', path: '/dashboard/uim/issue-consume', icon: ArrowRightLeft, description: 'Issue and consume execution shell', permissions: ['dashboards.view'] },
      { name: 'Restock', path: '/dashboard/uim/restock', icon: TrendingUp, description: 'Dynamic restock evaluation shell', permissions: ['dashboards.view'] },
      { name: 'Locations', path: '/dashboard/uim/locations', icon: MapPin, description: 'Location registry and transfer shell', permissions: ['dashboards.view'] },
      { name: 'Analytics', path: '/dashboard/uim/analytics', icon: BarChart3, description: 'Inventory KPI and trend shell', permissions: ['dashboards.view'] },
    ],
  },
  {
    label: 'AMRO',
    items: [
      { name: 'Overview', path: '/dashboard/amro/overview', icon: BarChart3, description: 'Maintenance overview and KPI shell', permissions: ['view_amro_dashboard'] },
      { name: 'Aircraft', path: '/dashboard/amro/aircraft', icon: Database, description: 'Aircraft fleet records, forms, and flight-log-linked operations', permissions: ['edit_aircraft_records'] },
      { name: 'MPDs/ADs/SBs', path: '/dashboard/amro/plan-directives-bulletin', icon: FileCheck, description: 'MPD and AD/SB planning, setup, and execution controls', permissions: ['edit_aircraft_records'] },
      { name: 'Work Order Templates', path: '/dashboard/amro/settings/work-order-templates', icon: Package, description: 'Work order templates linked to aircraft operations', permissions: ['edit_aircraft_records'] },
      { name: 'Work Orders', path: '/dashboard/amro/work-orders', icon: CheckSquare, description: 'Maintenance work order execution board', permissions: ['create_maintenance_request'] },
      { name: 'Task Execution', path: '/dashboard/amro/task-execution', icon: CheckSquare, description: 'Technician task execution operations', permissions: ['create_maintenance_request'] },
      { name: 'Scheduling', path: '/dashboard/amro/scheduling', icon: CalendarDays, description: 'Maintenance scheduling shell', permissions: ['edit_aircraft_records'] },
      { name: 'Parts', path: '/dashboard/amro/parts', icon: Box, description: 'Materials reservation and parts operations', permissions: ['edit_aircraft_records'] },
      { name: 'Compliance', path: '/dashboard/amro/compliance', icon: FileCheck, description: 'Compliance gate and release controls', permissions: ['approve_work_orders'] },
      { name: 'Certification', path: '/dashboard/amro/certification', icon: FileCheck, description: 'Certification decision and certifying release workflows', permissions: ['approve_work_orders'] },
      { name: 'Audit', path: '/dashboard/amro/audit', icon: FileText, description: 'Audit replay timeline and traceability', permissions: ['delete_flight_logs'] },
      { name: 'Integration', path: '/dashboard/amro/integration', icon: GitBranch, description: 'Integration monitor and sync operations', permissions: ['edit_aircraft_records'] },
      { name: 'Intelligence', path: '/dashboard/amro/intelligence', icon: TrendingUp, description: 'Forecast recommendation and risk intelligence', permissions: ['view_amro_dashboard'] },
      { name: 'Settings', path: '/dashboard/amro/settings', icon: Cog, description: 'AMRO configuration and master data controls', permissions: ['edit_aircraft_records'] },
      { name: 'Workspace Documentation', path: '/dashboard/amro/workspace-documentation', icon: BookOpen, description: 'AMRO reference materials and contracts', permissions: ['view_amro_dashboard'] },
      { name: 'Design System Showcase', path: '/dashboard/amro/design-system-showcase', icon: Palette, description: 'Interactive UI patterns demo and training tool', permissions: ['view_amro_dashboard'] },
    ],
  },
  {
    label: 'Compliance',
    items: [
      { name: 'Restricted Party Screening', path: '/dashboard/restricted-party-screening', icon: FileCheck, description: 'Screen entities against watchlists' },
      { name: 'Security Incidents', path: '/dashboard/security-incidents', icon: ShieldAlert, description: 'Monitor security threats and incidents' },
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
    label: 'Finance',
    items: [
      { name: 'Invoices', path: '/dashboard/finance/invoices', icon: FileText, description: 'Manage invoices', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Margin Rules', path: '/dashboard/finance/margin-rules', icon: TrendingUp, description: 'Dynamic pricing rules', roles: ['platform_admin', 'tenant_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Tax Jurisdictions', path: '/dashboard/finance/tax-jurisdictions', icon: Landmark, description: 'Manage tax jurisdictions', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Tenants', path: '/dashboard/tenants', icon: Building2, description: 'Manage tenants', roles: ['platform_admin'] },
      { name: 'Onboarding Operations', path: '/dashboard/onboarding-operations', icon: ShieldAlert, description: 'Manual self-service approval and support operations', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Franchises', path: '/dashboard/franchises', icon: Package, description: 'Franchise entities', roles: ['platform_admin', 'tenant_admin'] },
      { name: 'Users', path: '/dashboard/users', icon: Users, description: 'Manage users and roles', permissions: ['admin.users.manage'] },
      { name: 'Transfer Center', path: '/dashboard/transfers', icon: ArrowRightLeft, description: 'Move records between entities', permissions: ['transfers.view'] },
    ],
  },
  {
    label: 'Markets',
    items: [
      {
        name: 'Portfolios',
        path: '/dashboard/markets/portfolios',
        icon: Wallet,
        description: 'Manage equity, MF, commodity & F&O portfolios',
        screens: [
          { name: 'Holdings',     path: '/dashboard/markets/portfolios/:id', description: 'Current positions and P&L' },
          { name: 'Transactions', path: '/dashboard/markets/portfolios/:id', description: 'Buy/sell/SIP transaction history' },
          { name: 'AI Briefs',    path: '/dashboard/markets/portfolios/:id', description: 'LLM-generated market analysis' },
        ],
      },
      {
        name: 'Watchlists',
        path: '/dashboard/markets/watchlists',
        icon: Eye,
        description: 'Track instruments across asset classes',
      },
      {
        name: 'AI Research',
        path: '/dashboard/markets/research',
        icon: Brain,
        description: 'Chat with an AI analyst over your portfolio and market data',
      },
      {
        name: 'Strategies',
        path: '/dashboard/markets/strategies',
        icon: GitBranch,
        description: 'Define and manage rule-based or AI-driven trading strategies',
      },
      {
        name: 'Backtests',
        path: '/dashboard/markets/backtests',
        icon: BarChart3,
        description: 'Run historical simulations of your strategies',
      },
      {
        name: 'Signals',
        path: '/dashboard/markets/signals',
        icon: Activity,
        description: 'AI-generated buy, sell, and hold signals across instruments',
      },
      {
        name: 'Broker Accounts',
        path: '/dashboard/markets/settings/brokers',
        icon: Wifi,
        description: 'Connect broker accounts for live sync and order placement',
      },
      {
        name: 'F&O Chain',
        path: '/dashboard/markets/fno',
        icon: TrendingUp,
        description: 'NSE-style live option chain with greeks and quick order placement',
      },
      {
        name: 'Mutual Funds',
        path: '/dashboard/markets/mf',
        icon: PiggyBank,
        description: 'Direct MF plans — discover, invest, SIP, and manage portfolio',
      },
      {
        name: 'LLM Settings',
        path: '/dashboard/markets/settings/llm',
        icon: CandlestickChart,
        description: 'Configure AI providers for market analysis',
        roles: ['platform_admin', 'tenant_admin'],
      },
    ],
  },
  {
    label: 'Settings',
    items: [
      { name: 'System Settings', path: '/dashboard/settings', icon: Cog, description: 'Account and app settings', roles: ['platform_admin'] },
      { name: 'Channel Integrations', path: '/dashboard/settings/channel-integrations', icon: Cog, description: 'Manage WhatsApp, X, Telegram, LinkedIn, Web', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Communications Hub', path: '/dashboard/communications-hub', icon: Mail, description: 'Unified messages across channels', permissions: ['email.manage'] },
      { name: 'Email Management', path: '/dashboard/email-management', icon: Mail, description: 'Manage emails', permissions: ['email.manage'] },
      { name: 'Roles & Permissions', path: '/dashboard/settings/permissions', icon: Cog, description: 'Configure access control', roles: ['platform_admin'], permissions: ['admin.settings.manage'] },
      { name: 'Tenant Branding', path: '/dashboard/tenant-branding', icon: Palette, description: 'Configure your tenant branding', roles: ['tenant_admin', 'franchise_admin', 'user'] },
      { name: 'Theme Management', path: '/dashboard/themes', icon: Palette, description: 'Customize theme', roles: ['platform_admin'] },
      { name: 'Subscription', path: '/dashboard/settings/subscription', icon: CreditCard, description: 'Manage plan and usage', roles: ['platform_admin'] },
      { name: 'Data Management', path: '/dashboard/settings/data-management', icon: Cog, description: 'Database options and quote numbering', roles: ['platform_admin'] },
      { name: 'Database Export', path: '/dashboard/settings/database-export', icon: Database, description: 'Export tables and backups', roles: ['platform_admin'] },
      { name: 'Business Domain Assignments', path: '/dashboard/settings/domains', icon: Globe, description: 'Assign business domains to tenants', roles: ['platform_admin'] },
      { name: 'Master Data (Geography)', path: '/dashboard/settings/master-data', icon: Globe, description: 'Continents, countries, states, cities', roles: ['platform_admin'] },
      { name: 'Master Data (Subscription Plans)', path: '/dashboard/settings/master-data-subscription-plans', icon: DollarSign, description: 'Subscription plan catalog and metadata', roles: ['platform_admin'] },
      { name: 'Master Data (HTS Codes)', path: '/dashboard/settings/master-data-hts', icon: FileText, description: 'HTS/Schedule B codes manager', roles: ['platform_admin'] },
      { name: 'Quote Numbering', path: '/dashboard/settings/quote-numbers', icon: FileCheck, description: 'Prefixes and reset policy', roles: ['platform_admin'] },
      { name: 'Quotation Engine', path: '/dashboard/settings/quotations', icon: FileCheck, description: 'Configure default module & smart mode', roles: ['platform_admin'] },
      { name: 'Feature Flags', path: '/dashboard/settings/feature-flags', icon: Flag, description: 'Control feature availability across tenants', roles: ['platform_admin'] },
      { name: 'Audit Logs', path: '/dashboard/audit-logs', icon: FileText, description: 'View system audit logs', roles: ['platform_admin', 'tenant_admin'] },
      { name: 'UI Forms Demo', path: '/dashboard/ui-forms-demo', icon: FileText, description: 'Phase 1–2 form patterns', roles: ['platform_admin'] },
      { name: 'UI Advanced Demo', path: '/dashboard/ui-advanced-demo', icon: FileCheck, description: 'Phase 3–5 advanced fields', roles: ['platform_admin'] },
    ],
  },
];

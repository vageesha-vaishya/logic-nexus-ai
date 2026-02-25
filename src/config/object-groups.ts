import { type LucideIcon, Building2, Users, UserPlus, TrendingUp, CheckSquare, Mail, Settings, FileText, Package, GitBranch, Palette, Home, Shield, ArrowRightLeft } from 'lucide-react';

export type ObjectMenuItem = {
  name: string;
  to: string;
  icon: LucideIcon;
  description?: string;
  badge?: string;
};

export type ObjectGroup = {
  label: string;
  items: ObjectMenuItem[];
};

export const OBJECT_GROUPS: ObjectGroup[] = [
  {
    label: 'Sales',
    items: [
      { name: 'Dashboard', to: '/dashboard', icon: Home, description: 'Overview and key metrics' },
      { name: 'Accounts', to: '/dashboard/accounts', icon: Building2, description: 'Organizations and customers' },
      { name: 'Contacts', to: '/dashboard/contacts', icon: Users, description: 'People tied to accounts' },
      { name: 'Leads', to: '/dashboard/leads', icon: UserPlus, description: 'Prospects to qualify' },
      { name: 'Opportunities', to: '/dashboard/opportunities', icon: TrendingUp, description: 'Deals and pipeline' },
      { name: 'Quotes', to: '/dashboard/quotes/pipeline', icon: FileText, description: 'Sales quotes and proposals' },
      { name: 'Activities', to: '/dashboard/activities', icon: CheckSquare, description: 'Tasks, calls, meetings' },
    ],
  },
  {
    label: 'Communications',
    items: [
      { name: 'Email Management', to: '/dashboard/email-management', icon: Mail, description: 'Templates and sends' },
    ],
  },
  {
    label: 'Administration',
    items: [
      { name: 'Lead Assignment', to: '/dashboard/lead-assignment', icon: GitBranch, description: 'Distribute inbound leads' },
      { name: 'Lead Routing', to: '/dashboard/lead-routing', icon: GitBranch, description: 'Rules for auto-routing' },
      { name: 'Tenants', to: '/dashboard/tenants', icon: FileText, description: 'Multi-tenant administration' },
      { name: 'Franchises', to: '/dashboard/franchises', icon: Package, description: 'Franchise entities' },
      { name: 'Transfer Center', to: '/dashboard/transfers', icon: ArrowRightLeft, description: 'Move records between entities' },
      { name: 'Users', to: '/dashboard/users', icon: Users, description: 'Manage users and roles' },
      { name: 'Roles & Permissions', to: '/dashboard/settings/permissions', icon: Shield, description: 'Configure access control' },
      { name: 'Security Overview', to: '/dashboard/security-overview', icon: Shield, description: 'RLS policies and security' },
      { name: 'Settings', to: '/dashboard/settings', icon: Settings, description: 'Global and app settings' },
    ],
  },
  {
    label: 'Personalization',
    items: [
      { name: 'Themes', to: '/dashboard/themes', icon: Palette, description: 'Customize look and feel' },
    ],
  },
];

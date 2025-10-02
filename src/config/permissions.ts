// Permission slugs modeled after Salesforce-style modules and actions
export type Permission =
  | 'leads.view'
  | 'leads.create'
  | 'leads.edit'
  | 'leads.delete'
  | 'leads.convert'
  | 'leads.assign'
  | 'leads.import_export'
  | 'accounts.view'
  | 'accounts.create'
  | 'accounts.edit'
  | 'accounts.delete'
  | 'contacts.view'
  | 'contacts.create'
  | 'contacts.edit'
  | 'contacts.delete'
  | 'opportunities.view'
  | 'opportunities.create'
  | 'opportunities.edit'
  | 'opportunities.delete'
  | 'activities.view'
  | 'activities.create'
  | 'activities.edit'
  | 'activities.delete'
  | 'activities.complete'
  | 'campaigns.view'
  | 'campaigns.manage'
  | 'files.view'
  | 'files.manage'
  | 'dashboards.view'
  | 'dashboards.manage'
  | 'reports.view'
  | 'reports.manage'
  | 'chatter.view'
  | 'chatter.post'
  | 'chatter.moderate'
  | 'groups.view'
  | 'groups.manage'
  | 'calendar.view'
  | 'calendar.manage'
  | 'admin.tenants.manage'
  | 'admin.franchises.manage'
  | 'admin.users.manage'
  | 'admin.lead_routing.manage'
  | 'admin.lead_assignment.manage'
  | 'admin.settings.manage';

export const ROLE_PERMISSIONS: Record<
  'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user',
  Permission[]
> = {
  platform_admin: [
    // Full access
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'admin.tenants.manage','admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
  ],
  tenant_admin: [
    // Admin within tenant
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
  ],
  franchise_admin: [
    // Admin within franchise
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign',
    'accounts.view','accounts.create','accounts.edit',
    'contacts.view','contacts.create','contacts.edit',
    'opportunities.view','opportunities.create','opportunities.edit',
    'activities.view','activities.create','activities.edit','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
    'admin.lead_assignment.manage',
  ],
  user: [
    // Typical sales user
    'leads.view','leads.create','leads.edit','leads.convert',
    'accounts.view','accounts.create',
    'contacts.view','contacts.create',
    'opportunities.view','opportunities.create',
    'activities.view','activities.create','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
  ],
};

export function unionPermissions(...lists: Permission[][]): Permission[] {
  return Array.from(new Set(lists.flat()));
}
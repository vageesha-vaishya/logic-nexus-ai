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
  | 'quotes.view'
  | 'quotes.create'
  | 'quotes.edit'
  | 'quotes.delete'
  | 'quotes.templates.manage'
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
  | 'admin.settings.manage'
  | 'shipments.view' | 'shipments.create' | 'shipments.edit' | 'shipments.delete'
  | 'shipments.approvals.view' | 'shipments.approvals.manage'
  | 'shipments.reports.view' | 'shipments.reports.manage'
  | 'shipments.config.manage'
  | 'shipments.audit.view' | 'shipments.audit.manage'
  | 'warehouses.view' | 'warehouses.create' | 'warehouses.edit' | 'warehouses.delete'
  | 'vehicles.view' | 'vehicles.create' | 'vehicles.edit' | 'vehicles.delete'
  | 'carriers.view' | 'carriers.create' | 'carriers.edit' | 'carriers.delete'
  | 'service_types.view' | 'service_types.create' | 'service_types.edit' | 'service_types.delete'
  | 'services.view' | 'services.create' | 'services.edit' | 'services.delete'
  | 'service_type_mappings.view' | 'service_type_mappings.create' | 'service_type_mappings.edit' | 'service_type_mappings.delete'
  | 'ports_locations.view' | 'ports_locations.create' | 'ports_locations.edit' | 'ports_locations.delete'
  | 'consignees.view' | 'consignees.create' | 'consignees.edit' | 'consignees.delete';


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
    'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.templates.manage',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'admin.tenants.manage','admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
    'shipments.view','shipments.create','shipments.edit','shipments.delete',
    'shipments.approvals.view','shipments.approvals.manage',
    'shipments.reports.view','shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.view','shipments.audit.manage',
  ],
  tenant_admin: [
    // Admin within tenant
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.templates.manage',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
    'shipments.view','shipments.create','shipments.edit','shipments.delete',
    'shipments.approvals.view','shipments.approvals.manage',
    'shipments.reports.view','shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.view',
  ],
  franchise_admin: [
    // Admin within franchise
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign',
    'accounts.view','accounts.create','accounts.edit',
    'contacts.view','contacts.create','contacts.edit',
    'opportunities.view','opportunities.create','opportunities.edit',
    'quotes.view','quotes.create','quotes.edit',
    'activities.view','activities.create','activities.edit','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
    'admin.lead_assignment.manage',
    'shipments.view','shipments.create','shipments.edit',
    'shipments.approvals.view',
    'shipments.reports.view',
  ],
  user: [
    // Typical sales user
    'leads.view','leads.create','leads.edit','leads.convert',
    'accounts.view','accounts.create',
    'contacts.view','contacts.create',
    'opportunities.view','opportunities.create',
    'quotes.view','quotes.create',
    'activities.view','activities.create','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
    'shipments.view',
  ],
};

export function unionPermissions(...lists: Permission[][]): Permission[] {
  return Array.from(new Set(lists.flat()));
}

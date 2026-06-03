// Permission slugs modeled after Salesforce-style modules and actions
export type AppRole = 'platform_admin' | 'super_admin' | 'tenant_admin' | 'franchise_admin' | 'user';
export const PLATFORM_ADMIN_ROLE: AppRole = 'platform_admin';

export type Permission =
  | '*'
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
  | 'quotes.import_export'
  | 'quotes.analytics'
  | 'quotes.export_sensitive'
  | 'quotes.templates.manage'
  | 'import_quotation'
  | 'export_quotation'
  | 'export_quotation_sensitive'
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
  | 'email.manage'
  | 'admin.tenants.manage'
  | 'admin.franchises.manage'
  | 'admin.users.manage'
  | 'admin.lead_routing.manage'
  | 'admin.lead_assignment.manage'
  | 'admin.settings.manage'
  | 'domains.assign'
  | 'domains.revoke'
  | 'domains.audit.view'
  | 'shipments.view' | 'shipments.create' | 'shipments.edit' | 'shipments.delete'
  | 'shipments.approvals.view' | 'shipments.approvals.manage'
  | 'shipments.reports.view' | 'shipments.reports.manage'
  | 'shipments.config.manage'
  | 'shipments.audit.view' | 'shipments.audit.manage'
  | 'warehouses.view' | 'warehouses.create' | 'warehouses.edit' | 'warehouses.delete'
  | 'vehicles.view' | 'vehicles.create' | 'vehicles.edit' | 'vehicles.delete'
  | 'carriers.view' | 'carriers.create' | 'carriers.edit' | 'carriers.delete'
  | 'vendors.view' | 'vendors.create' | 'vendors.edit' | 'vendors.delete'
  | 'service_types.view' | 'service_types.create' | 'service_types.edit' | 'service_types.delete'
  | 'services.view' | 'services.create' | 'services.edit' | 'services.delete'
  | 'service_type_mappings.view' | 'service_type_mappings.create' | 'service_type_mappings.edit' | 'service_type_mappings.delete'
  | 'ports_locations.view' | 'ports_locations.create' | 'ports_locations.edit' | 'ports_locations.delete'
  | 'consignees.view' | 'consignees.create' | 'consignees.edit' | 'consignees.delete'
  | 'transfers.view' | 'transfers.create' | 'transfers.approve' | 'transfers.reject'
  | 'finance.commissions.view' | 'finance.commissions.manage'
  | 'finance.commission_rules.view' | 'finance.commission_rules.manage'
  | 'finance.draft_invoices.view' | 'finance.draft_invoices.manage'
  | 'finance.outbox_retries.view' | 'finance.outbox_retries.manage'
  | 'compliance.officer.view' | 'compliance.officer.manage'
  // Phase 7 UIM Step 5 — tighten module-level route guards.
  // uim.read controls visibility of the Universal Integration Module
  // (inventory + integrations + webhooks); uim.manage gates the write
  // surfaces (CRUD on integrations, webhook subscriptions, etc.).
  | 'uim.read' | 'uim.manage'
  | 'view_amro_dashboard'
  | 'create_maintenance_request'
  | 'edit_aircraft_records'
  | 'delete_flight_logs'
  | 'approve_work_orders';


export const ROLE_PERMISSIONS: Record<
  AppRole,
  Permission[]
> = {
  platform_admin: [
    // Full access
    '*',
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.import_export','quotes.analytics','quotes.export_sensitive','quotes.templates.manage','import_quotation','export_quotation','export_quotation_sensitive',
    'transfers.view', 'transfers.create', 'transfers.approve', 'transfers.reject',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'uim.read','uim.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'email.manage',
    'admin.tenants.manage','admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
    'domains.assign','domains.revoke','domains.audit.view',
    'shipments.view','shipments.create','shipments.edit','shipments.delete',
    'vendors.view','vendors.create','vendors.edit','vendors.delete',
    'warehouses.view','warehouses.create','warehouses.edit','warehouses.delete',
    'shipments.approvals.view','shipments.approvals.manage',
    'shipments.reports.view','shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.view','shipments.audit.manage',
    'finance.commissions.view','finance.commissions.manage','finance.commission_rules.view','finance.commission_rules.manage','finance.draft_invoices.view','finance.draft_invoices.manage','finance.outbox_retries.view','finance.outbox_retries.manage',
    'compliance.officer.view','compliance.officer.manage',
    'view_amro_dashboard','create_maintenance_request','edit_aircraft_records','delete_flight_logs','approve_work_orders',
  ],
  super_admin: [
    '*',
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.import_export','quotes.analytics','quotes.export_sensitive','quotes.templates.manage','import_quotation','export_quotation','export_quotation_sensitive',
    'transfers.view', 'transfers.create', 'transfers.approve', 'transfers.reject',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'uim.read','uim.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'email.manage',
    'admin.tenants.manage','admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
    'domains.assign','domains.revoke','domains.audit.view',
    'shipments.view','shipments.create','shipments.edit','shipments.delete',
    'vendors.view','vendors.create','vendors.edit','vendors.delete',
    'warehouses.view','warehouses.create','warehouses.edit','warehouses.delete',
    'shipments.approvals.view','shipments.approvals.manage',
    'shipments.reports.view','shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.view','shipments.audit.manage',
    'finance.commissions.view','finance.commissions.manage','finance.commission_rules.view','finance.commission_rules.manage','finance.draft_invoices.view','finance.draft_invoices.manage','finance.outbox_retries.view','finance.outbox_retries.manage',
    'compliance.officer.view','compliance.officer.manage',
    'view_amro_dashboard','create_maintenance_request','edit_aircraft_records','delete_flight_logs','approve_work_orders',
  ],
  tenant_admin: [
    // Admin within tenant
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign','leads.import_export',
    'accounts.view','accounts.create','accounts.edit','accounts.delete',
    'contacts.view','contacts.create','contacts.edit','contacts.delete',
    'opportunities.view','opportunities.create','opportunities.edit','opportunities.delete',
    'quotes.view','quotes.create','quotes.edit','quotes.delete','quotes.import_export','quotes.analytics','quotes.export_sensitive','quotes.templates.manage','import_quotation','export_quotation',
    'transfers.view', 'transfers.create', 'transfers.approve', 'transfers.reject',
    'activities.view','activities.create','activities.edit','activities.delete','activities.complete',
    'campaigns.view','campaigns.manage',
    'files.view','files.manage',
    'dashboards.view','dashboards.manage',
    'uim.read','uim.manage',
    'reports.view','reports.manage',
    'chatter.view','chatter.post','chatter.moderate',
    'groups.view','groups.manage',
    'calendar.view','calendar.manage',
    'email.manage',
    'admin.franchises.manage','admin.users.manage','admin.lead_routing.manage','admin.lead_assignment.manage','admin.settings.manage',
    'domains.audit.view',
    'shipments.view','shipments.create','shipments.edit','shipments.delete',
    'vendors.view','vendors.create','vendors.edit','vendors.delete',
    'shipments.approvals.view','shipments.approvals.manage',
    'shipments.reports.view','shipments.reports.manage',
    'shipments.config.manage',
    'shipments.audit.view',
    'finance.commissions.view','finance.commissions.manage','finance.commission_rules.view','finance.commission_rules.manage','finance.draft_invoices.view','finance.draft_invoices.manage','finance.outbox_retries.view','finance.outbox_retries.manage',
    'compliance.officer.view','compliance.officer.manage',
    'view_amro_dashboard','create_maintenance_request','edit_aircraft_records','approve_work_orders',
  ],
  franchise_admin: [
    // Admin within franchise
    'leads.view','leads.create','leads.edit','leads.delete','leads.convert','leads.assign',
    'accounts.view','accounts.create','accounts.edit',
    'contacts.view','contacts.create','contacts.edit',
    'opportunities.view','opportunities.create','opportunities.edit',
    'quotes.view','quotes.create','quotes.edit','quotes.import_export','quotes.analytics','import_quotation','export_quotation',
    'activities.view','activities.create','activities.edit','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'uim.read',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
    'email.manage',
    'admin.lead_assignment.manage',
    'shipments.view','shipments.create','shipments.edit',
    'shipments.approvals.view',
    'shipments.reports.view',
    'view_amro_dashboard','create_maintenance_request','edit_aircraft_records',
  ],
  user: [
    // Typical sales user
    'leads.view','leads.create','leads.edit','leads.convert',
    'accounts.view','accounts.create',
    'contacts.view','contacts.create',
    'opportunities.view','opportunities.create',
    'quotes.view','quotes.create','quotes.import_export','quotes.analytics','import_quotation','export_quotation',
    'activities.view','activities.create','activities.complete',
    'campaigns.view',
    'files.view',
    'dashboards.view',
    'uim.read',
    'reports.view',
    'chatter.view','chatter.post',
    'groups.view',
    'calendar.view',
    'email.manage',
    'shipments.view',
    'view_amro_dashboard',
  ],
};

export function unionPermissions(...lists: Permission[][]): Permission[] {
  return Array.from(new Set(lists.flat()));
}

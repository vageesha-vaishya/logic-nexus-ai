import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const srcUrl = process.env.SOURCE_SUPABASE_URL
const srcAnon = process.env.SOURCE_SUPABASE_PUBLISHABLE_KEY
const srcService = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY
if (!srcUrl || (!srcAnon && !srcService)) {
  console.error('Missing SOURCE_SUPABASE_URL and API key(s). Set SOURCE_SUPABASE_SERVICE_ROLE_KEY for complete export (bypasses RLS).')
  process.exit(1)
}
const key = srcService && srcService.length > 0 ? srcService : srcAnon
if (!srcService || srcService.length === 0) {
  console.warn('WARNING: No SOURCE_SUPABASE_SERVICE_ROLE_KEY set. Export uses anon key and may be incomplete due to RLS.')
}
const supabase = createClient(srcUrl, key)

const now = new Date()
const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
const outDir = path.join(process.cwd(), `migration-export-${ts}`)
const dataDir = path.join(outDir, 'data')
fs.mkdirSync(dataDir, { recursive: true })

async function writeCsv(file, rows) {
  if (!rows || rows.length === 0) {
    fs.writeFileSync(file, '')
    return
  }
  const csv = Papa.unparse(rows)
  fs.writeFileSync(file, csv)
}

async function exportTable(name, index) {
  const pageSize = 1000
  let offset = 0
  let all = []
  while (true) {
    const { data, error } = await supabase.from(name).select('*').range(offset, offset + pageSize - 1)
    if (error) break
    if (!data || data.length === 0) break
    all = all.concat(data)
    if (data.length < pageSize) break
    offset += pageSize
  }
  const file = path.join(dataDir, `${String(index).padStart(2, '0')}-${name}.csv`)
  await writeCsv(file, all)
}

async function exportAuthUsers() {
  if (!srcService || srcService.length === 0) return
  let nextPage = 1
  const perPage = 200
  let all = []
  while (true) {
    const res = await supabase.auth.admin.listUsers({ page: nextPage, perPage })
    if (res.error) break
    const users = res.data.users || []
    const mapped = users.map(u => ({
      id: u.id,
      email: u.email || null,
      phone: u.phone || null,
      created_at: u.created_at || null,
      updated_at: u.updated_at || null,
      instance_id: u.instance_id || null,
      aud: u.aud || null,
      role: u.role || null,
      email_confirmed_at: u.email_confirmed_at || null,
      phone_confirmed_at: u.phone_confirmed_at || null,
      confirmation_sent_at: u.confirmation_sent_at || null,
      recovery_sent_at: u.recovery_sent_at || null,
      last_sign_in_at: u.last_sign_in_at || null,
      is_super_admin: u.is_super_admin || null,
      raw_user_meta_data: u.raw_user_meta_data ? JSON.stringify(u.raw_user_meta_data) : null,
      user_metadata: u.user_metadata ? JSON.stringify(u.user_metadata) : null
    }))
    all = all.concat(mapped)
    if (users.length < perPage) break
    nextPage += 1
  }
  const file = path.join(dataDir, `00-auth_users.csv`)
  await writeCsv(file, all)
}

async function main() {
  const tables = [
    // Core org and users
    'tenants',
    'franchises',
    'profiles',
    'user_roles',
    // Subscriptions
    'subscription_plans',
    'tenant_subscriptions',
    // Master/config
    'currencies',
    'service_types',
    'ports_locations',
    'package_categories',
    'package_sizes',
    'cargo_types',
    'incoterms',
    'container_types',
    'container_sizes',
    'service_type_mappings',
    'charge_categories',
    'charge_bases',
    'charge_sides',
    // Logistics/carriers
    'carriers',
    'services',
    'carrier_rates',
    'warehouses',
    'vehicles',
    'consignees',
    // CRM
    'accounts',
    'contacts',
    'campaigns',
    'campaign_members',
    'leads',
    'opportunities',
    'opportunity_line_items',
    'opportunity_items',
    'activities',
    // Quotes/shipments
    'quote_number_config_tenant',
    'quote_number_config_franchise',
    'quote_number_sequences',
    'quotes',
    'quotation_versions',
    'quotation_version_options',
    'customer_selections',
    'quote_items',
    'quote_charges',
    'shipment_items',
    'shipments',
    'cargo_details',
    // Tracking and territory
    'tracking_events',
    'territory_assignments',
    'assignment_rules',
    'lead_assignment_history',
    'lead_assignment_queue',
    // Emails and audit
    'emails',
    'email_accounts',
    'email_templates',
    'audit_logs',
    'system_settings',
    'notifications',
    // Roles/customization
    'user_custom_roles',
    'custom_roles',
    'roles_permissions',
    'custom_role_permissions',
    'groups',
    'usage_records',
    // Capacity
    'user_capacity'
  ]
  await exportAuthUsers()
  for (let i = 0; i < tables.length; i++) {
    await exportTable(tables[i], i + 1)
  }
}

main().then(() => {
  process.exit(0)
}).catch(() => {
  process.exit(1)
})
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

// Source Supabase configuration
const srcUrl = process.env.SOURCE_SUPABASE_URL || 'https://pqptgpntbthrisnuwwzi.supabase.co'
const srcServiceKey = process.env.SOURCE_SERVICE_ROLE_KEY

if (!srcServiceKey) {
  console.error('❌ SOURCE_SERVICE_ROLE_KEY environment variable is required')
  console.error('   Please set it in your environment or pass it when running this script:')
  console.error('   SOURCE_SERVICE_ROLE_KEY=your_key node export-with-service-role.js')
  process.exit(1)
}

// Create client with service role (bypasses RLS)
const supabase = createClient(srcUrl, srcServiceKey)

const now = new Date()
const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
const outDir = path.join(process.cwd(), '..', `migration-export-${ts}`)
const dataDir = path.join(outDir, 'data')
fs.mkdirSync(dataDir, { recursive: true })

console.log('🔐 Using service role key for export...')
console.log(`📁 Export directory: ${dataDir}\n`)

async function writeCsv(file, rows) {
  if (!rows || rows.length === 0) {
    fs.writeFileSync(file, '')
    console.log(`  ⚠️  No data (wrote empty file)`)
    return
  }
  const csv = Papa.unparse(rows)
  fs.writeFileSync(file, csv)
  console.log(`  ✅ ${rows.length} rows`)
}

async function exportTable(name, index) {
  console.log(`\n📊 Exporting: ${name}`)
  const pageSize = 1000
  let offset = 0
  let all = []
  
  while (true) {
    const { data, error } = await supabase
      .from(name)
      .select('*')
      .range(offset, offset + pageSize - 1)
    
    if (error) {
      console.error(`  ❌ Error: ${error.message}`)
      break
    }
    
    if (!data || data.length === 0) break
    
    all = all.concat(data)
    console.log(`  📥 Fetched ${data.length} rows (total: ${all.length})`)
    
    if (data.length < pageSize) break
    offset += pageSize
  }
  
  const file = path.join(dataDir, `${String(index).padStart(2, '0')}-${name}.csv`)
  await writeCsv(file, all)
}

async function exportAuthUsers() {
  console.log('\n👥 Exporting auth users...')
  
  try {
    const { data: { users }, error } = await supabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    })
    
    if (error) {
      console.error(`  ❌ Error: ${error.message}`)
      return
    }
    
    const formatted = users.map(u => ({
      id: u.id,
      email: u.email,
      encrypted_password: '',
      email_confirmed_at: u.email_confirmed_at,
      created_at: u.created_at,
      updated_at: u.updated_at,
      raw_user_meta_data: JSON.stringify(u.user_metadata || {}),
      raw_app_meta_data: JSON.stringify(u.app_metadata || {})
    }))
    
    const file = path.join(dataDir, '00-auth_users.csv')
    await writeCsv(file, formatted)
  } catch (err) {
    console.error(`  ❌ Error: ${err.message}`)
  }
}

async function main() {
  try {
    const tables = [
      'tenants',
      'franchises',
      'profiles',
      'user_roles',
      'subscription_plans',
      'tenant_subscriptions',
      'service_types',
      'ports_locations',
      'currencies',
      'carriers',
      'services',
      'carrier_rates',
      'warehouses',
      'vehicles',
      'consignees',
      'accounts',
      'contacts',
      'campaigns',
      'campaign_members',
      'leads',
      'opportunities',
      'opportunity_line_items',
      'opportunity_items',
      'activities',
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
      'tracking_events',
      'territory_assignments',
      'assignment_rules',
      'lead_assignment_history',
      'lead_assignment_queue',
      'emails',
      'email_accounts',
      'email_templates',
      'audit_logs',
      'system_settings',
      'notifications',
      'user_custom_roles',
      'custom_roles',
      'roles_permissions',
      'custom_role_permissions',
      'user_capacity',
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
      'groups',
      'usage_records'
    ]
    
    console.log(`\n📋 Exporting ${tables.length} tables...\n`)
    
    await exportAuthUsers()
    
    for (let i = 0; i < tables.length; i++) {
      await exportTable(tables[i], i + 1)
    }
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ EXPORT COMPLETE')
    console.log('='.repeat(60))
    console.log(`📁 Data exported to: ${dataDir}`)
    console.log('\nNext steps:')
    console.log('1. Review the exported data')
    console.log('2. Run the import script to load data into new project')
    
  } catch (error) {
    console.error('\n❌ Export failed:', error)
    process.exit(1)
  }
}

main().then(() => {
  process.exit(0)
}).catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})

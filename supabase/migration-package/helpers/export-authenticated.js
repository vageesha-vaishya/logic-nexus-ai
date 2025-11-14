import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import Papa from 'papaparse'

const srcUrl = process.env.SOURCE_SUPABASE_URL || 'https://pqptgpntbthrisnuwwzi.supabase.co'
const srcAnonKey = process.env.SOURCE_SUPABASE_PUBLISHABLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHRncG50YnRocmlzbnV3d3ppIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMzU3NzIsImV4cCI6MjA3NDgxMTc3Mn0.sfNBAUjS9EuhcNb-EPG7pKjPG9s6fx_kaWY_B7k2yjM'
const adminEmail = 'bahuguna.vimal@gmail.com'
const adminPassword = '#!#Vimal@2025'

const supabase = createClient(srcUrl, srcAnonKey)

const now = new Date()
const ts = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`
const outDir = path.join(process.cwd(), `migration-export-${ts}`)
const dataDir = path.join(outDir, 'data')
fs.mkdirSync(dataDir, { recursive: true })

console.log('🔐 Authenticating as platform admin...')

async function authenticate() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: adminEmail,
    password: adminPassword
  })
  
  if (error) {
    console.error('❌ Authentication failed:', error.message)
    throw error
  }
  
  console.log('✅ Authenticated successfully')
  return data.session.access_token
}

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
  
  // Note: Regular authenticated users cannot access auth.admin API
  // We'll need to use the REST API endpoint or service role for this
  console.log('  ⚠️  Skipping auth users (requires service role)')
}

async function main() {
  try {
    await authenticate()
    
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
    
    for (let i = 0; i < tables.length; i++) {
      await exportTable(tables[i], i + 1)
    }
    
    await exportAuthUsers()
    
    console.log('\n' + '='.repeat(60))
    console.log('✅ EXPORT COMPLETE')
    console.log('='.repeat(60))
    console.log(`📁 Data exported to: ${dataDir}`)
    console.log('\nNext steps:')
    console.log('1. Copy the exported data to migration-data/ directory')
    console.log('2. Run: ./03-import-data.sh')
    console.log('3. Run: ./verify-migration.sh')
    
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

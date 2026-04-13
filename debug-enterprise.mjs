/**
 * Debug Enterprise Data Access
 * 
 * Run this to test if the authenticated Supabase client can access the enterprise tables
 * 
 * Usage:
 * node debug-enterprise.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  console.error('Current values:', { 
    url: supabaseUrl ? '✓ Set' : '✗ Missing', 
    key: supabaseKey ? '✓ Set' : '✗ Missing' 
  });
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTable(tableName) {
  console.log(`\n📊 Checking ${tableName}...`);
  
  // Check if table exists and count rows
  const { count, error } = await supabase
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error(`  ❌ Error: ${error.message}`);
    console.error(`  Code: ${error.code}`);
    return null;
  }
  
  console.log(`  ✅ Table exists, ${count} rows`);
  
  // Get sample data
  const { data, error: sampleError } = await supabase
    .from(tableName)
    .select('*')
    .limit(3);
  
  if (sampleError) {
    console.error(`  ❌ Sample error: ${sampleError.message}`);
    return null;
  }
  
  console.log(`  📝 Sample data (${data?.length || 0} rows):`);
  data?.forEach((row, i) => {
    if (tableName === 'amro_tooling_registry') {
      console.log(`    ${i + 1}. ${row.tool_code} - ${row.tool_name}`);
    } else if (tableName === 'amro_compliance_ad_sb_registry') {
      console.log(`    ${i + 1}. ${row.directive_number} - ${row.title}`);
    } else {
      console.log(`    ${i + 1}. ${JSON.stringify(row).substring(0, 100)}...`);
    }
  });
  
  return count;
}

async function main() {
  console.log('🔍 Debugging Enterprise Data Access');
  console.log(`Supabase URL: ${supabaseUrl}`);
  console.log(`Using Service Role Key: ${supabaseKey?.substring(0, 20)}...`);
  
  try {
    // Check each table
    const toolCount = await checkTable('amro_tooling_registry');
    const adsbCount = await checkTable('amro_compliance_ad_sb_registry');
    const instanceCount = await checkTable('amro_tooling_instances');
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 SUMMARY');
    console.log('='.repeat(60));
    console.log(`amro_tooling_registry: ${toolCount ?? '❌ Error'} rows`);
    console.log(`amro_compliance_ad_sb_registry: ${adsbCount ?? '❌ Error'} rows`);
    console.log(`amro_tooling_instances: ${instanceCount ?? '❌ Error'} rows`);
    console.log('='.repeat(60));
    
    if (toolCount === 0 || adsbCount === 0) {
      console.log('\n⚠️  WARNING: Tables are empty!');
      console.log('The seed data migration did not insert data.');
      console.log('\n💡 Solution: Run this SQL in Supabase SQL Editor:');
      console.log(`
INSERT INTO amro_tooling_registry (tenant_id, tool_code, tool_name, manufacturer, model_number, tool_category, tool_type, calibration_required, calibration_interval_days)
VALUES 
  ('YOUR-TENANT-ID', 'TOOL-TW-500', 'Digital Torque Wrench', 'Snap-on', 'ECF500', 'hand_tool', 'Torque Wrench', TRUE, 180),
  ('YOUR-TENANT-ID', 'TOOL-PD-750', 'Pneumatic Drill', 'Chicago Pneumatic', 'CP750', 'power_tool', 'Drill', TRUE, 365);

INSERT INTO amro_compliance_ad_sb_registry (tenant_id, directive_number, directive_type, regulatory_authority, oem, aircraft_model, effective_date, compliance_deadline, title, description, applicability, summary, applicable_to_fleet, priority)
VALUES 
  ('YOUR-TENANT-ID', 'AD 2024-12-05', 'AD', 'FAA', 'CFM International', 'A320neo', '2024-12-01', '2025-06-01', 'Engine Fuel Pump Inspection', 'Inspect fuel pump', 'A320neo', 'Mandatory', TRUE, 'high');
      `);
    } else {
      console.log('\n✅ Data exists in database!');
      console.log('If UI still shows no data, the issue is:');
      console.log('  1. RLS policies blocking authenticated queries');
      console.log('  2. Frontend not using authenticated Supabase client');
      console.log('  3. Tenant ID mismatch between user session and data');
    }
  } catch (error) {
    console.error('\n❌ Debug failed:', error.message);
    process.exit(1);
  }
}

main();

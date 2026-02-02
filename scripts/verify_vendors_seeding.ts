
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyVendorSeeding() {
  console.log('🔍 Starting Vendor Seeding Verification...\n');

  // 1. Verify Vendor Types Distribution
  const { data: vendors, error } = await supabase
    .from('vendors')
    .select('type, name, operational_data, performance_metrics');

  if (error) {
    console.error('❌ Error fetching vendors:', error);
    process.exit(1);
  }

  console.log(`✅ Total Vendors Found: ${vendors.length}`);

  const typeCounts: Record<string, number> = {};
  const logisticsTypes = [
    'ocean_carrier', 'air_carrier', 'trucker', 'rail_carrier', 
    'freight_forwarder', 'courier', '3pl', 'warehouse', 'customs_broker'
  ];

  let logisticsVendorCount = 0;

  vendors.forEach(v => {
    typeCounts[v.type] = (typeCounts[v.type] || 0) + 1;
    if (logisticsTypes.includes(v.type)) {
      logisticsVendorCount++;
    }
  });

  console.log('\n📊 Vendor Type Distribution:');
  console.table(typeCounts);

  if (logisticsVendorCount === 0) {
    console.error('❌ No logistics vendors found! Seeding might have failed.');
    process.exit(1);
  } else {
    console.log(`✅ Found ${logisticsVendorCount} logistics-related vendors.`);
  }

  // 2. Verify Operational Data
  const sampleLogisticsVendor = vendors.find(v => logisticsTypes.includes(v.type) && v.operational_data);
  
  if (sampleLogisticsVendor) {
    console.log('\n✅ Verified Operational Data Structure (Sample):');
    console.log(`   Vendor: ${sampleLogisticsVendor.name} (${sampleLogisticsVendor.type})`);
    console.log('   Data:', JSON.stringify(sampleLogisticsVendor.operational_data, null, 2).substring(0, 200) + '...');
  } else {
    console.warn('⚠️ Warning: No logistics vendors found with populated operational_data.');
  }

  // 3. Verify Real-World Vendor Existence
  const targetRealVendor = 'Maersk Line';
  const maersk = vendors.find(v => v.name === targetRealVendor);
  if (maersk) {
    console.log(`\n✅ Verified Real-World Vendor: ${targetRealVendor} exists.`);
  } else {
    console.error(`❌ Real-World Vendor ${targetRealVendor} missing!`);
  }

  console.log('\n✨ Verification Complete!');
}

verifyVendorSeeding();

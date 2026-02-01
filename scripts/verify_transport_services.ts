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

async function verifyTransportServices() {
  console.log('🔍 Starting Transportation Services Verification...\n');

  // 1. Get Service Types for Logistics
  const { data: serviceTypes, error: typeError } = await supabase
    .from('service_types')
    .select('id, code, name')
    .in('code', [
      'ocean_fcl', 'ocean_lcl', 
      'air_express', 'air_standard', 
      'road_ftl', 'road_ltl', 
      'rail_intermodal'
    ]);

  if (typeError) throw typeError;
  
  const typeIds = serviceTypes.map(t => t.id);
  const typeMap = Object.fromEntries(serviceTypes.map(t => [t.id, t.code]));

  console.log(`✅ Found ${serviceTypes.length} Transportation Service Types.`);

  // 2. Get Services linked to these types
  const { data: services, error: serviceError } = await supabase
    .from('services')
    .select('*')
    .in('service_type_id', typeIds)
    .order('service_code');

  if (serviceError) throw serviceError;

  console.log(`✅ Found ${services.length} Seeded Services under Transportation Management.\n`);

  // Group by type for display
  const servicesByType: Record<string, any[]> = {};
  services.forEach(s => {
    const code = typeMap[s.service_type_id];
    if (!servicesByType[code]) servicesByType[code] = [];
    servicesByType[code].push(s);
  });

  // Display results
  for (const [code, list] of Object.entries(servicesByType)) {
    console.log(`📦 ${code} (${list.length} services):`);
    list.forEach(s => {
      console.log(`   - [${s.service_code}] ${s.service_name} ($${s.base_price})`);
      // console.log(`     Metadata: ${JSON.stringify(s.metadata)}`);
    });
    console.log('');
  }

  // Verification checks
  const requiredCodes = [
    'OC-FCL-20SD', 'OC-FCL-40SD', 'OC-FCL-40HC', 'OC-FCL-20RF',
    'OC-LCL-GEN', 'AIR-EXP-NFO', 'RD-FTL-DRY', 'RL-INT-53'
  ];

  const foundCodes = services.map(s => s.service_code);
  const missing = requiredCodes.filter(c => !foundCodes.includes(c));

  if (missing.length > 0) {
    console.error(`❌ Missing expected service codes: ${missing.join(', ')}`);
    process.exit(1);
  } else {
    console.log('✨ All critical service codes present.');
  }
}

verifyTransportServices().catch(console.error);

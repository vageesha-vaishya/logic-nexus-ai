
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
const envPath = join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyQueries() {
  console.log('Verifying UI data fetching queries...');

  try {
    // 1. ShipmentDetail.tsx query
    console.log('Testing ShipmentDetail.tsx query (shipment_cargo_configurations + relations)...');
    const { data: cargo, error: cargoError } = await supabase
      .from('shipment_cargo_configurations')
      .select('*, container_types(name), container_sizes(name)')
      .limit(1);

    if (cargoError) {
      console.error('FAIL: ShipmentDetail query failed:', cargoError.message);
    } else {
      console.log('PASS: ShipmentDetail query successful.');
    }

    // 2. ShipmentDocumentViewer.tsx query
    console.log('Testing ShipmentDocumentViewer.tsx query (shipment_containers + relations)...');
    const { data: containers, error: contError } = await supabase
      .from('shipment_containers')
      .select('*, container_types(name), container_sizes(name)')
      .limit(1);

    if (contError) {
      console.error('FAIL: ShipmentDocumentViewer query failed:', contError.message);
    } else {
      console.log('PASS: ShipmentDocumentViewer query successful.');
    }
    
    // 3. Check for any NULL container_type_id where container_type is NOT NULL (potential data gap)
    console.log('Checking for un-normalized data gaps...');
    const { count: gapCount, error: gapError } = await supabase
        .from('shipment_cargo_configurations')
        .select('*', { count: 'exact', head: true })
        .not('container_type', 'is', null)
        .is('container_type_id', null);
        
    if (gapError) console.error('Error checking gaps:', gapError);
    else if (gapCount > 0) console.warn(`WARNING: Found ${gapCount} records with text but no UUID in shipment_cargo_configurations.`);
    else console.log('PASS: No un-normalized data gaps found.');

  } catch (err) {
    console.error('Unexpected error:', err);
  }
}

verifyQueries();

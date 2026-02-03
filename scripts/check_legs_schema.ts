
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try loading .env.local first, then .env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
  console.log('Loaded .env.local');
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
  console.log('Loaded .env');
} else {
  console.error('No .env file found');
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in env files');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
  console.log('Checking schema for quotation_version_option_legs...');
  
  const columnsToCheck = [
    'id',
    'quotation_version_option_id',
    'mode',
    'origin_location_id',
    'destination_location_id',
    'carrier_id',
    'service_type_id', 
    'origin_location', 
    'destination_location', 
    'leg_type', 
    'service_only_category',
    'carrier_name',
    'transport_mode'
  ];
  
  const results: Record<string, boolean> = {};

  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('quotation_version_option_legs')
      .select(col)
      .limit(1);
      
    if (error) {
      // PGRST204 means column not found usually? Or table not found.
      // Actually Supabase returns "Column X does not exist" in the message usually.
      results[col] = false;
      // console.log(`Column '${col}' check failed:`, error.message);
    } else {
      results[col] = true;
    }
  }

  console.log('Column existence check results:');
  console.table(results);
}

checkSchema().catch(console.error);

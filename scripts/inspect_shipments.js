
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the root .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable() {
  console.log('Inspecting shipments table columns...');
  
  // We can't directly query information_schema via supabase-js easily without a raw query function if not enabled.
  // But we can try to select one row and see the keys, or rely on the error message we got earlier.
  // The error said: "Could not find the 'expected_delivery_date' column"
  // Let's try to select * limit 1 and print keys.
  
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching shipments:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Shipments columns:', Object.keys(data[0]));
  } else {
    console.log('No shipments found, cannot inspect columns from data.');
    // Try to insert a dummy record to trigger schema error or see what works?
    // No, better to trust the previous error or try to select specific columns I suspect exist.
    
    const columnsToCheck = [
      'estimated_delivery', 'estimated_delivery_date', 
      'actual_delivery', 'actual_delivery_date',
      'carrier_id', 'vendor_id'
    ];
    
    console.log('Checking specific columns existence by selecting them...');
    for (const col of columnsToCheck) {
        const { error: colError } = await supabase.from('shipments').select(col).limit(1);
        if (colError) {
            console.log(`❌ ${col}: ${colError.message}`);
        } else {
            console.log(`✅ ${col}: Exists`);
        }
    }
  }
}

inspectTable();

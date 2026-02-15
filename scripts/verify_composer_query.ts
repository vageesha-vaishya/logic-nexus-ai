
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyComposerQuery() {
  console.log('Verifying Composer Query logic and columns...');

  // Check columns existence by selecting them
  const columnsToCheck = [
    'id',
    'title',
    'description',
    'status',
    'service_type_id',
    'service_id',
    'incoterms',
    'shipping_term_id', 
    'incoterm_id',      
    'currency_id',      
    'carrier_id',
    'origin_port_id',
    'destination_port_id',
    'account_id',
    'contact_id',
    'opportunity_id',
    'valid_until',
    'ready_date',
    'pickup_date',      
    'delivery_deadline', 
    'vehicle_type',
    'special_handling',
    'tax_percent',
    'shipping_amount',
    'terms_conditions',
    'notes',
    'cargo_details'
  ];

  console.log(`Checking columns one by one...`);

  const missingColumns = [];
  const existingColumns = [];

  for (const col of columnsToCheck) {
      const { error } = await supabase.from('quotes').select(col).limit(1);
      if (error) {
          console.log(`❌ Missing: ${col} (${error.message})`);
          missingColumns.push(col);
      } else {
          console.log(`✅ Exists: ${col}`);
          existingColumns.push(col);
      }
  }

  console.log('\nSummary:');
  console.log('Existing:', existingColumns.join(', '));
  console.log('Missing:', missingColumns.join(', '));
}

verifyComposerQuery();

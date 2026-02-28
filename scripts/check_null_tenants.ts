
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY; // Use anon key for now, or service role if needed

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNullTenants() {
  console.log('Checking for quotes with NULL tenant_id...');

  // Check tenant_id
  const { data: tenantData, error: tenantError, count: tenantCount } = await supabase
    .from('quotes')
    .select('id, quote_number, title', { count: 'exact' })
    .is('tenant_id', null);

  if (tenantError) {
    console.error('Error fetching quotes (tenant):', tenantError);
  } else {
    console.log(`Found ${tenantCount} quotes with NULL tenant_id.`);
  }

  // Check franchise_id
  const { data: franchiseData, error: franchiseError, count: franchiseCount } = await supabase
    .from('quotes')
    .select('id, quote_number, title', { count: 'exact' })
    .is('franchise_id', null);

  if (franchiseError) {
    console.error('Error fetching quotes (franchise):', franchiseError);
  } else {
    console.log(`Found ${franchiseCount} quotes with NULL franchise_id.`);
    if (franchiseData && franchiseData.length > 0) {
        console.log('Sample NULL franchise quotes:', franchiseData.slice(0, 5));
    }
  }
}

checkNullTenants();

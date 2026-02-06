import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectShipmentsColumns() {
  console.log('Inspecting shipments table columns...');
  
  // Try to insert a dummy record with invalid column to trigger error listing columns? 
  // Or better, just select * limit 1
  const { data, error } = await supabase
    .from('shipments')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error fetching shipments:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Shipments columns:', Object.keys(data[0]).sort().join(', '));
  } else {
    console.log('No shipments found. Trying to get columns from error message by inserting garbage...');
    const { error: insertError } = await supabase.from('shipments').insert({ 'non_existent_column': 'value' });
    if (insertError) {
        console.log('Insert Error (might contain hints):', insertError.message);
    }
  }
}

inspectShipmentsColumns().catch(console.error);

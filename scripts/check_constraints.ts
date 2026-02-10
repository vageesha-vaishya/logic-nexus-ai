
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConstraints() {
  console.log('Checking quote_charges constraints...');
  
  // We can't query information_schema directly via Supabase JS client usually, unless we use rpc.
  // But we can try to insert a dummy charge with a random UUID and see the error message.
  
  try {
      const { error } = await supabase.from('quote_charges').insert({
          tenant_id: '00000000-0000-0000-0000-000000000000', // Invalid tenant but UUID
          quote_option_id: '00000000-0000-0000-0000-000000000000', // Random UUID
          charge_side_id: '00000000-0000-0000-0000-000000000000',
          category_id: '00000000-0000-0000-0000-000000000000',
          basis_id: '00000000-0000-0000-0000-000000000000',
          currency_id: '00000000-0000-0000-0000-000000000000',
          amount: 100
      });
      
      if (error) {
          console.log('Insert Error:', error.message);
          console.log('Details:', error.details);
      }
  } catch (e) {
      console.log('Exception:', e);
  }
}

checkConstraints();

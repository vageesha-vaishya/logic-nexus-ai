
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkForeignKeys() {
  console.log('Checking foreign keys for quote_charges table...');

  // Query to get foreign key information
  const { data, error } = await supabase.rpc('get_foreign_keys', {
    table_name: 'quote_charges'
  });

  if (error) {
      // Fallback if RPC doesn't exist (it might not)
      console.log('RPC get_foreign_keys failed, trying direct query on information_schema (if permissions allow) or just checking a known record join.');
      
      // Let's try to join manually to see if it works
      // We'll pick a leg ID from the previous output
      const legId = '0d28d37e-1166-46d7-97e0-bf735573e3ab'; 
      
      const { data: legData, error: legError } = await supabase
        .from('quotation_version_option_legs')
        .select(`
            id,
            quote_charges (
                *,
                charge_sides (code),
                charge_categories (name, code)
            )
        `)
        .eq('id', legId);
        
      if (legError) {
          console.error('Join query failed:', legError);
      } else {
          // console.log('Join query result:', JSON.stringify(legData, null, 2));
          if (legData && legData.length > 0) {
             const leg = legData[0];
             console.log('Leg ID:', leg.id);
             console.log('Charges count:', leg.quote_charges.length);
             if (leg.quote_charges.length > 0) {
                 const firstCharge = leg.quote_charges[0];
                 console.log('First Charge Sample:', JSON.stringify(firstCharge, null, 2));
                 console.log('Charge Side Code:', firstCharge.charge_sides?.code);
             }
          }
      }
      return;
  }

  console.log('Foreign keys:', data);
}

checkForeignKeys();

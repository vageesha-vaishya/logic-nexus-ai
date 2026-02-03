import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
// Using service role key if available for admin access, otherwise anon might be restricted by RLS
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTransition() {
  console.log('Verifying WCO Global HS Transition...');

  // 1. Check global_hs_roots count
  const { count: rootsCount, error: rootsError } = await supabase
    .from('global_hs_roots')
    .select('*', { count: 'exact', head: true });

  if (rootsError) {
    console.error('Error fetching global_hs_roots count:', rootsError);
  } else {
    console.log(`Total Global HS Roots (6-digit): ${rootsCount}`);
  }

  // 2. Check aes_hts_codes linking
  const { count: totalCodes, error: totalError } = await supabase
    .from('aes_hts_codes')
    .select('*', { count: 'exact', head: true });

  const { count: linkedCodes, error: linkedError } = await supabase
    .from('aes_hts_codes')
    .select('*', { count: 'exact', head: true })
    .not('global_hs_root_id', 'is', null);

  if (totalError || linkedError) {
    console.error('Error fetching aes_hts_codes stats:', totalError || linkedError);
  } else {
    console.log(`Total AES HTS Codes: ${totalCodes}`);
    console.log(`Linked AES HTS Codes: ${linkedCodes}`);
    
    if (totalCodes > 0 && linkedCodes === 0) {
      console.error('CRITICAL: No AES HTS Codes are linked to Global HS Roots!');
    } else if (linkedCodes < totalCodes) {
        console.warn(`WARNING: ${totalCodes - linkedCodes} AES HTS Codes are not linked.`);
    } else {
      console.log('SUCCESS: All AES HTS Codes are linked.');
    }
  }

  // 3. Sample Check
  const { data: sample, error: sampleError } = await supabase
    .from('aes_hts_codes')
    .select('hts_code, subheading, global_hs_root_id, global_hs_roots(hs6_code, description)')
    .limit(5);

  if (sampleError) {
    console.error('Error fetching sample:', sampleError);
  } else {
    console.log('\nSample Data:');
    sample.forEach(item => {
      console.log(`- AES: ${item.hts_code} (Sub: ${item.subheading}) -> Global Root: ${item.global_hs_roots?.hs6_code} (${item.global_hs_roots?.description?.substring(0, 30)}...)`);
    });
  }
}

verifyTransition().catch(console.error);

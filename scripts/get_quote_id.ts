
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function main() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Searching for quote: ${quoteNumber}`);

  const { data, error } = await supabase
    .from('quotes')
    .select('id, quote_number, tenant_id')
    .eq('quote_number', quoteNumber)
    .single();

  if (error) {
    console.error('Error fetching quote:', error);
    return;
  }

  console.log('Quote found:', data);
}

main();

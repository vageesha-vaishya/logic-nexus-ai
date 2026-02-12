
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  const quoteNumber = 'MGL-SYS-1770819021371'; 

  // 1. Get Quote details
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number, tenant_id, franchise_id')
    .eq('quote_number', quoteNumber)
    .maybeSingle();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
  } else if (quote) {
    console.log('Quote Found:');
    console.log(`- ID: ${quote.id}`);
    console.log(`- Number: ${quote.quote_number}`);
    console.log(`- Tenant ID: ${quote.tenant_id}`);
    console.log(`- Franchise ID: ${quote.franchise_id}`);
  } else {
    console.log('Quote not found.');
    return;
  }

  // 2. Get Franchises for Tenant001
  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2';
  const { data: franchises, error: franchiseError } = await supabase
    .from('franchises')
    .select('id, name')
    .eq('tenant_id', tenantId);

  if (franchiseError) {
    console.error('Error fetching franchises:', franchiseError);
  } else {
    console.log(`\nFranchises for Tenant001 (${franchises.length}):`);
    franchises.forEach(f => {
      console.log(`- ${f.name} (ID: ${f.id})`);
      if (quote && quote.franchise_id === f.id) {
        console.log('  *** QUOTE IS ASSIGNED TO THIS FRANCHISE ***');
      }
    });
  }
}

check();

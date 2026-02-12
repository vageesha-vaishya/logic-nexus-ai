import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const quoteNumber = 'MGL-SYS-1770819021371';

async function main() {
  console.log(`Searching for quote: ${quoteNumber}`);

  // Try finding by quote_number
  let { data: quote, error } = await supabase
    .from('quotes')
    .select('id, tenant_id, quote_number')
    .eq('quote_number', quoteNumber)
    .maybeSingle();

  if (error) {
     console.error('Error finding quote by quote_number:', error);
  }

  if (!quote) {
      console.log('Not found by exact match, trying ilike...');
      
      const { data: quotes, error: searchError } = await supabase
        .from('quotes')
        .select('id, tenant_id, quote_number')
        .ilike('quote_number', `%${quoteNumber}%`)
        .limit(1);
        
      if (searchError) {
          console.error('Error searching quote:', searchError);
      }
      
      if (quotes && quotes.length > 0) {
          quote = quotes[0];
      }
  }

  if (!quote) {
    console.log('Quote not found.');
    return;
  }

  console.log('Found Quote:', quote);

  if (quote.tenant_id) {
    console.log(`Tenant ID: ${quote.tenant_id}`);
    
    // Try tenants table
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', quote.tenant_id)
      .maybeSingle();

    if (tenantError) {
       console.error('Error fetching tenant from tenants table:', tenantError);
    }
    
    if (tenant) {
        console.log(`Tenant Name: ${tenant.name}`);
    } else {
        console.log('Tenant not found in tenants table.');
    }
  } else {
      console.log('Quote has no tenant_id.');
  }
}

main();

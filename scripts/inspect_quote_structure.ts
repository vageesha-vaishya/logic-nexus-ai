
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectQuote() {
  const quoteNumber = 'MGL-SYS-1770819021371';
  console.log(`Inspecting hierarchy for: ${quoteNumber}`);

  // 1. Get Quote
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('quote_number', quoteNumber)
    .single();

  if (quoteError || !quote) {
    console.error('Error finding quote:', quoteError);
    return;
  }
  console.log(`Quote ID: ${quote.id}, Tenant: ${quote.tenant_id}`);

  // 2. Get Items
  const { data: items, error: itemsError } = await supabase
    .from('quote_items_core')
    .select('*')
    .eq('quote_id', quote.id);
    
  console.log(`Items (quote_items_core): ${items?.length || 0}`);
  if (items?.length) console.log('Sample Item:', items[0]);

  // 3. Get Versions
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('*')
    .eq('quote_id', quote.id);
    
  console.log(`Versions: ${versions?.length || 0}`);
  
  if (versions && versions.length > 0) {
      for (const v of versions) {
          console.log(`\nVersion ${v.version_number} (${v.id}):`);
          
          // 4. Get Options
          const { data: options, error: optionsError } = await supabase
            .from('quotation_version_options')
            .select('*')
            .eq('quotation_version_id', v.id);
            
          console.log(`  Options: ${options?.length || 0}`);
          
          if (options && options.length > 0) {
              for (const o of options) {
                  console.log(`    Option ${o.id} (Carrier: ${o.carrier_id || 'N/A'}):`);
                  
                  // 5. Get Legs
                  const { data: legs, error: legsError } = await supabase
                    .from('quotation_version_option_legs')
                    .select('*')
                    .eq('quotation_version_option_id', o.id)
                    .order('sort_order');
                    
                  console.log(`      Legs: ${legs?.length || 0}`);
                  legs?.forEach(l => console.log(`        - [${l.mode}] ${l.origin_location_id} -> ${l.destination_location_id}`));
                  
                  // 6. Get Charges
                  const { data: charges, error: chargesError } = await supabase
                    .from('quote_charges')
                    .select('*')
                    .eq('quote_option_id', o.id);
                    
                  console.log(`      Charges: ${charges?.length || 0}`);
                  charges?.forEach(c => console.log(`        - ${c.description || 'Charge'} (Amount: ${c.amount})`));
              }
          }
      }
  }
}

inspectQuote();

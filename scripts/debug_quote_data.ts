
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

console.log('Supabase URL:', supabaseUrl);
console.log('Service Key:', supabaseServiceKey ? 'Found' : 'Missing');


if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function debugQuote() {
  // Get the most recent MGL-SYS quote
  const { data: quotes, error: quoteError } = await supabase
    .from('quotes')
    .select('id, quote_number')
    .ilike('quote_number', 'MGL-SYS-%')
    .order('created_at', { ascending: false })
    .limit(1);

  if (quoteError || !quotes || quotes.length === 0) {
    console.error('Quote not found', quoteError);
    return;
  }

  const quote = quotes[0];
  console.log(`Analyzing Quote: ${quote.quote_number} (${quote.id})`);

  // Check Quote Items
  const { data: items, error: itemsError } = await supabase
    .from('quote_items')
    .select(`
      *,
      container_sizes (id, code, name),
      container_types (id, code, name)
    `)
    .eq('quote_id', quote.id);

  if (itemsError) {
    console.error('Error fetching items:', itemsError);
  } else {
    console.log(`Found ${items.length} items:`);
    items.forEach((item, i) => {
      console.log(`  Item ${i + 1}: Size=${JSON.stringify(item.container_sizes)}, Type=${JSON.stringify(item.container_types)}`);
    });
  }

  // Check Options and Charges
  const { data: options, error: optionsError } = await supabase
    .from('quotation_version_options')
    .select('id, carrier_id')
    .eq('quote_version_id', (await getVersionId(quote.id)));

  if (optionsError) {
     console.error('Error fetching options', optionsError);
  } else if (options) {
      console.log(`Found ${options.length} options.`);
      for (const opt of options) {
          const { data: charges, error: chargesError } = await supabase
            .from('quotation_option_charges')
            .select('*')
            .eq('quote_option_id', opt.id);
          
          console.log(`  Option ${opt.id}: ${charges?.length} charges.`);
          if (charges && charges.length > 0) {
             console.log(`    First Charge: LegID=${charges[0].leg_id}, SideID=${charges[0].charge_side_id}`);
          }
      }
  }

  // Check Charge Sides
  const { data: sides } = await supabase.from('charge_sides').select('id, code, name');
  console.log('Charge Sides:', sides);
}

async function getVersionId(quoteId: string) {
    const { data } = await supabase.from('quotation_versions').select('id').eq('quote_id', quoteId).order('created_at', {ascending: false}).limit(1).single();
    return data?.id;
}

debugQuote();

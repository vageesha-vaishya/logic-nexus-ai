
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const quoteNumber = 'QUO-260303-00002';

async function debugQuoteData() {
  console.log(`Debugging data for quote: ${quoteNumber}`);

  // 1. Get Quote ID
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('id, current_version_id, tenant_id')
    .eq('quote_number', quoteNumber)
    .single();

  if (quoteError || !quote) {
    console.error('Error fetching quote:', quoteError);
    return;
  }

  console.log('Quote:', quote);

  // 2. List all versions
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('id, version_number, created_at, quote_id')
    .eq('quote_id', quote.id);

  if (versionsError) {
    console.error('Error fetching versions:', versionsError);
  } else {
    console.log('Versions linked to quote_id:', versions);
  }

  // 3. Check current version specifically
  if (quote.current_version_id) {
      const { data: currentVer, error: currentVerError } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('id', quote.current_version_id)
        .single();
      
      if (currentVerError) {
          console.log(`Current version ${quote.current_version_id} NOT found in quotation_versions table! Error:`, currentVerError);
      } else {
          console.log(`Current version record found:`, currentVer.id);
      }

      // Check options for this specific version ID
      const { data: options, error: optionsError } = await supabase
        .from('quotation_version_options')
        .select('*')
        .eq('quotation_version_id', quote.current_version_id);
      
      if (optionsError) {
          console.error('Error fetching options:', optionsError);
      } else {
          console.log(`- Options for current_version_id: ${options.length}`);
          options.forEach((opt, idx) => {
              console.log(`  Option ${idx+1} ID: ${opt.id}, CarrierRateID: ${opt.carrier_rate_id}`);
          });
          
          // Check legs and charges for the first option if exists
          if (options.length > 0) {
              const firstOpt = options[0];
              const { count: legsCount } = await supabase
                .from('quotation_version_option_legs')
                .select('*', { count: 'exact', head: true })
                .eq('quotation_version_option_id', firstOpt.id);
              console.log(`  - Legs for Option 1: ${legsCount}`);

              const { count: chargesCount } = await supabase
                .from('quote_charges')
                .select('*', { count: 'exact', head: true })
                .eq('quote_option_id', firstOpt.id);
              console.log(`  - Charges for Option 1: ${chargesCount}`);
              
              // Check sell side charges
               const { data: sides } = await supabase
                .from('charge_sides')
                .select('id, code, name');
               
               const sellSide = sides.find(s => s.code === 'sell' || s.name === 'Sell');
               if (sellSide) {
                   const { count: sellChargesCount } = await supabase
                    .from('quote_charges')
                    .select('*', { count: 'exact', head: true })
                    .eq('quote_option_id', firstOpt.id)
                    .eq('charge_side_id', sellSide.id);
                   console.log(`  - Sell-Side Charges for Option 1: ${sellChargesCount} (SideID: ${sellSide.id})`);
               } else {
                   console.log('  - Sell side not found!');
               }
          }
      }
      
      const { count: itemsCount } = await supabase
        .from('quote_line_items')
        .select('*', { count: 'exact', head: true })
        .eq('quote_version_id', quote.current_version_id);
      console.log(`- Items for current_version_id: ${itemsCount}`);
  }

  // 4. Check MGL specific tables
  console.log('\nChecking MGL Tables:');
  const { count: mglOptionsCount } = await supabase
    .from('rate_options')
    .select('*', { count: 'exact', head: true })
    .eq('quote_version_id', quote.current_version_id);
  console.log(`MGL Options for version ${quote.current_version_id}: ${mglOptionsCount}`);

}

debugQuoteData();

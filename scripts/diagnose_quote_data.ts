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

const quoteId = 'd95d398e-7b3a-4af3-b4a0-263744a1bd32';

async function main() {
  console.log(`Diagnosing quote: ${quoteId}`);

  // 1. Check Quote Level
  const { data: quote, error: quoteError } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single();

  if (quoteError) {
    console.error('Error fetching quote:', quoteError);
    return;
  }
  console.log('Quote Level Data:', {
      id: quote.id,
      quote_number: quote.quote_number,
      total_amount: quote.total_amount, // Assuming this field exists based on previous grep
      status: quote.status
  });

  // 2. Check Versions
  const { data: versions, error: versionsError } = await supabase
    .from('quotation_versions')
    .select('*')
    .eq('quote_id', quoteId)
    .order('created_at', { ascending: false });

  if (versionsError) {
    console.error('Error fetching versions:', versionsError);
    return;
  }
  
  console.log(`Found ${versions.length} versions.`);
  
  if (versions.length === 0) {
      console.log('No versions found.');
      return;
  }

  const latestVersion = versions[0];
  console.log('Latest Version:', {
      id: latestVersion.id,
      version_number: latestVersion.version_number,
      total_amount: latestVersion.total_amount // Assuming exists
  });

  // 3. Check Options for Latest Version
  const { data: options, error: optionsError } = await supabase
    .from('quotation_version_options')
    .select('*')
    .eq('quotation_version_id', latestVersion.id);

  if (optionsError) {
    console.error('Error fetching options:', optionsError);
    return;
  }

  console.log(`Found ${options.length} options.`);

  for (const option of options) {
      console.log(`Option ID: ${option.id}`, {
          total_amount: option.total_amount,
          margin_amount: option.margin_amount,
          tax_amount: option.tax_amount,
          shipping_amount: option.shipping_amount // Check if this exists
      });

      // 4. Check Legs for Option
      const { data: legs, error: legsError } = await supabase
        .from('quotation_version_option_legs')
        .select('*')
        .eq('quotation_version_option_id', option.id);

      if (legsError) {
          console.error(`Error fetching legs for option ${option.id}:`, legsError);
          continue;
      }

      console.log(`  Found ${legs.length} legs for option ${option.id}`);
      
      let calculatedOptionTotal = 0;

      for (const leg of legs) {
          console.log(`  Leg ID: ${leg.id}`, {
              cost_amount: leg.cost_amount,
              sell_amount: leg.sell_amount
          });

          // 5. Check Charges for Leg
          const { data: charges, error: chargesError } = await supabase
            .from('quotation_version_option_leg_charges') // Correct table name?
            .select('*')
            .eq('quotation_version_option_leg_id', leg.id);

          if (chargesError) {
              // Try 'quote_charges' if the above table doesn't exist or is empty
               const { data: qCharges, error: qChargesError } = await supabase
                .from('quote_charges')
                .select('*')
                .eq('leg_id', leg.id); // Assuming link via leg_id

               if (qChargesError) {
                   console.error(`  Error fetching charges for leg ${leg.id}:`, chargesError);
               } else {
                   console.log(`    Found ${qCharges.length} charges (via quote_charges) for leg ${leg.id}`);
                   qCharges.forEach(c => {
                       console.log(`      Charge: ${c.description || c.charge_code} - Amount: ${c.amount} (Sell: ${c.sell_price}, Cost: ${c.cost_price})`);
                   });
               }
          } else {
              console.log(`    Found ${charges.length} charges for leg ${leg.id}`);
              charges.forEach(c => {
                  console.log(`      Charge: ${c.description || c.charge_code} - Amount: ${c.amount}`);
                  calculatedOptionTotal += Number(c.amount || 0);
              });
          }
      }
      console.log(`  Calculated Total from Charges: ${calculatedOptionTotal}`);
  }
}

main();

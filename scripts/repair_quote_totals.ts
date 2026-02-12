
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase URL or Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function repairQuoteTotals() {
  console.log('Starting Quote Totals Repair...');

  // 1. Fetch options with 0 total
  const { data: options, error } = await supabase
    .from('quotation_version_options')
    .select(`
      id,
      quotation_version_id,
      total_amount,
      buy_subtotal,
      sell_subtotal,
      margin_amount,
      quotation_version_option_legs (
        id,
        quotation_version_option_leg_charges:quote_charges (
          id,
          amount,
          cost_amount,
          is_buy_charge,
          is_sell_charge
        )
      )
    `);

  if (error) {
    console.error('Error fetching options:', error);
    return;
  }

  console.log(`Found ${options?.length || 0} options to check.`);

  let updatedCount = 0;
  let errorCount = 0;

  for (const option of options || []) {
    const legs = option.quotation_version_option_legs || [];
    
    // Calculate totals from charges
    let calculatedSellTotal = 0;
    let calculatedBuyTotal = 0;

    legs.forEach((leg: any) => {
      const charges = leg.quotation_version_option_leg_charges || [];
      charges.forEach((charge: any) => {
        // Assuming 'amount' is sell price and 'cost_amount' is buy price
        calculatedSellTotal += Number(charge.amount) || 0;
        calculatedBuyTotal += Number(charge.cost_amount) || 0;
      });
    });

    // Check if update is needed
    // Update if total is 0 but calculated is > 0
    if (option.total_amount === 0 && calculatedSellTotal > 0) {
      console.log(`Fixing Option ${option.id}: Current Total=0, Calculated=${calculatedSellTotal}`);
      
      const margin = calculatedSellTotal - calculatedBuyTotal;
      
      const { error: updateError } = await supabase
        .from('quotation_version_options')
        .update({
          total_amount: calculatedSellTotal,
          sell_subtotal: calculatedSellTotal,
          buy_subtotal: calculatedBuyTotal,
          margin_amount: margin
        })
        .eq('id', option.id);

      if (updateError) {
        console.error(`Failed to update option ${option.id}:`, updateError);
        errorCount++;
      } else {
        updatedCount++;
      }
    }
  }

  console.log(`Repair Complete. Updated: ${updatedCount}, Errors: ${errorCount}`);
}

repairQuoteTotals();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
// Load environment variables
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Missing Supabase URL or Service Role Key');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function checkQuoteFinancials() {
  console.log('Starting E2E Quote Financials Check...');

  // 1. Fetch recent quotes (limit 50)
  const { data: quotes, error: quotesError } = await supabase
    .from('quotes')
    .select('id, quote_number, shipping_amount, tenant_id, title')
    .order('created_at', { ascending: false })
    .limit(50);

  if (quotesError) {
    console.error('Error fetching quotes:', quotesError);
    return;
  }

  console.log(`Checking ${quotes.length} recent quotes...`);
  
  const results = {
    total: quotes.length,
    missingVersion: 0,
    zeroTotalWithCharges: 0,
    zeroTotalNoCharges: 0,
    valid: 0,
    errors: [] as any[]
  };

  for (const quote of quotes) {
    // console.log(`Checking ${quote.quote_number} (${quote.id})...`);
    
    // 2. Fetch latest version
    const { data: versions, error: versionError } = await supabase
      .from('quotation_versions')
      .select(`
        id, 
        version_number, 
        quotation_version_options (
          id, 
          is_selected, 
          total_amount, 
          quotation_version_option_legs (
            id,
            quotation_version_option_leg_charges:quote_charges (
              id,
              amount
            )
          )
        )
      `)
      .eq('quote_id', quote.id)
      .order('version_number', { ascending: false })
      .limit(1);

    if (versionError) {
      console.error(`Error fetching version for ${quote.quote_number}:`, versionError);
      results.errors.push({ quote: quote.quote_number, error: versionError.message });
      continue;
    }

    if (!versions || versions.length === 0) {
      console.warn(`[WARNING] No version found for quote ${quote.quote_number}`);
      results.missingVersion++;
      continue;
    }

    const latestVersion = versions[0];
    const options = latestVersion.quotation_version_options || [];

    if (options.length === 0) {
      console.warn(`[WARNING] No options found for version ${latestVersion.version_number} of quote ${quote.quote_number}`);
      // Treat as missing data issue similar to missing version
      results.missingVersion++; 
      continue;
    }

    // Check primary option or first option
    const primaryOption = options.find((o: any) => o.is_selected) || options[0];
    
    // Calculate total from charges
    let calculatedTotal = 0;
    const legs = primaryOption.quotation_version_option_legs || [];
    
    for (const leg of legs) {
      const charges = leg.quotation_version_option_leg_charges || [];
      for (const charge of charges) {
        calculatedTotal += Number(charge.amount) || 0;
      }
    }

    const storedTotal = Number(primaryOption.total_amount) || 0;
    const quoteShippingAmount = Number(quote.shipping_amount) || 0;

    // console.log(`  Quote ${quote.quote_number}: Stored=${storedTotal}, Calc=${calculatedTotal}, QuoteShipping=${quoteShippingAmount}`);

    if (storedTotal === 0 && calculatedTotal > 0) {
      console.warn(`[ISSUE] Quote ${quote.quote_number}: Stored total is 0 but calculated charges are ${calculatedTotal}`);
      results.zeroTotalWithCharges++;
    } else if (storedTotal === 0 && calculatedTotal === 0) {
      // potentially valid if it's a draft with no charges yet
      results.zeroTotalNoCharges++;
    } else {
      results.valid++;
    }
  }

  console.log('\n--- Summary ---');
  console.log(`Total Checked: ${results.total}`);
  console.log(`Missing Versions/Options: ${results.missingVersion}`);
  console.log(`Zero Total but Has Charges (Fixable by hydration logic): ${results.zeroTotalWithCharges}`);
  console.log(`Zero Total & No Charges (Empty/Draft): ${results.zeroTotalNoCharges}`);
  console.log(`Valid (Non-zero total): ${results.valid}`);
}

checkQuoteFinancials().catch(console.error);

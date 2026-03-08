
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { load } from "https://deno.land/std@0.210.0/dotenv/mod.ts";

// Load environment variables from various possible locations
let env: Record<string, string> = {};
try {
  env = await load({ envPath: '.env', export: true });
} catch {
  try {
    env = await load({ envPath: '../../../../.env', export: true });
  } catch (e) {
    console.warn('Could not load .env file, relying on system env vars.');
  }
}

const supabaseUrl = Deno.env.get('SUPABASE_URL') || env['SUPABASE_URL'] || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || env['SUPABASE_SERVICE_ROLE_KEY'] || '';

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  Deno.exit(1);
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
    .from('quote_versions')
    .select('id, version_number, created_at')
    .eq('quote_id', quote.id);

  if (versionsError) {
    console.error('Error fetching versions:', versionsError);
  } else {
    console.log('Versions:', versions);
    
    // 3. Check data for each version
    for (const v of versions) {
      console.log(`\nChecking Version ${v.version_number} (${v.id}):`);
      
      // Options
      const { count: optionsCount } = await supabase
        .from('quote_options')
        .select('*', { count: 'exact', head: true })
        .eq('quote_version_id', v.id);
      console.log(`- Options: ${optionsCount}`);

      // Legs
      const { count: legsCount } = await supabase
        .from('quote_legs')
        .select('*', { count: 'exact', head: true })
        .eq('quote_version_id', v.id);
      console.log(`- Legs: ${legsCount}`);
      
       // Items
      const { count: itemsCount } = await supabase
        .from('quote_line_items')
        .select('*', { count: 'exact', head: true })
        .eq('quote_version_id', v.id);
      console.log(`- Items: ${itemsCount}`);
    }
  }

  // 4. Check charge_sides
  console.log('\nChecking Charge Sides:');
  const { data: sides, error: sidesError } = await supabase
    .from('charge_sides')
    .select('id, code, name');
    
  if (sidesError) {
    console.error('Error fetching sides:', sidesError);
  } else {
    console.log('Charge Sides:', sides);
    const sellSide = sides.find(s => s.code === 'sell' || s.name === 'Sell');
    if (!sellSide) {
        console.error("CRITICAL: 'sell' side not found!");
    } else {
        console.log("Found 'sell' side:", sellSide);
    }
  }

  // 5. Check if options are linked to quote_id directly (legacy check)
  const { count: optionsDirect } = await supabase
        .from('quote_options')
        .select('*', { count: 'exact', head: true })
        .eq('quote_id', quote.id); // Assuming quote_id column exists, if not it will error
  
  if (optionsDirect !== null) {
      console.log(`\nOptions linked directly to quote_id: ${optionsDirect}`);
  }
}

debugQuoteData();

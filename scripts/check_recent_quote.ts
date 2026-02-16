
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

// Use service role key to bypass RLS
const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function checkRecentQuote() {
    console.log('Fetching latest quotation version option...');
    
    // Get the most recent option created
    const { data: options, error: optError } = await supabase
        .from('quotation_version_options')
        .select('id, created_at, carrier_name, total_amount')
        .order('created_at', { ascending: false })
        .limit(1);

    if (optError) {
        console.error('Error fetching options:', optError);
        return;
    }

    if (!options || options.length === 0) {
        console.log('No options found.');
        return;
    }

    const option = options[0];
    console.log('Latest Option:', option);

    // Fetch charges for this option
    console.log(`Fetching charges for option ${option.id}...`);
    const { data: charges, error: chargeError } = await supabase
        .from('quote_charges')
        .select(`
            id,
            amount,
            currency_id,
            category_id,
                    charge_categories(name, code),
                    charge_side_id,
                    charge_sides(code),
                    leg_id
        `)
        .eq('quote_option_id', option.id);

    if (chargeError) {
        console.error('Error fetching charges:', chargeError);
    } else {
        console.log(`Found ${charges?.length} charges.`);
        console.log(JSON.stringify(charges, null, 2));
    }

    // Fetch legs for this option
    console.log(`Fetching legs for option ${option.id}...`);
    const { data: legs, error: legError } = await supabase
        .from('quotation_version_option_legs')
        .select('id, mode, sequence:sort_order')
        .eq('quotation_version_option_id', option.id)
        .order('sort_order');

    if (legError) {
        console.error('Error fetching legs:', legError);
    } else {
        console.log(`Found ${legs?.length} legs.`);
        console.log(JSON.stringify(legs, null, 2));
    }
}

checkRecentQuote();

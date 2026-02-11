
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local first, then .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log("URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking quotation_version_option_legs...");
    const { data: legs, error: legsError } = await supabase.from('quotation_version_option_legs').select('*').limit(1);
    if (legsError) console.error("Error fetching legs:", legsError);
    else if (legs.length > 0) console.log("Legs keys:", Object.keys(legs[0]));
    else console.log("Legs table empty, cannot infer keys.");

    console.log('\nChecking quotation_version_options...');
    const { data: options, error: optionsError } = await supabase.from('quotation_version_options').select('*').limit(1);
    if (optionsError) throw optionsError;
    if (options && options.length > 0) {
        console.log('Options keys:', Object.keys(options[0]));
    } else {
        console.log('Options table is empty or query failed.');
    }

    console.log("\nChecking quote_charges...");
    const { data: charges, error: chargesError } = await supabase.from('quote_charges').select('*').limit(1);
    if (chargesError) console.error("Error fetching charges:", chargesError);
    else if (charges.length > 0) console.log("Charges keys:", Object.keys(charges[0]));
    else console.log("Charges table empty, cannot infer keys.");
}

checkSchema();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Setup Environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/.env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyLatestQuote() {
    console.log("========================================================");
    console.log("   VERIFYING LATEST QUOTE DATA   ");
    console.log("========================================================");

    // 1. Get Latest Quote
    const { data: quotes, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1);

    if (quoteError || !quotes || quotes.length === 0) {
        console.error("❌ Failed to fetch latest quote:", quoteError?.message);
        return;
    }

    const quote = quotes[0];
    console.log(`✅ Latest Quote ID: ${quote.id} (${quote.quote_number})`);
    console.log(`   Service Type ID: ${quote.service_type_id}`);
    console.log(`   Service ID:      ${quote.service_id}`);
    console.log(`   Origin Port ID:  ${quote.origin_port_id}`);
    console.log(`   Dest Port ID:    ${quote.destination_port_id}`);

    if (!quote.service_type_id || !quote.service_id) {
        console.error("❌ MISSING Service Type or Service ID in Quote!");
    } else {
        // 2. Verify Mapping
        const { data: mapping, error: mapError } = await supabase
            .from('service_type_mappings')
            .select('*')
            .eq('service_type_id', quote.service_type_id)
            .eq('service_id', quote.service_id)
            .or(`tenant_id.eq.${quote.tenant_id},tenant_id.is.null`);

        if (mapError) {
            console.error("❌ Error checking mapping:", mapError.message);
        } else if (!mapping || mapping.length === 0) {
            console.error("❌ NO MAPPING found for this Service Pair!");
        } else {
            console.log(`✅ Service Mapping exists (Count: ${mapping.length})`);
            console.log(`   Mapping Tenant: ${mapping[0].tenant_id || 'Global (NULL)'}`);
        }
    }

    // 3. Verify Version
    if (!quote.current_version_id) {
        console.warn("⚠️ Quote has no current_version_id!");
    } else {
        console.log(`✅ Current Version ID: ${quote.current_version_id}`);
        
        // 4. Verify Options & Legs
        const { data: options } = await supabase
            .from('quote_options')
            .select('*, quote_option_legs(*)')
            .eq('quote_version_id', quote.current_version_id);

        console.log(`✅ Found ${options?.length || 0} Options`);
        options?.forEach((opt, idx) => {
            console.log(`   Option ${idx+1} Legs: ${opt.quote_option_legs?.length || 0}`);
        });
    }

    // 5. Verify Cargo
    const { count: cargoCount } = await supabase
        .from('quote_cargo_configurations')
        .select('*', { count: 'exact', head: true })
        .eq('quote_id', quote.id); // Note: Cargo is linked to quote, not version usually? Or is it? 
        // Based on schema, quote_cargo_configurations has quote_id.

    console.log(`✅ Cargo Configurations: ${cargoCount}`);
}

verifyLatestQuote();

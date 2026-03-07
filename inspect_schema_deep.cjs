
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);
const quoteId = "ab8dcb16-1597-4d1e-88ab-b558fd6abead";

async function main() {
    console.log("--- Inspecting Versions ---");
    const { data: versions, error: vError } = await client.from("quotation_versions")
        .select("*")
        .eq("quote_id", quoteId);
    
    if (vError) {
        console.log("Versions Error:", vError);
    } else {
        console.log(`Found ${versions.length} versions`);
        if (versions.length > 0) {
            console.log("First Version:", JSON.stringify(versions[0], null, 2));
        }
    }

    console.log("\n--- Searching for Item Tables ---");
    // We can't easily list tables via API unless we have a special function or permissions.
    // But we can try to guess common names or check known related tables.
    
    // Check if items are linked to versions or options
    const { data: options, error: oError } = await client.from("quotation_version_options")
        .select("*")
        .eq("quotation_version_id", versions[0]?.id);
        
    if (oError) {
        console.log("Options Error:", oError);
    } else {
        console.log(`Found ${options.length} options`);
        if (options.length > 0) {
            console.log("First Option:", JSON.stringify(options[0], null, 2));
            
            // Check if items are linked to options
            const { data: optItems, error: optItemsError } = await client.from("quote_option_items") // Guessing name
                .select("*")
                .eq("quote_option_id", options[0].id);
             
            if (optItemsError) console.log("quote_option_items Error:", optItemsError.message);
            else console.log("quote_option_items:", optItems);
        }
    }

    // Check if there is a table called 'commodities'
    const { data: commodities, error: commError } = await client.from("commodities")
        .select("*")
        .limit(1);
    if (commError) console.log("commodities table error:", commError.message);
    else console.log("commodities table exists");
}

main();

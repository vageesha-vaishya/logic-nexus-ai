
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const client = createClient(supabaseUrl, supabaseKey);

const quoteId = "ab8dcb16-1597-4d1e-88ab-b558fd6abead"; // QUO-260303-00002

async function main() {
    console.log("--- Inspecting Quote Data ---");
    const { data: quote, error: quoteError } = await client.from("quotes")
      .select("*")
      .eq("id", quoteId)
      .single();

    if (quoteError) {
        console.error("Quote Query Error:", quoteError);
        return;
    }

    console.log("Quote Fields related to Validity Date:");
    console.log("expiration_date:", quote.expiration_date);
    console.log("valid_until:", quote.valid_until);
    console.log("validity_date:", quote.validity_date);
    console.log("created_at:", quote.created_at);

    console.log("\n--- Inspecting Items Data ---");
    // Check various potential item tables
    const tables = ["quote_items", "shipment_items", "cargo_items"];
    
    for (const table of tables) {
        const { data: items, error: itemsError } = await client.from(table)
            .select("*")
            .eq("quote_id", quoteId);
        
        if (itemsError) {
             console.log(`Table '${table}': Error/Not Found (${itemsError.message})`);
        } else {
             console.log(`Table '${table}': Found ${items.length} items`);
             if (items.length > 0) {
                 console.log("First Item:", JSON.stringify(items[0], null, 2));
             }
        }
    }

    // Check containers table as well since items might be there
    const { data: containers, error: contError } = await client.from("containers")
        .select("*")
        .eq("quote_id", quoteId);
    
    if (contError) {
         console.log(`Table 'containers': Error/Not Found (${contError.message})`);
    } else {
         console.log(`Table 'containers': Found ${containers.length} items`);
         if (containers.length > 0) {
             console.log("First Container:", JSON.stringify(containers[0], null, 2));
         }
    }
}

main();

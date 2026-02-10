
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Environment Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function getQuoteDetails(identifier: string) {
    console.log(`Fetching details for Quote: ${identifier}`);

    // Determine if identifier is UUID or Quote Number
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const column = isUUID ? 'id' : 'quote_number';

    // 1. Fetch Quote Header
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select(`
            *,
            account:accounts(name, email)
        `)
        .eq(column, identifier)
        .single();

    if (quoteError || !quote) {
        console.error(`Error: Quote not found or DB error.`, quoteError?.message);
        return;
    }

    console.log("\n============================================================");
    console.log(`[QUOTE HEADER]`);
    console.log("============================================================");
    console.log(`ID:            ${quote.id}`);
    console.log(`Number:        ${quote.quote_number}`);
console.log(`Franchise ID:  ${quote.franchise_id}`);
console.log(`Status:        ${quote.status}`);
    console.log(`Customer:      ${quote.account?.name} (${quote.account?.email})`);
    console.log(`Created By:    ${quote.created_by}`); // User ID
    console.log(`Created At:    ${quote.created_at}`);
    console.log(`Valid Until:   ${quote.valid_until}`);
    // Helper to resolve port name
    const getPortName = async (id: string) => {
        if (!id || !/^[0-9a-f]{8}-/.test(id)) return id; // Not a UUID or empty
        const { data } = await supabase.from('ports_locations').select('location_name').eq('id', id).single();
        return data?.location_name || id;
    };

    const originName = await getPortName(quote.origin_port_id);
    const destName = await getPortName(quote.destination_port_id);

    console.log(`Route:         ${originName} -> ${destName}`);
    console.log(`Pickup:        ${quote.pickup_date || 'N/A'}`);
    console.log(`Delivery:      ${quote.delivery_deadline || 'N/A'}`);
    console.log(`Vehicle:       ${quote.vehicle_type || 'N/A'}`);
    console.log(`Handling:      ${Array.isArray(quote.special_handling) ? quote.special_handling.join(', ') : quote.special_handling || 'N/A'}`);
    console.log(`Total Amount:  ${quote.currency} ${quote.total_amount}`);

    // 2. Fetch Line Items
    const { data: items } = await supabase
        .from('quote_items')
        .select('*')
        .eq('quote_id', quote.id);

    console.log("\n------------------------------------------------------------");
    console.log(`[LINE ITEMS] (${items?.length || 0})`);
    console.log("------------------------------------------------------------");
    items?.forEach((item, index) => {
        console.log(`#${index + 1} [${item.package_type || item.type}] ${item.product_name}`);
        console.log(`    Qty: ${item.quantity} | Unit: $${item.unit_price} | Total: $${item.line_total}`);
        console.log(`    Details: ${item.weight_kg}kg | ${item.volume_cbm}cbm`);
    });

    // 3. Fetch Versions & Options & Legs
    const { data: versions } = await supabase
        .from('quotation_versions')
        .select('*')
        .eq('quote_id', quote.id)
        .order('version_number', { ascending: false });

    console.log("\n------------------------------------------------------------");
    console.log(`[VERSIONS & OPTIONS]`);
    console.log("------------------------------------------------------------");

    for (const ver of versions || []) {
        console.log(`\nVersion ${ver.version_number} (${ver.status}) - ID: ${ver.id}`);
        
        const { data: options } = await supabase
            .from('quotation_version_options')
            .select('*')
            .eq('quotation_version_id', ver.id);

        for (const opt of options || []) {
            console.log(`  > Option: ${opt.option_name || 'No Name'} | Cost: ${quote.currency} ${opt.total_amount}`);
            console.log(`    Transit: ${opt.transit_time} | Recommended: ${opt.recommended}`);
            
            const { data: legs } = await supabase
                .from('quotation_version_option_legs')
                .select('*')
                .eq('quotation_version_option_id', opt.id)
                .order('sort_order');

            if (legs && legs.length > 0) {
                console.log(`    Legs:`);
                legs.forEach(leg => {
                    const from = typeof leg.origin_location === 'string' ? leg.origin_location : JSON.stringify(leg.origin_location);
                    const to = typeof leg.destination_location === 'string' ? leg.destination_location : JSON.stringify(leg.destination_location);
                    console.log(`      [${leg.sort_order}] ${leg.mode} (${leg.leg_type}): ${from} -> ${to}`);
                });
            } else {
                console.log(`    Legs: (None)`);
            }
        }
    }
    console.log("\n============================================================");
}

// Get ID from command line arg
const QUOTE_ID = 'c8b3c854-cb61-41a6-909e-2b4d0d7807b0';
const idArg = process.argv[2] || QUOTE_ID;

if (!idArg) {
    console.log("Usage: npx tsx scripts/get_quote_details.ts <QUOTE_ID_OR_NUMBER>");
} else {
    getQuoteDetails(idArg);
}

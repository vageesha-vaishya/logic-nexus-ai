
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

const QUOTE_ID = 'c8b3c854-cb61-41a6-909e-2b4d0d7807b0';
const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a';

async function debugUiDataMismatch() {
    console.log("========================================================");
    console.log("   DEBUGGING UI DATA MISMATCH FOR QUOTE   ");
    console.log("========================================================");

    // 1. Fetch Quote Data
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', QUOTE_ID)
        .single();

    if (quoteError) {
        console.error("Failed to fetch quote:", quoteError.message);
        return;
    }

    console.log(`\n[QUOTE DATA]`);
    console.log(`  Tenant ID: ${quote.tenant_id}`);
    console.log(`  Service Type ID: ${quote.service_type_id}`);
    console.log(`  Service ID: ${quote.service_id}`);
    console.log(`  Origin Port ID: ${quote.origin_port_id}`);
    console.log(`  Dest Port ID: ${quote.destination_port_id}`);

    // 2. Check Service Type Mappings (How UI fetches Service Types)
    console.log(`\n[SERVICE TYPE MAPPINGS CHECK]`);
    // UI Logic: .from('service_type_mappings').select('*').eq('tenant_id', tenantId)
    // NOTE: UI logic might handle null tenant_id (global) too.
    
    const { data: mappings, error: mapError } = await supabase
        .from('service_type_mappings')
        .select('*')
        .or(`tenant_id.eq.${TENANT_ID},tenant_id.is.null`);

    if (mapError) {
        console.error("Failed to fetch mappings:", mapError.message);
    } else {
        console.log(`  Found ${mappings.length} mappings for tenant ${TENANT_ID} or global.`);
        
        const mappedServiceTypeIds = mappings.map(m => m.service_type_id);
        const mappedServiceIds = mappings.map(m => m.service_id);

        const serviceTypeFound = mappedServiceTypeIds.includes(quote.service_type_id);
        const serviceFound = mappedServiceIds.includes(quote.service_id);

        console.log(`  Service Type ID (${quote.service_type_id}) found in mappings? ${serviceTypeFound ? 'YES' : 'NO'}`);
        console.log(`  Service ID (${quote.service_id}) found in mappings? ${serviceFound ? 'YES' : 'NO'}`);
        
        if (!serviceTypeFound) {
             console.log("  WARN: The Service Type used in the quote is NOT mapped for this tenant! UI will not show it.");
        }
    }

    // 3. Check Ports (How UI fetches Ports)
    console.log(`\n[PORTS CHECK]`);
    // UI Logic: .from('ports_locations').select('id, name, location_name')... usually limit(100) or similar.
    // The UI `useQuoteRepository.ts` fetches ports. Let's see if the IDs exist in `ports_locations`.
    
    const { data: originPort } = await supabase.from('ports_locations').select('id, location_name').eq('id', quote.origin_port_id).single();
    const { data: destPort } = await supabase.from('ports_locations').select('id, location_name').eq('id', quote.destination_port_id).single();

    console.log(`  Origin Port (${quote.origin_port_id}): ${originPort ? 'FOUND (' + originPort.location_name + ')' : 'NOT FOUND'}`);
    console.log(`  Dest Port (${quote.destination_port_id}): ${destPort ? 'FOUND (' + destPort.location_name + ')' : 'NOT FOUND'}`);

    // Check if they are "active" if there's such a flag
    // (assuming simple existence for now)

}

debugUiDataMismatch();

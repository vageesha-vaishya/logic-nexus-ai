
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

const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a';

async function debugUiData() {
    console.log("========================================================");
    console.log("   DEBUG UI DATA & MAPPINGS   ");
    console.log("========================================================");

    // 1. Get Latest Quote
    const { data: quote, error: quoteError } = await supabase
        .from('quotes')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (quoteError) {
        console.error("Failed to fetch latest quote:", quoteError.message);
        return;
    }
    console.log(`\n[Latest Quote] ID: ${quote.id}`);
    console.log(`  Title: ${quote.title}`);
    console.log(`  Service Type ID: ${quote.service_type_id}`);
    console.log(`  Service ID: ${quote.service_id}`);
    console.log(`  Origin Port ID: ${quote.origin_port_id}`);
    console.log(`  Dest Port ID: ${quote.destination_port_id}`);

    // 2. Check Service Type Mappings (Without Join first)
    console.log(`\n[Service Mappings] Tenant: ${TENANT_ID}`);
    const { data: mappings, error: mapError } = await supabase
        .from('service_type_mappings')
        .select('service_type_id, service_id, is_default')
        .eq('tenant_id', TENANT_ID);

    if (mapError) console.error("  Error fetching mappings:", mapError.message);
    else {
        console.log(`  Found ${mappings.length} mappings.`);
        
        // Check for specific match
        const exactMatch = mappings.find(m => 
            m.service_type_id === quote.service_type_id && 
            m.service_id === quote.service_id
        );
        console.log(`  Exact Mapping Match (Type + Service): ${exactMatch ? 'YES' : 'NO'}`);
        
        if (!exactMatch) {
            console.warn("  [CRITICAL] The Quote's Service Type + Service combination is NOT in the tenant mappings!");
            console.log("  Quote Type:", quote.service_type_id);
            console.log("  Quote Service:", quote.service_id);
        }
    }

    // 3. Inspect the Service Entity itself
    if (quote.service_id) {
        const { data: svc } = await supabase.from('services').select('*').eq('id', quote.service_id).single();
        console.log(`\n[Service Entity] ID: ${quote.service_id}`);
        if (svc) {
            console.log(`  Name: ${svc.service_name}`);
            console.log(`  Service Type ID (on table): ${svc.service_type_id}`);
            console.log(`  Matches Quote Type ID? ${svc.service_type_id === quote.service_type_id ? 'YES' : 'NO'}`);
            if (svc.service_type_id !== quote.service_type_id) {
                  console.warn(`  [MISMATCH] Service table says type is ${svc.service_type_id}, but Quote says ${quote.service_type_id}`);
                  
                  // Check the other service type
                  const { data: st2 } = await supabase.from('service_types').select('*').eq('id', svc.service_type_id).single();
                  console.log(`  [INFO] Service's Native Type (${svc.service_type_id}) Name: ${st2?.name}`);
             }
        } else {
            console.error("  Service not found in DB!");
        }
    }
    
    // 4. Inspect Service Type Entity
    if (quote.service_type_id) {
         const { data: st } = await supabase.from('service_types').select('*').eq('id', quote.service_type_id).single();
         console.log(`\n[Service Type Entity] ID: ${quote.service_type_id}`);
         console.log(`  Name: ${st?.name}`);
    }

    // 5. Check Ports
    console.log(`\n[Ports Verification]`);
    if (quote.origin_port_id) {
        const { data: p1 } = await supabase.from('ports_locations').select('location_name').eq('id', quote.origin_port_id).single();
        console.log(`  Origin: ${quote.origin_port_id} -> ${p1 ? p1.location_name : 'NOT FOUND'}`);
    } else {
        console.log("  Origin: NULL");
    }

    if (quote.destination_port_id) {
        const { data: p2 } = await supabase.from('ports_locations').select('location_name').eq('id', quote.destination_port_id).single();
        console.log(`  Dest:   ${quote.destination_port_id} -> ${p2 ? p2.location_name : 'NOT FOUND'}`);
    } else {
        console.log("  Dest:   NULL");
    }

}

debugUiData();


import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import { fileURLToPath } from 'url';
import * as path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// HARDCODED ID from previous context (the quote we are working on)
const QUOTE_ID = 'c8b3c854-cb61-41a6-909e-2b4d0d7807b0'; 
const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a'; 

async function debugFrontendLogic() {
    console.log("========================================================\n   DEBUGGING FRONTEND LOGIC SIMULATION   \n========================================================");

    // 1. Simulate Service Mappings Query
    console.log(`\n[1] Fetching Service Mappings for Tenant: ${TENANT_ID}`);
    
    let query = supabase
        .from('service_type_mappings')
        .select('service_type_id, service_id, is_default, priority, tenant_id')
        .eq('is_active', true)
        .order('priority', { ascending: false });

    // Simulate the OR logic I added
    query = query.or(`tenant_id.eq.${TENANT_ID},tenant_id.is.null`);

    const { data: mappings, error: mapError } = await query;

    if (mapError) {
        console.error("❌ Error fetching mappings:", mapError);
        return;
    }

    console.log(`✅ Found ${mappings?.length} mappings.`);
    if (mappings?.length === 0) {
        console.warn("⚠️ NO MAPPINGS FOUND! This is why the dropdown is empty.");
        // continue to check ports
    } else {
        // Print unique Service Type IDs found
        const uniqueTypeIds = [...new Set(mappings?.map(m => m.service_type_id).filter(Boolean))];
        console.log(`   Unique Service Type IDs in mappings:`, uniqueTypeIds);

        // 2. Simulate Service Types Query
        console.log(`\n[2] Fetching Service Types for IDs:`, uniqueTypeIds);
        if (uniqueTypeIds.length > 0) {
            const { data: types, error: typesError } = await supabase
                .from('service_types')
                .select('id, name, code')
                .in('id', uniqueTypeIds);
            
            if (typesError) {
                console.error("❌ Error fetching service types:", typesError);
            } else {
                console.log(`✅ Found ${types?.length} Service Types.`);
                types?.forEach(t => console.log(`   - ${t.name} (${t.code}) [${t.id}]`));
            }
        } else {
            console.warn("⚠️ No Service Type IDs to fetch.");
        }

        // 3. Simulate Services Query
        const serviceIds = [...new Set(mappings?.map(m => m.service_id).filter(Boolean))];
        console.log(`\n[3] Fetching Services for IDs:`, serviceIds);
        
        if (serviceIds.length > 0) {
            const { data: services, error: servicesError } = await supabase
                .from('services')
                .select('id, service_name, is_active')
                .in('id', serviceIds)
                .eq('is_active', true);

            if (servicesError) {
                console.error("❌ Error fetching services:", servicesError);
            } else {
                console.log(`✅ Found ${services?.length} Services.`);
                services?.forEach(s => console.log(`   - ${s.service_name} [${s.id}]`));
            }
        }
    }

    // 5. Check Service Types Visibility directly
    console.log(`\n[5] Checking Service Types Visibility (Direct Fetch)`);
    const { data: allTypes, error: allTypesError } = await supabase
        .from('service_types')
        .select('id, name, code')
        .limit(10);

    if (allTypesError) {
        console.error("❌ Error fetching ALL service types:", allTypesError);
    } else {
        console.log(`✅ Found ${allTypes?.length} Service Types (Direct).`);
        allTypes?.forEach(t => console.log(`   - ${t.name} (${t.code}) [${t.id}]`));
    }

    // 6. Check Services Visibility directly
    console.log(`\n[6] Checking Services Visibility (Direct Fetch)`);
    const { data: allServices, error: allServicesError } = await supabase
        .from('services')
        .select('id, service_name')
        .eq('is_active', true)
        .limit(10);

    if (allServicesError) {
        console.error("❌ Error fetching ALL services:", allServicesError);
    } else {
        console.log(`✅ Found ${allServices?.length} Services (Direct).`);
        allServices?.forEach(s => console.log(`   - ${s.service_name} [${s.id}]`));
    }
}

debugFrontendLogic();


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

async function fixQuoteData() {
    console.log("========================================================");
    console.log("   FIXING QUOTE DATA & MAPPINGS   ");
    console.log("========================================================");

    // 1. Fetch Ocean Service Type
    const { data: oceanType, error: typeError } = await supabase
        .from('service_types')
        .select('*')
        .ilike('name', '%Ocean%')
        .limit(1)
        .single();

    if (typeError || !oceanType) {
        console.error("Failed to find Ocean service type:", typeError?.message);
        return;
    }
    console.log(`> Found Service Type: ${oceanType.name} (${oceanType.id})`);

    // 2. Fetch an Ocean Service
    const { data: oceanService, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single(); // Just pick the first active service for now, assuming it's generic enough or we'll map it.
    
    // Better: Find a service that matches the type? 
    // Services table usually doesn't have type_id directly, it's via mappings. 
    // But let's just pick one.
    if (serviceError || !oceanService) {
        console.error("Failed to find any active Service:", serviceError?.message);
        return;
    }
    console.log(`> Found Service: ${oceanService.service_name} (${oceanService.id})`);

    // 3. Ensure Mapping Exists
    const { data: existingMapping } = await supabase
        .from('service_type_mappings')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('service_type_id', oceanType.id)
        .eq('service_id', oceanService.id);

    if (!existingMapping || existingMapping.length === 0) {
        console.log(`> Creating Service Mapping for Tenant ${TENANT_ID}...`);
        const { error: insertError } = await supabase
            .from('service_type_mappings')
            .insert({
                tenant_id: TENANT_ID,
                service_type_id: oceanType.id,
                service_id: oceanService.id,
                is_active: true,
                is_default: true,
                priority: 10
            });
        
        if (insertError) {
            console.error("Failed to insert mapping:", insertError.message);
            return;
        }
        console.log("  Success: Mapping created.");
    } else {
        console.log("  Mapping already exists.");
    }

    // 4. Update Quote with IDs
    console.log(`> Updating Quote ${QUOTE_ID}...`);
    const { error: updateError } = await supabase
        .from('quotes')
        .update({
            service_type_id: oceanType.id,
            service_id: oceanService.id
        })
        .eq('id', QUOTE_ID);

    if (updateError) {
        console.error("Failed to update quote:", updateError.message);
    } else {
        console.log("  Success: Quote updated with Service Type and Service ID.");
    }

    console.log("\nDone.");
}

fixQuoteData();

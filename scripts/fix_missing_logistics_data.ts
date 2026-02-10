
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

// USE SERVICE ROLE KEY TO BYPASS RLS
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// TARGET TENANT (from previous context)
const TENANT_ID = 'bb451198-2877-4345-a578-d404c5720f1a'; 
const QUOTE_ID = 'c8b3c854-cb61-41a6-909e-2b4d0d7807b0';

async function fixLogisticsData() {
    console.log("========================================================\n   FIXING LOGISTICS DATA (BYPASSING RLS)   \n========================================================");

    // 1. Get Ocean Service Type
    const { data: oceanType, error: typeError } = await supabase
        .from('service_types')
        .select('*')
        .ilike('name', '%Ocean%')
        .limit(1)
        .single();

    if (typeError || !oceanType) {
        console.error("❌ Failed to find Ocean service type:", typeError);
        return;
    }
    console.log(`✅ Found Service Type: ${oceanType.name} (${oceanType.id})`);

    // 2. Check for Tenant-Specific Service
    console.log(`\nChecking for 'Ocean Freight' service for tenant ${TENANT_ID}...`);
    const { data: existingService, error: serviceError } = await supabase
        .from('services')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .ilike('service_name', '%Ocean Freight%')
        .limit(1)
        .single();

    let serviceId;

    if (existingService) {
        console.log(`✅ Found existing tenant service: ${existingService.service_name} (${existingService.id})`);
        serviceId = existingService.id;
    } else {
        console.log("⚠️ No tenant service found. Searching for Global Service to clone...");
        
        // Find Global Service
        const { data: globalService } = await supabase
            .from('services')
            .select('*')
            .is('tenant_id', null)
            .ilike('service_name', '%Ocean Freight%')
            .limit(1)
            .single();

        let newServiceData = {
            tenant_id: TENANT_ID,
            service_name: 'Ocean Freight (Tenant)',
            service_type_id: oceanType.id,
            service_type: 'ocean', // Required text field
            is_active: true,
            service_code: 'OCN-FRT-T',
            description: 'Cloned Ocean Freight Service'
        };

        if (globalService) {
            console.log(`   Found Global Service: ${globalService.service_name}. Cloning...`);
            newServiceData = {
                ...globalService,
                id: undefined, // New ID
                tenant_id: TENANT_ID,
                service_name: globalService.service_name,
                created_at: undefined,
                updated_at: undefined
            };
        } else {
            console.log(`   No Global Service found. Creating new default...`);
        }

        const { data: newService, error: createError } = await supabase
            .from('services')
            .insert(newServiceData)
            .select()
            .single();

        if (createError) {
            console.error("❌ Failed to create service:", createError);
            return;
        }
        console.log(`✅ Created new Tenant Service: ${newService.service_name} (${newService.id})`);
        serviceId = newService.id;
    }

    // 3. Ensure Mapping Exists
    console.log(`\nChecking Service Mapping...`);
    const { data: mapping, error: mapError } = await supabase
        .from('service_type_mappings')
        .select('*')
        .eq('tenant_id', TENANT_ID)
        .eq('service_type_id', oceanType.id)
        .eq('service_id', serviceId)
        .single();

    if (!mapping) {
        console.log(`   Creating mapping...`);
        const { error: insertMapError } = await supabase
            .from('service_type_mappings')
            .insert({
                tenant_id: TENANT_ID,
                service_type_id: oceanType.id,
                service_id: serviceId,
                is_active: true,
                is_default: true,
                priority: 100
            });
        
        if (insertMapError) {
            console.error("❌ Failed to create mapping:", insertMapError);
        } else {
            console.log(`✅ Mapping created.`);
        }
    } else {
        console.log(`✅ Mapping already exists.`);
    }

    // 4. Update Quote
    console.log(`\nUpdating Quote ${QUOTE_ID}...`);
    const { error: updateQuoteError } = await supabase
        .from('quotes')
        .update({
            service_type_id: oceanType.id,
            service_id: serviceId
        })
        .eq('id', QUOTE_ID);

    if (updateQuoteError) {
        console.error("❌ Failed to update quote:", updateQuoteError);
    } else {
        console.log(`✅ Quote updated with valid Service Type and Service.`);
    }
}

fixLogisticsData();

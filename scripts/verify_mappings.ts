
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyMappings() {
    const tenantId = 'bb451198-2877-4345-a578-d404c5720f1a';
    
    // 1. Get the latest quote to see what service ID was used
    const { data: quotes } = await supabase
        .from('quotes')
        .select('id, quote_number, service_type_id, service_id, tenant_id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!quotes || quotes.length === 0) {
        console.log("No quotes found.");
        return;
    }

    const quote = quotes[0];
    console.log("Latest Quote:", quote);

    if (!quote.service_id) {
        console.log("Quote has no service_id.");
        return;
    }

    // 2. Check service_type_mappings for this service_id
    console.log(`Checking mappings for Service ID: ${quote.service_id}`);
    
    const { data: mappings, error } = await supabase
        .from('service_type_mappings')
        .select('*')
        .eq('service_id', quote.service_id);

    if (error) {
        console.error("Error fetching mappings:", error);
        return;
    }

    console.log("Found mappings:", mappings);

    // 3. Check if any mapping applies to the tenant (or is global)
    const validMapping = mappings?.find(m => m.tenant_id === tenantId || m.tenant_id === null);
    
    if (validMapping) {
        console.log("✅ Valid mapping exists for this tenant/global:", validMapping);
    } else {
        console.log("❌ NO valid mapping found for this tenant!");
        console.log("   The frontend will NOT show this service in the dropdown.");
    }

    // 4. Check if service_type exists
    if (quote.service_type_id) {
        const { data: st } = await supabase.from('service_types').select('*').eq('id', quote.service_type_id).single();
        console.log("Service Type:", st);
    }
}

verifyMappings();

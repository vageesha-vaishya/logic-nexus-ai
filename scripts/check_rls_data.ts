
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

const adminClient = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
    const userId = '52811a3b-5baf-4c5f-854b-7ced632e3a74'; // The user used in test data
    const tenantId = 'bb451198-2877-4345-a578-d404c5720f1a';

    console.log(`Simulating access for User: ${userId} (Tenant: ${tenantId})`);

    // 1. Check Users table existence
    console.log("\n--- Checking Users Table ---");
    const { data: users, error: userError } = await adminClient.from('users').select('count', { count: 'exact', head: true });
    if (userError) {
        console.log(`❌ Error accessing 'users' table: ${userError.message}`);
    } else {
        console.log(`✅ 'users' table exists. Count: ${users?.length ?? 'Unknown'}`); // head: true returns null data but count in count property? No, head returns null data.
    }
    
    // Check if profiles table exists
    const { data: profiles, error: profileError } = await adminClient.from('profiles').select('*').limit(1);
     if (profileError) {
        console.log(`❌ Error accessing 'profiles' table: ${profileError.message}`);
    } else {
        console.log(`✅ 'profiles' table exists. Sample:`, profiles[0]);
    }


    // 2. Check Ports RLS
    console.log("\n--- Checking Ports Locations ---");
    // Try to fetch ports as admin first
    const { data: allPorts, error: adminError } = await adminClient.from('ports_locations').select('*').limit(5);
    console.log(`Ports (Admin, limit 5): ${allPorts?.length ?? 0} (Error: ${adminError?.message || 'None'})`);

    // 3. Check Service Type Mappings
    console.log("\n--- Checking Service Type Mappings ---");
    const { data: mappings, error: mapError } = await adminClient
        .from('service_type_mappings')
        .select('*')
        .eq('tenant_id', tenantId);
    
    console.log(`Mappings for Tenant ${tenantId}: ${mappings?.length}`);
    if (mappings && mappings.length > 0) {
        console.log("Sample Mapping:", mappings[0]);
    }
}

checkRLS();

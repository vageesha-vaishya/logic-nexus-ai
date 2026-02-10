
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Error: Missing env vars");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectPolicies() {
    // We can't query pg_catalog directly via JS client usually, unless we have a function.
    // Let's try to list policies using a known RPC or just try to infer from behavior.
    
    // Actually, we can just try to SELECT from the table using an ANON key (simulating public) 
    // or create a dummy user and sign in (hard).
    
    // Let's assume we can use the `get_policies` RPC if it exists, or just check if RLS is enabled.
    
    console.log("Checking RLS status...");
    
    const tables = ['ports_locations', 'service_type_mappings', 'services'];
    
    for (const table of tables) {
        // Check if we can read as ANON (public)
        const anonClient = createClient(supabaseUrl, process.env.VITE_SUPABASE_ANON_KEY!);
        const { data, error } = await anonClient.from(table).select('count', { count: 'exact', head: true });
        
        console.log(`Table: ${table}`);
        console.log(`  Public Access (Anon): ${error ? 'Error: ' + error.message : 'OK (Count: ' + (data as any)?.length + ')'}`); // Head returns null data but count in response wrapper
        
        // Note: count is in the response object, not data.
        // But if error is null, it means we have access.
    }
}

inspectPolicies();

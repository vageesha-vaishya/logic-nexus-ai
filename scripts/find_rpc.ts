
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

async function listRPCs() {
    // We can't query information_schema directly via PostgREST usually, unless exposed.
    // But we can try to call common names.
    const commonNames = ['exec', 'execute', 'run_sql', 'exec_sql', 'query', 'admin_exec'];
    
    for (const name of commonNames) {
        const { error } = await supabase.rpc(name, { sql: 'SELECT 1' });
        if (error && error.message.includes('does not exist')) {
            console.log(`RPC '${name}' does not exist.`);
        } else if (error) {
             console.log(`RPC '${name}' exists but failed:`, error.message);
        } else {
             console.log(`RPC '${name}' EXISTS and works!`);
        }
    }
}

listRPCs();

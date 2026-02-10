
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

async function inspect() {
    const { data, error } = await supabase
        .from('information_schema.columns') // access view directly via RPC or just query? Supabase client might not allow querying system tables directly with .from() unless exposed.
        // Actually, .from() works on views if user has permissions. Service role should have.
        // But usually we use rpc.
        // Let's try .from first.
        .select('column_name, data_type, udt_name')
        .eq('table_name', 'quotes')
        .eq('table_schema', 'public');

    if (error) {
        // Fallback: try to select one row and check types via typeof (limited)
        console.error("Error querying information_schema:", error);
        return;
    }

    console.log("Quotes Table Columns:");
    data.forEach(col => {
        if (['pickup_date', 'delivery_deadline', 'vehicle_type', 'special_handling', 'origin_location', 'destination_location', 'billing_address', 'shipping_address'].includes(col.column_name)) {
             console.log(`${col.column_name}: ${col.data_type} (${col.udt_name})`);
        }
    });
}

inspect();

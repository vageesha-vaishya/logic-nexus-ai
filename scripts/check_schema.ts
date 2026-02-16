
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function checkSchema() {
    console.log('Checking quote_charges columns...');
    
    // There is no direct way to query schema via JS client unless we use rpc or just try to select * and look at keys
    // But selecting * from an empty table won't help.
    // We can try to select one row.
    
    const { data, error } = await supabase
        .from('quote_charges')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error:', error);
        return;
    }

    if (data && data.length > 0) {
        console.log('Columns:', Object.keys(data[0]));
    } else {
        console.log('Table is empty. Cannot infer columns from data.');
        // If table is empty, we can't easily see columns without a schema query helper or assuming standard names.
        // However, I can try to insert a dummy row with a known column and see if it fails, but that's risky.
        // Better: I will try to select common column names and see which one doesn't error.
        
        const candidates = ['side_id', 'charge_side_id', 'charge_side', 'side'];
        for (const col of candidates) {
            const { error: colError } = await supabase.from('quote_charges').select(col).limit(1);
            if (!colError) {
                console.log(`Column '${col}' EXISTS.`);
            } else {
                console.log(`Column '${col}' does NOT exist (or error: ${colError.message})`);
            }
        }
    }
}

checkSchema();

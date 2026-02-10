
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
    // Insert a dummy leg to see error or just check columns if possible (not easy with JS client without inserting)
    // We'll try to select from it and see the error or empty list
    const { data, error } = await supabase.from('quote_legs').select('*').limit(1);
    if (error) {
        console.error("Error selecting quote_legs:", error);
    } else {
        console.log("Success selecting quote_legs. Sample:", data);
        // If data is empty, we can't see keys.
        // Let's try to insert a dummy row with a bad column to provoke a schema error listing columns? No, that's messy.
    }
}

inspect();

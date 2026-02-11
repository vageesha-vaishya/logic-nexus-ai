
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function search() {
    const { data: locs } = await supabase
        .from('ports_locations')
        .select('location_name')
        .or('location_name.ilike.%Chicago%,location_name.ilike.%New York%')
        .limit(20);
        
    console.log("Found locations:", locs?.map(l => l.location_name));
}

search();

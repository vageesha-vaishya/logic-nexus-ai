
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
const envPath = path.resolve(process.cwd(), '.env');
dotenv.config({ path: envPath });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLocations() {
    const names = [
        'Port of Seattle',
        'Seattle Rail Terminal',
        'Chicago Rail Ramp',
        'New York Port'
    ];
    
    console.log("Checking locations:", names);
    
    const { data: locs, error } = await supabase
        .from('ports_locations')
        .select('id, location_name')
        .in('location_name', names);
        
    if (error) {
        console.error("Error fetching locations:", error);
        return;
    }
    
    console.log(`Found ${locs?.length} locations:`);
    locs?.forEach(l => console.log(`- ${l.location_name} (${l.id})`));
    
    const foundNames = locs?.map(l => l.location_name) || [];
    const missing = names.filter(n => !foundNames.includes(n));
    
    if (missing.length > 0) {
        console.warn("MISSING LOCATIONS:", missing);
    } else {
        console.log("All locations found.");
    }
}

checkLocations();

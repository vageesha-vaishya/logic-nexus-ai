
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

// Use service role key if available to bypass RLS for verification
const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function checkMasterData() {
    console.log('Checking charge_categories...');
    const { data: categories, error: catError } = await supabase
        .from('charge_categories')
        .select('id, code, name')
        .limit(10);

    if (catError) {
        console.error('Error fetching categories:', catError);
    } else {
        console.log(`Found ${categories?.length} categories.`);
        if (categories && categories.length > 0) {
            console.log('Sample categories:', categories);
        } else {
            console.log('WARNING: charge_categories table is empty!');
        }
    }

    console.log('Checking charge_sides...');
    const { data: sides, error: sideError } = await supabase
        .from('charge_sides')
        .select('id, code, name')
        .limit(10);

    if (sideError) {
        console.error('Error fetching sides:', sideError);
    } else {
        console.log(`Found ${sides?.length} sides.`);
        console.log('Sample sides:', sides);
    }
}

checkMasterData();

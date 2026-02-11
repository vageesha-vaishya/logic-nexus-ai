
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
const envLocalPath = path.resolve(process.cwd(), '.env.local');
const envPath = path.resolve(process.cwd(), '.env');

if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath });
else dotenv.config({ path: envPath });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkQuotesSchema() {
    // We can just select one row to see keys, or query information_schema if possible (RLS might block info schema but service role should work)
    const { data, error } = await supabase.from('quotes').select('*').limit(1);
    
    if (error) {
        console.error('Error fetching quotes:', error);
        return;
    }
    
    if (data && data.length > 0) {
        console.log('Quotes Table Columns:', Object.keys(data[0]));
        console.log('Has "header"?', Object.keys(data[0]).includes('header'));
    } else {
        // If empty, try inserting a dummy to fail or use RPC if available. 
        // Or just assume if it returns data structure.
        console.log('No quotes found, but query worked.');
        // If data is empty array, we can't see keys. 
        // Let's try to infer from an error by selecting 'header' specifically.
        const { error: colError } = await supabase.from('quotes').select('header').limit(1);
        if (colError) {
             console.log('Selecting "header" failed:', colError.message);
        } else {
             console.log('"header" column exists.');
        }
    }
}

checkQuotesSchema();


import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath });
} else {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    console.log('Debugging Charges...');

    // 1. Get latest MGL-SYS quote
    const { data: quotes, error: qError } = await supabase
        .from('quotes')
        .select('id, quote_number')
        .ilike('quote_number', 'MGL-SYS-%')
        .order('created_at', { ascending: false })
        .limit(1);

    if (qError) {
        console.error('Error fetching quotes:', qError);
        return;
    }

    if (!quotes || quotes.length === 0) {
        console.log('No MGL-SYS quotes found.');
        return;
    }

    const quote = quotes[0];
    console.log(`Analyzing Quote: ${quote.quote_number} (${quote.id})`);

    // 2. Get Version
    const { data: versions } = await supabase
        .from('quotation_versions')
        .select('id')
        .eq('quote_id', quote.id)
        .order('created_at', { ascending: false })
        .limit(1);
    
    const versionId = versions?.[0]?.id;
    console.log(`Version ID: ${versionId}`);

    // 3. Get Options
    const { data: options } = await supabase
        .from('quotation_version_options')
        .select('id, carrier_id')
        .eq('quotation_version_id', versionId);
    
    console.log(`Found ${options?.length} options.`);

    // 4. Get Legs and Charges for first option
    if (options && options.length > 0) {
        const opt = options[0];
        console.log(`Inspecting Option: ${opt.id}`);

        const { data: legs } = await supabase
            .from('quotation_version_option_legs')
            .select('*')
            .eq('quotation_version_option_id', opt.id);
        
        console.log(`Legs (${legs?.length}):`);
        legs?.forEach(l => console.log(` - ID: ${l.id}, Mode: ${l.mode}, Sort: ${l.sort_order}`));

        const { data: charges, error: chargesError } = await supabase
            .from('quote_charges')
            .select('*, category:charge_categories(name)')
            .eq('quote_option_id', opt.id);
        
        if (chargesError) {
            console.error("Error fetching charges with category:", chargesError);
        } else {
            console.log(`Charges (${charges?.length}):`);
            charges?.forEach(c => {
                console.log(` - Note: ${c.note}, Amount: ${c.amount}, Category: ${c.category?.name}`);
            });
        }

        // 5. Check Sell Side ID
        const { data: sides } = await supabase.from('charge_sides').select('id, code, name');
        const sellSide = sides?.find(s => s.code === 'sell' || s.name === 'Sell');
        console.log(`System Sell Side ID: ${sellSide?.id}`);

        // Compare
        const matchingCharges = charges?.filter(c => c.charge_side_id === sellSide?.id);
        console.log(`Charges matching Sell Side ID: ${matchingCharges?.length}`);
    }
}

run();

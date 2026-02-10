
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

async function inspectMasterData() {
    console.log("Checking master data tables...");
    
    const { data: st } = await supabase.from('service_types').select('id, name').limit(5);
    console.log("Service Types:", st);

    const { data: td } = await supabase.from('trade_directions').select('*').limit(5); // Guessing table name
    if (!td) {
         // Try checking if it's an enum or another table
         console.log("No 'trade_directions' table found.");
    } else {
         console.log("Trade Directions:", td);
    }

    const { data: c } = await supabase.from('commodities').select('id, name').limit(5); // Guessing table name
    if (!c) {
         console.log("No 'commodities' table found.");
         // Try hts_codes or similar
         const { data: hts } = await supabase.from('aes_hts_codes').select('id, description').limit(1);
         console.log("HTS Codes:", hts);
    } else {
         console.log("Commodities:", c);
    }
}

inspectMasterData();

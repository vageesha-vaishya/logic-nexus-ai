
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
    const { data: sizes, error } = await supabase.from('container_sizes').select('*');
    if (error) {
        console.error('Error fetching sizes:', error);
    } else {
        console.log('Container Sizes:', JSON.stringify(sizes, null, 2));
    }

    const { data: types, error: tError } = await supabase.from('container_types').select('*');
    if (tError) {
        console.error('Error fetching types:', tError);
    } else {
        console.log('Container Types:', JSON.stringify(types, null, 2));
    }
}

main();

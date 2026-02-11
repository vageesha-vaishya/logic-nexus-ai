
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
    const { data: templates } = await supabase
        .from('quote_templates')
        .select('*')
        .eq('layout_type', 'mgl_granular');
    
    if (templates && templates.length > 0) {
        console.log('Found templates:', templates.length);
        templates.forEach(t => {
            console.log(`ID: ${t.id}, Name: ${t.name}`);
            console.log('Content:', JSON.stringify(t.content, null, 2));
        });
    } else {
        console.log('No mgl_granular templates found.');
    }
}

run();

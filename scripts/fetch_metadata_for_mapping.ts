
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkMetadata() {
  const { data: sizes } = await supabase.from('container_sizes').select('id, name, code');
  const { data: cats } = await supabase.from('charge_categories').select('id, name, code');
  const { data: sides } = await supabase.from('charge_sides').select('id, name, code');
  const { data: bases } = await supabase.from('charge_bases').select('id, name, code');
  
  console.log('Sizes:', JSON.stringify(sizes, null, 2));
  console.log('Categories:', JSON.stringify(cats, null, 2));
  console.log('Sides:', JSON.stringify(sides, null, 2));
  console.log('Bases:', JSON.stringify(bases, null, 2));
}

checkMetadata();

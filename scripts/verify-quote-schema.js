
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking quotation_version_options schema...');
  
  const columnsToCheck = ['tier', 'reliability_score', 'ai_generated', 'ai_explanation'];
  
  for (const col of columnsToCheck) {
    const { error } = await supabase
      .from('quotation_version_options')
      .select(col)
      .limit(1);
      
    if (error) {
      console.log(`❌ Column '${col}' is MISSING or inaccessible:`, error.message);
    } else {
      console.log(`✅ Column '${col}' exists.`);
    }
  }
}

checkSchema();

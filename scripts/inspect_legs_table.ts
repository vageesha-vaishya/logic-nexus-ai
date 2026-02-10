
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkColumns() {
  console.log('Checking columns for quotation_version_option_legs...');
  
  // Trick: Select * with limit 0 to get structure, but RPC is better for schema info if available.
  // Or just try to select and see what returns if I don't select specific columns.
  // Actually, I can query information_schema if I have permissions.
  
  // Attempt 1: Select one row
  const { data, error } = await supabase
    .from('quotation_version_option_legs')
    .select('*')
    .limit(1);
    
  if (error) {
    console.error('Error selecting:', error);
  } else if (data && data.length > 0) {
    console.log('Columns found in returned data:', Object.keys(data[0]));
  } else {
    console.log('No data found, but query succeeded. Table exists.');
  }

  // Attempt 2: Force schema cache reload by calling reload_schema if available (unlikely for anon/service role without superuser)
  // Instead, just print what we found.
}

checkColumns();

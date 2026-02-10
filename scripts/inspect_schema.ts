
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

async function main() {
  const tableName = process.argv[2] || 'carriers';
  console.log(`--- Inspecting Schema for table: ${tableName} ---`);
  
  const { data, error } = await supabase
    .from(tableName)
    .select('*')
    .limit(1);

  if (error) {
    console.error('Error selecting:', error);
  } else if (data && data.length > 0) {
    console.log('Columns:', Object.keys(data[0]));
  } else {
    console.log('No data found, cannot infer columns from data.');
    // Try to insert a dummy record with just required fields to see what works
    // Or check if there is a way to get schema definition via RPC?
    // Let's try to select from information_schema if possible (usually not via client)
  }
}

main();

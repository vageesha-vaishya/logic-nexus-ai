
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

if (!SUPABASE_KEY) {
  console.error('Missing SUPABASE_SERVICE_ROLE_KEY or VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectTable(tableName: string) {
  console.log(`\n--- Inspecting Table: ${tableName} ---`);
  const { data, error } = await supabase.from(tableName).select('*').limit(1);

  if (error) {
    console.error(`Error selecting from ${tableName}:`, error.message);
    return;
  }

  if (data && data.length > 0) {
    const columns = Object.keys(data[0]);
    console.log('Columns:', columns.join(', '));
    // Also print data types if we could, but we can't easily.
    // We can infer from values.
    const sample = data[0];
    for (const col of columns) {
        console.log(`  ${col}: ${typeof sample[col]} (${sample[col]})`);
    }
  } else {
    console.log(`Table ${tableName} is empty. Cannot infer columns.`);
  }
}

async function main() {
  const tables = process.argv.slice(2);
  if (tables.length === 0) {
    console.log('Usage: npx tsx scripts/inspect_tables.ts <table1> <table2> ...');
    process.exit(0);
  }

  for (const table of tables) {
    await inspectTable(table);
  }
}

main();

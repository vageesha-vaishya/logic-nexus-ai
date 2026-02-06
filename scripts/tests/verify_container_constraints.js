
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Supabase URL or Service Role Key not found.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verify() {
  console.log('--- Verifying Container Normalization & Constraints ---');

  // 1. Check for Duplicates
  const { data: types, error: typesError } = await supabase
    .from('container_types')
    .select('name');
  
  if (typesError) {
    console.error('Error fetching types:', typesError);
  } else {
    const names = types.map(t => t.name.toLowerCase().trim());
    const counts = {};
    names.forEach(n => counts[n] = (counts[n] || 0) + 1);
    const duplicates = Object.keys(counts).filter(n => counts[n] > 1);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicate container types found.');
    } else {
      console.error('❌ Duplicates found:', duplicates);
    }
  }

  // 2. Check Constraints (via Introspection or attempt insert)
  // Attempt to insert duplicate name
  console.log('Testing unique constraint on container_types...');
  const testName = 'Test Unique Constraint ' + Date.now();
  
  // First insert
  const { data: d1, error: e1 } = await supabase.from('container_types').insert({ name: testName }).select().single();
  if (e1) {
    console.error('❌ Failed initial insert:', e1);
  } else {
    // Second insert (should fail)
    const { error: e2 } = await supabase.from('container_types').insert({ name: testName });
    if (e2 && e2.code === '23505') { // unique_violation
      console.log('✅ Unique constraint confirmed (caught duplicate insert).');
    } else {
      console.error('❌ Unique constraint FAILED. Duplicate insert succeeded or different error:', e2);
    }
    // Cleanup
    await supabase.from('container_types').delete().eq('id', d1.id);
  }

  // 3. Check quote_cargo_configurations columns
  console.log('Checking quote_cargo_configurations columns...');
  const { data: qcc, error: qccError } = await supabase
    .from('quote_cargo_configurations')
    .select('container_type_id, container_size_id')
    .limit(1);
  
  if (qccError) {
    console.error('❌ Error selecting new columns:', qccError);
  } else {
    console.log('✅ Columns container_type_id/size_id exist.');
  }

  console.log('--- Verification Complete ---');
}

verify();

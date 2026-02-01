
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyServiceArchitecture() {
  console.log('Starting Service Architecture Verification...');

  // 1. Verify Service Modes
  const { data: modes, error: modesError } = await supabase
    .from('service_modes')
    .select('*')
    .order('display_order');
  
  if (modesError) throw modesError;
  console.log(`\n✅ Service Modes (${modes.length}):`);
  modes.forEach(m => console.log(`   - ${m.code}: ${m.name}`));

  // 2. Verify Service Categories
  const { data: categories, error: catsError } = await supabase
    .from('service_categories')
    .select('*')
    .order('display_order');
  
  if (catsError) throw catsError;
  console.log(`\n✅ Service Categories (${categories.length}):`);
  categories.forEach(c => console.log(`   - ${c.code}: ${c.name}`));

  // 3. Verify Service Types and Mappings
  const { data: types, error: typesError } = await supabase
    .from('service_types')
    .select('*')
    .order('name');
  
  if (typesError) throw typesError;
  console.log(`\n✅ Service Types (${types.length}):`);
  
  // Create lookups
  const modeMap = Object.fromEntries(modes.map(m => [m.id, m.code]));
  const catMap = Object.fromEntries(categories.map(c => [c.id, c.code]));

  types.forEach(t => {
     const cat = t.category_id ? `[${catMap[t.category_id] || t.category_id}]` : '[NO CATEGORY]';
     const mode = t.mode_id ? `[${modeMap[t.mode_id] || t.mode_id}]` : '[NO MODE]';
     console.log(`   - ${t.code.padEnd(20)} ${cat} ${mode} : ${t.name}`);
  });

  // 4. Verify Attribute Definitions
  const { data: attrs, error: attrsError } = await supabase
    .from('service_attribute_definitions')
    .select('*')
    .order('service_type_id');
  
  if (attrsError) throw attrsError;
  console.log(`\n✅ Attribute Definitions (${attrs.length}):`);
  
  const typeMap = Object.fromEntries(types.map(t => [t.id, t.code]));
  const attrsByType = {};
  attrs.forEach(a => {
    const typeCode = typeMap[a.service_type_id] || 'unknown';
    attrsByType[typeCode] = (attrsByType[typeCode] || 0) + 1;
  });
  
  Object.entries(attrsByType).forEach(([type, count]) => {
    console.log(`   - ${type}: ${count} attributes`);
  });

  console.log('\n✅ Verification Complete.');
}

verifyServiceArchitecture().catch(err => {
  console.error('Verification Failed:', err);
  process.exit(1);
});

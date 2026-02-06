import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixMissingPortNames() {
  console.log('🔧 Fixing missing port names...');

  // 1. Specific Fixes
  const specificFixes = [
    { code: 'USSEA', name: 'Port of Seattle' },
    { code: 'USSEA-RL', name: 'Seattle Rail Terminal' },
    { code: 'USTAC', name: 'Port of Tacoma' },
    { code: 'SFO', name: 'San Francisco International Airport' },
    { code: 'USOAK', name: 'Port of Oakland' },
    { code: 'USPDX-RL', name: 'Portland Rail Terminal' },
    { code: 'PDX', name: 'Portland International Airport' },
    { code: 'USPDX', name: 'Port of Portland' },
    { code: 'SEA', name: 'Seattle-Tacoma International Airport' }
  ];

  for (const fix of specificFixes) {
    const { error } = await supabase
      .from('ports_locations')
      .update({ location_name: fix.name })
      .eq('location_code', fix.code)
      .or('location_name.is.null,location_name.eq.""');
    
    if (error) console.error(`Failed to fix ${fix.code}:`, error.message);
  }
  console.log('✅ Applied specific name fixes');

  // 2. Generic Fallback (fetch, compute, update)
  // We can't do complex SQL updates easily via JS client without RPC, so we fetch and update
  const { data: missing, error: fetchError } = await supabase
    .from('ports_locations')
    .select('id, location_code, location_type, city')
    .or('location_name.is.null,location_name.eq.""');

  if (fetchError) {
    console.error('Failed to fetch missing names:', fetchError);
    return;
  }

  console.log(`Found ${missing?.length || 0} remaining ports with missing names`);

  if (!missing || missing.length === 0) {
    console.log('✅ No more missing names found.');
    return;
  }

  let updatedCount = 0;
  for (const port of missing) {
    let newName = '';
    
    if (port.city && port.location_type) {
      // "Seattle Seaport"
      const typeStr = port.location_type.replace(/_/g, ' ');
      const typeCap = typeStr.charAt(0).toUpperCase() + typeStr.slice(1);
      newName = `${port.city} ${typeCap}`;
    } else {
      newName = `Unknown Location (${port.location_code || 'No Code'})`;
    }

    const { error } = await supabase
      .from('ports_locations')
      .update({ location_name: newName })
      .eq('id', port.id);

    if (error) {
      console.error(`Failed to update ${port.id}:`, error.message);
    } else {
      updatedCount++;
    }
  }

  console.log(`✅ Updated ${updatedCount} ports with generated names`);
}

fixMissingPortNames();

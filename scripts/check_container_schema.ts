
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
function loadEnv() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    if (fs.existsSync(envPath)) {
      const envConfig = fs.readFileSync(envPath, 'utf8');
      envConfig.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim().replace(/^["']|["']$/g, '');
          if (!process.env[key]) process.env[key] = value;
        }
      });
    }
  } catch (e) {
    console.warn('Failed to load .env file', e);
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking container_sizes columns...');
  const { data: sizes, error: sizesError } = await supabase
    .from('container_sizes')
    .select('*')
    .limit(1);

  if (sizesError) {
    console.error('Error fetching container_sizes:', sizesError);
  } else {
    console.log('container_sizes columns:', sizes && sizes.length > 0 ? Object.keys(sizes[0]) : 'Table empty, cannot verify columns via select');
    // If empty, we can try to insert a dummy row to see if it accepts new columns, or just assume if no error it's likely fine.
    // Better: Query information_schema if possible (but RLS/permissions might block). 
    // Service role key usually bypasses RLS but doesn't grant access to information_schema via API directly usually.
    // We can try to insert a row with new columns and then delete it.
  }

  console.log('Checking container_tracking table...');
  const { error: trackingError } = await supabase
    .from('container_tracking')
    .select('count')
    .limit(1);

  if (trackingError) {
    console.error('container_tracking table check failed:', trackingError);
  } else {
    console.log('container_tracking table exists.');
  }
}

checkSchema();

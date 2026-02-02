import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function rollback() {
  const logFile = process.argv[2];
  if (!logFile) {
    console.error('❌ Usage: npx tsx scripts/rollback_seed.ts <path_to_log_json>');
    process.exit(1);
  }

  if (!fs.existsSync(logFile)) {
    console.error(`❌ File not found: ${logFile}`);
    process.exit(1);
  }

  const ids = JSON.parse(fs.readFileSync(logFile, 'utf8'));
  if (!Array.isArray(ids) || ids.length === 0) {
     console.error('❌ Invalid or empty log file');
     process.exit(1);
  }

  console.log(`🗑️  Rolling back ${ids.length} vendors from ${path.basename(logFile)}...`);

  const { error } = await supabase.from('vendors').delete().in('id', ids);

  if (error) {
    console.error('❌ Rollback failed:', error.message);
  } else {
    console.log('✅ Rollback successful!');
  }
}

rollback();

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://iutyqzjlpenfddqdwcsk.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SERVICE_KEY) {
  console.error('Error: SUPABASE_SERVICE_ROLE_KEY is required.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkAuth() {
  console.log('Checking Auth Access...');
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 5 });
  if (error) {
    console.error('Auth Error:', error.message);
  } else {
    console.log(`✓ Auth Accessible. Found ${users.length} users (sample).`);
  }
}

async function checkStorage() {
  console.log('Checking Storage Access...');
  const { data: buckets, error } = await supabase.storage.listBuckets();
  if (error) {
    console.error('Storage Error:', error.message);
  } else {
    console.log(`✓ Storage Accessible. Found ${buckets.length} buckets.`);
    buckets.forEach(b => console.log(`  - ${b.name}`));
  }
}

async function main() {
  await checkAuth();
  await checkStorage();
}

main();

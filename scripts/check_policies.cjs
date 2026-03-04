const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envLocalPath = path.resolve(__dirname, '../.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim().replace(/(^"|"$)/g, '');
      }
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkPolicies() {
  console.log('Checking RLS policies for ports_locations...');
  
  // 1. Check if data exists via Service Role (should work)
  const { data: countData, count, error: countError } = await supabase
    .from('ports_locations')
    .select('*', { count: 'exact', head: true });
    
  if (countError) {
    console.error('Service role query failed:', countError);
  } else {
    console.log(`Service role found ${count} rows in ports_locations.`);
  }

  // 2. Try to list users to verify we can connect to auth
  const { data: { users }, error: usersError } = await supabase.auth.admin.listUsers();
  if (usersError) {
    console.error('Failed to list users:', usersError);
  } else if (users && users.length > 0) {
    console.log(`Found ${users.length} users.`);
    // We can't easily impersonate without a password or custom token generator.
    // Instead, let's verify if RLS is enabled on the table by checking if we can select data without auth (anon key).
    
    // We need the ANON key for this test.
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (anonKey) {
      const anonClient = createClient(supabaseUrl, anonKey);
      const { data: anonData, error: anonError } = await anonClient
        .from('ports_locations')
        .select('*')
        .limit(1);
        
      if (anonError) {
        console.error('Anonymous access failed (RLS likely blocking):', anonError.message);
      } else {
        console.log('Anonymous access successful (RLS might be disabled or allowing public read):', anonData.length > 0 ? 'Data found' : 'No data found');
      }
    } else {
      console.log('Skipping anonymous test: No ANON key found.');
    }
  } else {
    console.log('No users found to test against.');
  }
}

checkPolicies();

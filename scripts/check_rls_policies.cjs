const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
const envLocalPath = path.resolve(__dirname, '../.env.local');
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envLocalPath)) {
  dotenv.config({ path: envLocalPath });
} else if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRLS() {
  console.log('Checking RLS policies for ports_locations...');
  
  // We can query pg_policies via RPC if available, or try to query the table directly with an anon user
  // Since we don't have direct SQL access, we'll try to query the table with a regular user token if possible.
  // But wait, checking RLS *definitions* requires querying system catalogs, which usually requires admin/service role.
  // Service role bypasses RLS, so we can't test RLS enforcement with it directly.
  
  // Instead, let's try to query the table as an authenticated user (simulating the frontend).
  // We need a valid user token.
  
  // First, get a user ID to impersonate or sign in.
  const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
  if (userError || !users || users.length === 0) {
    console.error('Failed to list users:', userError);
    return;
  }
  
  const testUser = users[0];
  console.log(`Testing access as user: ${testUser.email} (${testUser.id})`);
  
  // Create a client with the user's ID (this doesn't fully simulate RLS unless we have a session, 
  // but using the service role to *act as* a user is tricky without a JWT).
  // Actually, Supabase JS admin client doesn't easily support "act as user" for RLS testing 
  // without a custom JWT.
  
  // However, we can check if RLS is enabled on the table.
  // We can try to select from information_schema.tables where table_name = 'ports_locations'.
  // But RLS status is in pg_class.
  
  // Let's try to use a raw query if we have a function for it, or just use the service role 
  // to inspect the policies via a direct query if we have a "exec_sql" function.
  // Assuming we don't.
  
  // Plan B: Use the `reproduce_save_quote.cjs` approach but for *loading*.
  // That script uses `signInWithPassword` if credentials are available, or `admin.listUsers`...
  // Wait, `reproduce_save_quote.cjs` used `supabase.auth.signInWithPassword`? 
  // No, it used `createClient(url, service_role_key)`.
  
  // To test RLS, we MUST use a non-service-role client.
  // We need a valid email/password to sign in.
  
  // If we can't sign in, we can't truly test RLS enforcement from the script.
  // But we can check if `ports_locations` is publicly readable.
  
  // Let's try to fetch `ports_locations` with the ANON key.
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!anonKey) {
    console.error('Missing VITE_SUPABASE_ANON_KEY');
    return;
  }
  
  const anonClient = createClient(supabaseUrl, anonKey);
  
  console.log('Attempting to fetch ports_locations with ANON key...');
  const { data, error } = await anonClient
    .from('ports_locations')
    .select('count')
    .limit(1)
    .single();
    
  if (error) {
    console.error('ANON access failed:', error);
  } else {
    console.log('ANON access successful:', data);
  }
  
  // If ANON fails, it might be restricted to authenticated users.
  // This is expected.
  
  // The issue is whether *authenticated* users can read it.
  // If I can't sign in as a user in this script, I can't verify that.
  
  // However, I can check if there are any policies on the table using a query if possible.
  // If not, I will rely on the `search_locations` RPC fix which I already applied.
  // The issue is the *join* in `UnifiedQuoteComposer`.
  
  // Let's try to inspect the policies by listing them if we can.
  // We can query `pg_policies` view using the service role if we have a function for it.
  // Or simply try to guess.
  
  // Actually, I can check the `migrations` folder for policies on `ports_locations`.
}

checkRLS();

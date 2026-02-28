
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Default test credentials if not provided
const TEST_EMAIL = process.env.TEST_USER_EMAIL || 'regression_test_user@example.com';
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'TestPass123!';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Admin client for setup (creating user/quote if needed)
const adminClient = SERVICE_ROLE_KEY 
  ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY) 
  : null;

async function getAnyTenantId() {
  if (!adminClient) return null;

  const { data: tenants, error } = await adminClient.from('tenants').select('id').limit(1);
  if (error) {
    console.warn('Failed to load tenants:', error.message);
    return null;
  }

  return tenants && tenants.length > 0 ? tenants[0].id : null;
}

async function ensureProfileRow(userId: string, email: string) {
  if (!adminClient) return;

  const { data: existingProfile, error: profileReadError } = await adminClient
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .maybeSingle();

  if (profileReadError) {
    console.warn('Failed to check profiles row:', profileReadError.message);
    return;
  }

  if (existingProfile) return;

  const { error: profileInsertError } = await adminClient.from('profiles').insert({
    id: userId,
    email,
    first_name: 'Regression',
    last_name: 'Test',
  });

  if (profileInsertError) {
    console.warn('Failed to insert profiles row:', profileInsertError.message);
  }
}

async function ensureUserRole(userId: string, tenantId: string) {
  if (!adminClient) return;

  const { data: roles, error: rolesReadError } = await adminClient
    .from('user_roles')
    .select('id, role, tenant_id, franchise_id')
    .eq('user_id', userId);

  if (rolesReadError) {
    console.warn('Failed to read user roles:', rolesReadError.message);
    return;
  }

  const existingRole = (roles || []).find((r) => r.role === 'user');

  if (!existingRole) {
    const { error: insertError } = await adminClient.from('user_roles').insert({
      user_id: userId,
      role: 'user',
      tenant_id: tenantId,
      franchise_id: null,
    });

    if (insertError) {
      console.warn('Failed to insert user role:', insertError.message);
    }

    return;
  }

  if (existingRole.tenant_id !== tenantId) {
    const { error: updateError } = await adminClient
      .from('user_roles')
      .update({ tenant_id: tenantId })
      .eq('id', existingRole.id);

    if (updateError) {
      console.warn('Failed to update user role tenant_id:', updateError.message);
    }
  }
}

async function setupTestUser() {
  if (!adminClient) return { userId: null as string | null, tenantId: null as string | null };

  console.log(`Ensuring test user ${TEST_EMAIL} exists...`);
  // Check if user exists
  const { data: { users }, error: listError } = await adminClient.auth.admin.listUsers();
  
  if (listError) {
      console.warn('Failed to list users with admin client:', listError.message);
      return { userId: null, tenantId: null };
  }

  const existingUser = users.find(u => u.email === TEST_EMAIL);
  const tenantId = await getAnyTenantId();

  if (!tenantId) {
    console.warn('No tenant found for regression user role assignment.');
  }

  if (!existingUser) {
    console.log('Creating test user...');
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true
    });
    if (createError) {
      console.error('Failed to create test user:', createError.message);
      throw createError;
    }
    console.log('Test user created.');

    const createdUserId = created?.user?.id ?? null;
    if (createdUserId && tenantId) {
      await ensureProfileRow(createdUserId, TEST_EMAIL);
      await ensureUserRole(createdUserId, tenantId);
    }

    return { userId: createdUserId, tenantId };
  } else {
    console.log('Test user already exists.');
    // Optional: Reset password to ensure we can login
    const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
        password: TEST_PASSWORD
    });
    if (updateError) {
        console.warn('Failed to update test user password:', updateError.message);
    }

    if (tenantId) {
      await ensureProfileRow(existingUser.id, TEST_EMAIL);
      await ensureUserRole(existingUser.id, tenantId);
    }

    return { userId: existingUser.id, tenantId };
  }
}

async function setupTestQuote(userId: string, tenantId: string | null) {
    if (!adminClient) return null;
    if (!tenantId) return null;
    
    // Check for existing quote owned by user
    const { data: quotes } = await adminClient
        .from('quotes')
        .select('id')
        .eq('owner_id', userId)
        .eq('tenant_id', tenantId)
        .limit(1);
        
    if (quotes && quotes.length > 0) {
        return quotes[0].id;
    }

    console.log('Creating test quote for user...');

    // Create a minimal quote
    const { data, error } = await adminClient
        .from('quotes')
        .insert({
            owner_id: userId,
            tenant_id: tenantId,
            franchise_id: null,
            title: 'Regression Test Quote',
            status: 'draft', 
        })
        .select()
        .single();

    if (error) {
        console.warn('Failed to create test quote via admin:', error.message);
        // Fallback: try to find ANY quote and assume we can use it (risky if RLS is strict)
        return null;
    }
    
    return data.id;
}

async function runTest() {
  console.log('--- Starting Regression Test for save-quotation-version ---');

  let tenantId: string | null = null;
  if (adminClient) {
    const setup = await setupTestUser();
    tenantId = setup.tenantId;
  }

  if (adminClient) {
      // user and roles ensured above
  } else if (!process.env.TEST_USER_EMAIL) {
      console.warn('No SERVICE_ROLE_KEY and no TEST_USER_EMAIL provided. Test may fail login.');
  }

  // 1. Sign In
  console.log(`Logging in as ${TEST_EMAIL}...`);
  const { data: { session }, error: loginError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (loginError || !session) {
    console.error('Login failed:', loginError);
    process.exit(1);
  }
  console.log('Login successful. Token obtained.');

  // Verify token locally
  const { data: { user: verifiedUser }, error: verifyError } = await supabase.auth.getUser(session.access_token);
  if (verifyError) {
      console.error('Immediate token verification failed:', verifyError);
      process.exit(1);
  }
  console.log('Token verified against Auth API. User ID:', verifiedUser?.id);

  // 2. Get Quote ID
  let testQuoteId = await setupTestQuote(session.user.id, tenantId);
  
  if (!testQuoteId) {
      // Fallback to finding any quote if setup failed or no admin client
      const { data: quotes } = await supabase.from('quotes').select('id').limit(1);
      if (quotes && quotes.length > 0) {
          testQuoteId = quotes[0].id;
          console.log(`Using existing quote (ID: ${testQuoteId}) - Warning: User might not own this quote.`);
      }
  }

  if (!testQuoteId) {
      console.error('No quotes found or created to test with.');
      process.exit(1);
  }
  
  console.log(`Testing with Quote ID: ${testQuoteId}`);

  // 3. Invoke Edge Function
  console.log('Invoking save-quotation-version...');

  /*
  const { data, error } = await supabase.functions.invoke('save-quotation-version', {
    body: {
      quoteId: testQuoteId,
      type: 'minor',
      reason: 'Automated Regression Test'
    }
  });
  */

  // Use fetch directly to debug
  const response = await fetch(`${SUPABASE_URL}/functions/v1/save-quotation-version`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY!,
          'Authorization': `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
          quoteId: testQuoteId,
          type: 'minor',
          reason: 'Automated Regression Test'
      })
  });

  if (!response.ok) {
      const text = await response.text();
      console.error('Fetch failed with status:', response.status);
      console.error('Body:', text);
      process.exit(1);
  }

  const data = await response.json();
  const error = null; // for compatibility with rest of script logic if needed

  if (error) {
    console.error('Edge Function invocation failed:', error);
    
    // Log the error structure to debug
    console.error('Error Details:', JSON.stringify(error, null, 2));

    if ((error as any).context && (error as any).context instanceof Response) {
        const response = (error as any).context as Response;
        console.error('Status:', response.status);
        try {
            const text = await response.text();
            console.error('Body:', text);
        } catch (e) {
            console.error('Could not read response body:', e);
        }
    } else if ((error as any).context && (error as any).context.response instanceof Response) {
         const response = (error as any).context.response as Response;
         console.error('Status:', response.status);
         try {
             const text = await response.text();
             console.error('Body:', text);
         } catch (e) {
             console.error('Could not read response body:', e);
         }
    }

    process.exit(1);
  }

  console.log('Success! Response:', data);
  
  if (!data.id || !data.version_number) {
      console.error('Invalid response format: missing id or version_number');
      process.exit(1);
  }

  console.log('--- Test Passed ---');
}

runTest().catch(console.error);

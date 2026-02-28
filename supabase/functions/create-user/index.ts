import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { serveWithLogger } from '../_shared/logger.ts';

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Auth validation
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    // Verify platform_admin role
    // Use injected supabaseAdmin which is already service role
    const { data: roleData } = await supabaseAdmin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const { email, password, first_name, last_name, phone, avatar_url, is_active, must_change_password, email_verified, role, tenant_id, franchise_id } = body;

    logger.info('Creating new user', { email, role, tenant_id, franchise_id });

    // Create auth user
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: email_verified ?? true,
      user_metadata: { first_name, last_name }
    });

    if (createError) {
      logger.error('Failed to create auth user', { error: createError, code: createError.status });

      // Check for JWT/Auth specific errors
      if (createError.message?.includes('JWT') || createError.status === 401) {
         logger.error('JWT/Auth Error detected during user creation. Check Service Role Key.');
      }

      throw createError;
    }

    logger.info('Auth user created', { userId: authData.user.id });

    // Update profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        first_name,
        last_name,
        phone,
        avatar_url,
        is_active: is_active ?? true,
        must_change_password: must_change_password ?? false
      })
      .eq('id', authData.user.id);

    if (profileError) {
      logger.error('Failed to update profile', { error: profileError, userId: authData.user.id });
      throw profileError;
    }

    // Assign role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role,
        tenant_id: tenant_id || null,
        franchise_id: franchise_id || null
      });

    if (roleError) {
      logger.error('Failed to assign role', { error: roleError, userId: authData.user.id, role });
      throw roleError;
    }

    logger.info('User created successfully', { userId: authData.user.id });

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    // Improved error handling to capture non-Error objects (like Supabase Auth errors)
    const errorMessage = error?.message || error?.toString() || 'An unknown error occurred';
    const errorContext = error?.context || {};
    
    logger.error('Unhandled error in create-user', { error: errorMessage, context: errorContext });
    
    return new Response(
      JSON.stringify({ error: errorMessage, details: errorContext }),
      {
        headers: { ...headers, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
}, "create-user");

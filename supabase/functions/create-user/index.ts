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

    const body = await req.json();
    const { email, password, first_name, last_name, phone, avatar_url, is_active, must_change_password, email_verified, role, tenant_id, franchise_id } = body;

    const { data: requesterRoles, error: requesterRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', user.id);

    if (requesterRolesError) {
      logger.error('Failed to resolve requester roles', { error: requesterRolesError, userId: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden: cannot resolve requester role scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const roles = requesterRoles || [];
    const isPlatformAdmin = roles.some((r: any) => r.role === 'platform_admin');
    const tenantAdminRoles = roles.filter((r: any) => r.role === 'tenant_admin');
    const franchiseAdminRoles = roles.filter((r: any) => r.role === 'franchise_admin');

    let finalTenantId: string | null = tenant_id || null;
    let finalFranchiseId: string | null = franchise_id || null;
    const targetRole = String(role || '').trim();

    if (!isPlatformAdmin) {
      const isTenantAdmin = tenantAdminRoles.length > 0;
      const isFranchiseAdmin = franchiseAdminRoles.length > 0;

      if (!isTenantAdmin && !isFranchiseAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      if (isTenantAdmin) {
        if (targetRole !== 'franchise_admin' && targetRole !== 'user') {
          return new Response(JSON.stringify({ error: 'Forbidden: tenant admin can only create franchise_admin or user' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        const allowedTenantIds = new Set(
          tenantAdminRoles
            .map((r: any) => r.tenant_id)
            .filter((id: string | null) => !!id)
        );

        if (allowedTenantIds.size === 0) {
          return new Response(JSON.stringify({ error: 'Forbidden: tenant admin has no tenant scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        if (!finalTenantId) {
          finalTenantId = Array.from(allowedTenantIds)[0] as string;
        }

        if (!finalTenantId || !allowedTenantIds.has(finalTenantId)) {
          return new Response(JSON.stringify({ error: 'Forbidden: target tenant outside admin scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
      } else if (isFranchiseAdmin) {
        if (targetRole !== 'user') {
          return new Response(JSON.stringify({ error: 'Forbidden: franchise admin can only create user role' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        const adminScope = franchiseAdminRoles[0];
        if (!adminScope?.tenant_id || !adminScope?.franchise_id) {
          return new Response(JSON.stringify({ error: 'Forbidden: franchise admin has invalid scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
        }

        finalTenantId = adminScope.tenant_id;
        finalFranchiseId = adminScope.franchise_id;
      }

      if (targetRole === 'franchise_admin' || targetRole === 'user') {
        if (!finalTenantId) {
          return new Response(JSON.stringify({ error: 'Tenant is required for this role' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
      }

      if (targetRole === 'franchise_admin') {
        if (!finalFranchiseId) {
          return new Response(JSON.stringify({ error: 'Franchise is required for franchise_admin role' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
        }
      }
    }

    if (targetRole === 'franchise_admin' && finalFranchiseId) {
      const { data: franchiseScope, error: franchiseScopeError } = await supabaseAdmin
        .from('franchises')
        .select('id, tenant_id')
        .eq('id', finalFranchiseId)
        .maybeSingle();

      if (franchiseScopeError) {
        logger.error('Failed to validate franchise scope', { error: franchiseScopeError, franchiseId: finalFranchiseId });
        return new Response(JSON.stringify({ error: 'Unable to validate franchise scope' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }

      if (!franchiseScope || franchiseScope.tenant_id !== finalTenantId) {
        return new Response(JSON.stringify({ error: 'Invalid tenant/franchise relationship' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }

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
        tenant_id: finalTenantId,
        franchise_id: finalFranchiseId
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

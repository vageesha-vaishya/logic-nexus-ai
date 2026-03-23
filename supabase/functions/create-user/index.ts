import { createClient } from '@supabase/supabase-js';
import { getCorsHeaders } from '../_shared/cors.ts';
declare const Deno: any;

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
};

const jsonHeaders = (headers: HeadersInit) => ({
  ...headers,
  'Content-Type': 'application/json',
});

const extractBearerToken = (authHeader: string | null) => {
  if (!authHeader) return null;
  const [scheme, token] = authHeader.trim().split(/\s+/, 2);
  if (!scheme || !token || !/^bearer$/i.test(scheme)) return null;
  return token.trim() || null;
};

const resolveTenantMaxUsers = async (supabaseAdmin: any, tenantId: string) => {
  const { data: tenant, error: tenantError } = await supabaseAdmin
    .from('tenants')
    .select('max_users')
    .eq('id', tenantId)
    .maybeSingle();
  if (tenantError) throw tenantError;
  const tenantMaxUsers = parsePositiveInteger(tenant?.max_users);

  const { data: subscription, error } = await supabaseAdmin
    .from('tenant_subscriptions')
    .select('plan_id, metadata, status, created_at')
    .eq('tenant_id', tenantId)
    .in('status', ['active', 'trial'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;

  const requestedUsers = parsePositiveInteger(subscription?.metadata?.requested_user_count);
  let planMaxUsers: number | null = null;

  if (subscription?.plan_id) {
    const { data: plan, error: planError } = await supabaseAdmin
      .from('subscription_plans')
      .select('max_users, limits')
      .eq('id', subscription.plan_id)
      .maybeSingle();
    if (planError) throw planError;
    planMaxUsers = parsePositiveInteger(plan?.max_users ?? plan?.limits?.users);
  }

  const limits = [tenantMaxUsers, requestedUsers, planMaxUsers].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value) && value > 0
  );
  return limits.length ? Math.min(...limits) : null;
};

const resolveFranchiseUserLimit = async (supabaseAdmin: any, franchiseId: string) => {
  const { data, error } = await supabaseAdmin
    .from('franchises')
    .select('user_limit')
    .eq('id', franchiseId)
    .maybeSingle();
  if (error) throw error;
  return parsePositiveInteger(data?.user_limit);
};

const countTenantUsers = async (supabaseAdmin: any, tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.user_id)).size;
};

const countFranchiseUsers = async (supabaseAdmin: any, franchiseId: string) => {
  const { data, error } = await supabaseAdmin
    .from('user_roles')
    .select('user_id')
    .eq('franchise_id', franchiseId);
  if (error) throw error;
  return new Set((data || []).map((row: any) => row.user_id)).size;
};

Deno.serve(async (req: Request) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ error: 'Missing required Supabase environment configuration' }),
        { status: 500, headers: jsonHeaders(headers) },
      );
    }

    const token = extractBearerToken(req.headers.get('Authorization'));
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders(headers) });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: authUserData, error: authError } = await supabaseAdmin.auth.getUser(token);
    const user = authUserData?.user ?? null;
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders(headers) });
    }

    const body = await req.json();
    const { email, password, first_name, last_name, phone, avatar_url, is_active, must_change_password, email_verified, role, tenant_id, franchise_id } = body;

    const { data: requesterRoles, error: requesterRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', user.id);

    if (requesterRolesError) {
      console.error('Failed to resolve requester roles', { error: requesterRolesError, userId: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden: cannot resolve requester role scope' }), { status: 403, headers: jsonHeaders(headers) });
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
        return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: jsonHeaders(headers) });
      }

      if (isTenantAdmin) {
        if (targetRole !== 'franchise_admin' && targetRole !== 'user') {
          return new Response(JSON.stringify({ error: 'Forbidden: tenant admin can only create franchise_admin or user' }), { status: 403, headers: jsonHeaders(headers) });
        }

        const allowedTenantIds = new Set(
          tenantAdminRoles
            .map((r: any) => r.tenant_id)
            .filter((id: string | null) => !!id)
        );

        if (allowedTenantIds.size === 0) {
          return new Response(JSON.stringify({ error: 'Forbidden: tenant admin has no tenant scope' }), { status: 403, headers: jsonHeaders(headers) });
        }

        if (!finalTenantId) {
          finalTenantId = Array.from(allowedTenantIds)[0] as string;
        }

        if (!finalTenantId || !allowedTenantIds.has(finalTenantId)) {
          return new Response(JSON.stringify({ error: 'Forbidden: target tenant outside admin scope' }), { status: 403, headers: jsonHeaders(headers) });
        }
      } else if (isFranchiseAdmin) {
        if (targetRole !== 'user') {
          return new Response(JSON.stringify({ error: 'Forbidden: franchise admin can only create user role' }), { status: 403, headers: jsonHeaders(headers) });
        }

        const adminScope = franchiseAdminRoles[0];
        if (!adminScope?.tenant_id || !adminScope?.franchise_id) {
          return new Response(JSON.stringify({ error: 'Forbidden: franchise admin has invalid scope' }), { status: 403, headers: jsonHeaders(headers) });
        }

        finalTenantId = adminScope.tenant_id;
        finalFranchiseId = adminScope.franchise_id;
      }

      if (targetRole === 'franchise_admin' || targetRole === 'user') {
        if (!finalTenantId) {
          return new Response(JSON.stringify({ error: 'Tenant is required for this role' }), { status: 400, headers: jsonHeaders(headers) });
        }
      }

      if (targetRole === 'franchise_admin') {
        if (!finalFranchiseId) {
          return new Response(JSON.stringify({ error: 'Franchise is required for franchise_admin role' }), { status: 400, headers: jsonHeaders(headers) });
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
        console.error('Failed to validate franchise scope', { error: franchiseScopeError, franchiseId: finalFranchiseId });
        return new Response(JSON.stringify({ error: 'Unable to validate franchise scope' }), { status: 400, headers: jsonHeaders(headers) });
      }

      if (!franchiseScope || franchiseScope.tenant_id !== finalTenantId) {
        return new Response(JSON.stringify({ error: 'Invalid tenant/franchise relationship' }), { status: 400, headers: jsonHeaders(headers) });
      }
    }

    if (finalTenantId && targetRole !== 'platform_admin') {
      const tenantLimit = await resolveTenantMaxUsers(supabaseAdmin, finalTenantId);
      if (tenantLimit) {
        const existingCount = await countTenantUsers(supabaseAdmin, finalTenantId);
        if (existingCount >= tenantLimit) {
          return new Response(JSON.stringify({ error: `Tenant user limit reached (${tenantLimit})` }), { status: 400, headers: jsonHeaders(headers) });
        }
      }
    }

    if (finalFranchiseId) {
      const franchiseLimit = await resolveFranchiseUserLimit(supabaseAdmin, finalFranchiseId);
      if (franchiseLimit) {
        const existingCount = await countFranchiseUsers(supabaseAdmin, finalFranchiseId);
        if (existingCount >= franchiseLimit) {
          return new Response(JSON.stringify({ error: `Franchise user limit reached (${franchiseLimit})` }), { status: 400, headers: jsonHeaders(headers) });
        }
      }
    }

    console.log('Creating new user', { email, role, tenant_id, franchise_id });

    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: email_verified ?? true,
      user_metadata: { first_name, last_name }
    });

    if (createError) {
      console.error('Failed to create auth user', { error: createError, code: createError.status });

      throw createError;
    }

    console.log('Auth user created', { userId: authData.user.id });

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
      console.error('Failed to update profile', { error: profileError, userId: authData.user.id });
      throw profileError;
    }

    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role,
        tenant_id: finalTenantId,
        franchise_id: finalFranchiseId
      });

    if (roleError) {
      console.error('Failed to assign role', { error: roleError, userId: authData.user.id, role });
      throw roleError;
    }

    console.log('User created successfully', { userId: authData.user.id });

    return new Response(
      JSON.stringify({ success: true, user: authData.user }),
      {
        headers: jsonHeaders(headers),
        status: 200,
      }
    );

  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'An unknown error occurred';
    const errorContext = error?.context || {};
    console.error('Unhandled error in create-user', { error: errorMessage, context: errorContext });

    return new Response(
      JSON.stringify({ error: errorMessage, details: errorContext }),
      {
        headers: jsonHeaders(headers),
        status: 400,
      }
    );
  }
});

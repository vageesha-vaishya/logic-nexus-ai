import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';
import { serveWithLogger } from '../_shared/logger.ts';

const parsePositiveInteger = (value: unknown) => {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

const resolveTenantMaxFranchises = async (supabaseAdmin: any, tenantId: string) => {
  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('max_franchises')
    .eq('id', tenantId)
    .maybeSingle();
  if (error) throw error;
  return parsePositiveInteger(data?.max_franchises);
};

const countTenantFranchises = async (supabaseAdmin: any, tenantId: string) => {
  const { count, error } = await supabaseAdmin
    .from('franchises')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  if (error) throw error;
  return count ?? 0;
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    const { user, error: authError } = await requireAuth(req);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const body = await req.json();
    const name = String(body?.name || '').trim();
    const code = String(body?.code || '').trim();
    const tenantIdInput = String(body?.tenant_id || '').trim();
    const managerId = body?.manager_id ? String(body.manager_id).trim() : '';
    const address = body?.address ?? null;
    const isActive = body?.is_active ?? true;
    const hasUserLimit = body?.user_limit !== undefined && body?.user_limit !== null && String(body.user_limit).trim() !== '';
    const parsedUserLimit = hasUserLimit ? parsePositiveInteger(body.user_limit) : null;

    if (!name || !code) {
      return new Response(JSON.stringify({ error: 'Name and code are required' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    if (hasUserLimit && !parsedUserLimit) {
      return new Response(JSON.stringify({ error: 'User limit must be greater than 0' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const { data: requesterRoles, error: requesterRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id')
      .eq('user_id', user.id);

    if (requesterRolesError) {
      logger.error('Failed to resolve requester roles', { error: requesterRolesError, userId: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden: cannot resolve requester role scope' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const roles = requesterRoles || [];
    const isPlatformAdmin = roles.some((r: any) => r.role === 'platform_admin');
    const tenantAdminRoles = roles.filter((r: any) => r.role === 'tenant_admin');

    if (!isPlatformAdmin && tenantAdminRoles.length === 0) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    let finalTenantId = tenantIdInput || '';
    if (!isPlatformAdmin) {
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
    }

    if (!finalTenantId) {
      return new Response(JSON.stringify({ error: 'Tenant is required for this franchise' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    if (parsedUserLimit) {
      const maxUsers = await resolveTenantMaxUsers(supabaseAdmin, finalTenantId);
      if (maxUsers && parsedUserLimit > maxUsers) {
        return new Response(JSON.stringify({ error: `User limit cannot exceed tenant max users (${maxUsers})` }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }

    const maxFranchises = await resolveTenantMaxFranchises(supabaseAdmin, finalTenantId);
    if (maxFranchises) {
      const existingCount = await countTenantFranchises(supabaseAdmin, finalTenantId);
      if (existingCount >= maxFranchises) {
        return new Response(JSON.stringify({ error: `Tenant franchise limit reached (${maxFranchises})` }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
      }
    }

    const { data: franchise, error: insertError } = await supabaseAdmin
      .from('franchises')
      .insert({
        name,
        code,
        tenant_id: finalTenantId,
        manager_id: managerId || null,
        user_limit: parsedUserLimit ?? 0,
        is_active: isActive,
        address,
      })
      .select('id')
      .single();

    if (insertError || !franchise) {
      logger.error('Failed to create franchise', { error: insertError, tenantId: finalTenantId });
      return new Response(JSON.stringify({ error: insertError?.message || 'Unable to create franchise' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    return new Response(
      JSON.stringify({ success: true, franchise }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    logger.error('Create franchise failed', { message: error?.message || String(error) });
    return new Response(JSON.stringify({ error: error?.message || 'Create franchise failed' }), { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } });
  }
}, "create-franchise");

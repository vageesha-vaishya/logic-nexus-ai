import { serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth } from '../_shared/auth.ts';

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

    // Resolve requester role scopes (platform/tenant/franchise)
    const { data: requesterRoles, error: requesterRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', user.id);
    if (requesterRolesError) {
      return new Response(JSON.stringify({ error: 'Forbidden: cannot resolve requester scope' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const isPlatformAdmin = (requesterRoles || []).some((entry: any) => entry.role === 'platform_admin');
    const isTenantAdmin = (requesterRoles || []).some((entry: any) => entry.role === 'tenant_admin');
    const isFranchiseAdmin = (requesterRoles || []).some((entry: any) => entry.role === 'franchise_admin');
    const requesterTenantIds = Array.from(
      new Set((requesterRoles || []).map((entry: any) => entry.tenant_id).filter(Boolean)),
    );
    const requesterFranchiseIds = Array.from(
      new Set((requesterRoles || []).map((entry: any) => entry.franchise_id).filter(Boolean)),
    );

    if (!isPlatformAdmin && !isTenantAdmin && !isFranchiseAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden: admin role required' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    if (userId === user.id) {
      return new Response(JSON.stringify({ error: 'Forbidden: cannot delete your own account' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    // Resolve target user scopes and enforce scope checks for non-platform admins
    const { data: targetRoles, error: targetRolesError } = await supabaseAdmin
      .from('user_roles')
      .select('role, tenant_id, franchise_id')
      .eq('user_id', userId);
    if (targetRolesError) {
      return new Response(JSON.stringify({ error: 'Failed to resolve target user scope' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    const targetHasPlatformAdmin = (targetRoles || []).some((entry: any) => entry.role === 'platform_admin');
    const targetTenantIds = Array.from(new Set((targetRoles || []).map((entry: any) => entry.tenant_id).filter(Boolean)));
    const targetFranchiseIds = Array.from(new Set((targetRoles || []).map((entry: any) => entry.franchise_id).filter(Boolean)));

    if (!isPlatformAdmin) {
      if (targetHasPlatformAdmin) {
        return new Response(JSON.stringify({ error: 'Forbidden: cannot delete platform admin user' }), {
          status: 403,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }

      const tenantScopeAllowed = isTenantAdmin && requesterTenantIds.some((tenantId) => targetTenantIds.includes(tenantId));
      const franchiseScopeAllowed = isFranchiseAdmin
        && requesterFranchiseIds.some((franchiseId) => targetFranchiseIds.includes(franchiseId));
      if (!tenantScopeAllowed && !franchiseScopeAllowed) {
        return new Response(JSON.stringify({ error: 'Forbidden: target user outside admin scope' }), {
          status: 403,
          headers: { ...headers, 'Content-Type': 'application/json' },
        });
      }
    }

    logger.info('Deleting user', { userId });

    // 1. Cleanup role/link rows first to avoid FK block in environments without cascading setup
    const { error: userCustomRolesError } = await supabaseAdmin
      .from('user_custom_roles')
      .delete()
      .eq('user_id', userId);
    if (userCustomRolesError) {
      logger.warn('Failed to clean user_custom_roles before user delete', { error: userCustomRolesError, userId });
    }

    const { error: userRolesError } = await supabaseAdmin
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    if (userRolesError) {
      logger.warn('Failed to clean user_roles before user delete', { error: userRolesError, userId });
    }

    // 2. Ensure Profile is deleted (defensive cleanup)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      logger.warn('Error cleaning up profile (might already be deleted via cascade)', { error: profileError });
      // Don't fail the request if auth delete succeeded
    }

    // 3. Delete from Auth
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (deleteError) {
      logger.error('Failed to delete auth user', { error: deleteError, userId });
      throw deleteError;
    }

    logger.info('User deleted successfully', { userId });

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    logger.error('Unhandled error in delete-user', { error });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
}, "delete-user");

// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, createServiceClient } from '../_shared/auth.ts';
import { Logger } from '../_shared/logger.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  const logger = new Logger({ function: 'delete-user' });
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
    const serviceClient = createServiceClient();
    const { data: roleData } = await serviceClient.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'platform_admin').maybeSingle();
    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: platform_admin required' }), { status: 403, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      const errorMsg = 'Critical Configuration Error: Missing environment variables';
      logger.error(errorMsg);
      return new Response(
        JSON.stringify({ error: errorMsg, code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    logger.info('Deleting user', { userId });

    // 1. Delete from Auth (this should cascade to public.profiles if configured)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (deleteError) {
      logger.error('Failed to delete auth user', { error: deleteError });
      throw deleteError;
    }

    // 2. Ensure Profile is deleted (defensive cleanup)
    // Even if cascade exists, this is harmless if already gone (returns count 0)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileError) {
      logger.warn('Error cleaning up profile (might already be deleted via cascade)', { error: profileError });
      // Don't fail the request if auth delete succeeded
    }

    logger.info('User deleted successfully', { userId });

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { status: 200, headers: { ...headers, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Unhandled error in delete-user', { error });
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});

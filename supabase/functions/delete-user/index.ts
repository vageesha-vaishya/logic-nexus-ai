// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Logger } from '../_shared/logger.ts';

declare const Deno: any;

Deno.serve(async (req: Request) => {
  const logger = new Logger({ function: 'delete-user' });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      const errorMsg = 'Critical Configuration Error: Missing environment variables';
      logger.error(errorMsg);
      return new Response(
        JSON.stringify({ error: errorMsg, code: 'CONFIG_ERROR' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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

    // Auth Verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Missing Authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Check if it's the Service Role Key (Admin Scripts) or a valid user
    let callerUserId = null;
    let isServiceRole = false;

    if (token === serviceRoleKey) {
      isServiceRole = true;
      logger.info('Authenticated via Service Role Key');
    } else {
      const { data: { user }, error: userVerifyError } = await supabaseAdmin.auth.getUser(token);
      if (userVerifyError || !user) {
        return new Response(
          JSON.stringify({ error: 'Unauthorized', details: userVerifyError?.message || 'Invalid Token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      callerUserId = user.id;
      logger.info('Authenticated via User Token', { userId: callerUserId });
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'Missing userId in request body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Permission Check: Only Platform Admin can delete users (or service role)
    if (!isServiceRole) {
      const { data: roles, error: roleError } = await supabaseAdmin
        .from('user_roles')
        .select('role')
        .eq('user_id', callerUserId)
        .eq('role', 'platform_admin')
        .single();

      if (roleError || !roles) {
        // Double check tenant admin logic if needed, but for now strict to platform admin for hard delete
        // Or check if user is tenant admin and target user belongs to same tenant?
        // Let's stick to Platform Admin for safety as per UserDetail.tsx logic (which checked isPlatformAdmin)
        logger.warn('Unauthorized delete attempt', { callerUserId, targetUserId: userId });
        return new Response(
          JSON.stringify({ error: 'Forbidden: Insufficient permissions' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
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
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    logger.error('Unhandled error in delete-user', { error });
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

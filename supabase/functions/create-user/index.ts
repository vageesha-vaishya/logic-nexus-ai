// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from '../_shared/cors.ts';
import { Logger } from '../_shared/logger.ts';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const Deno: any;

Deno.serve(async (req: Request) => {
  const logger = new Logger({ function: 'create-user' });

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      (Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY')) ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    const { email, password, first_name, last_name, phone, avatar_url, is_active, must_change_password, email_verified, role, tenant_id, franchise_id } = body;

    logger.info('Creating new user', { email, role, tenant_id, franchise_id });

    // Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: email_verified ?? true,
      user_metadata: { first_name, last_name }
    });

    if (authError) {
      logger.error('Failed to create auth user', { error: authError });
      throw authError;
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    logger.error('Unhandled error in create-user', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

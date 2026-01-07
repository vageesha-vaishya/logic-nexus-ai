import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Logger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  const logger = new Logger({ function: 'seed-platform-admin' });

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Use logical OR to treat empty strings as missing and fall back correctly
    const projectUrl = Deno.env.get('PROJECT_URL') || Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL') || '';
    const serviceKey = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabaseAdmin = createClient(
      projectUrl,
      serviceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    const email = body.email || 'Bahuguna.vimal@gmail.com';
    const password = body.password || 'Vimal@1234';

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Try to create user; if already exists, recover and proceed
    let userId: string | null = null;
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Platform', last_name: 'Admin' }
    });

    if (createErr) {
      const msg = String(createErr.message || createErr);
      const alreadyRegistered = msg.toLowerCase().includes('already been registered') || msg.toLowerCase().includes('already registered');
      if (!alreadyRegistered) {
        throw createErr;
      }
      // Fallback: find existing user by email
      const { data: listRes, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
      if (listErr) throw listErr;
      const existing = listRes?.users?.find((u: any) => (u?.email || '').toLowerCase() === String(email).toLowerCase());
      if (!existing) {
        return new Response(
          JSON.stringify({ error: 'User already exists but could not be retrieved' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      userId = existing.id;
      // Optionally update password to provided one and confirm email
      await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
      logger.info('User exists; updated password and confirmed email', { userId });
    } else {
      userId = createdUser?.user?.id ?? null;
      logger.info('User created', { userId });
    }

    if (!userId) {
      throw new Error('Failed to determine user ID');
    }

    // Assign platform_admin role
    // Insert role; if it already exists, ignore conflict by checking first
    const { data: roleExisting, error: roleSelectError } = await supabaseAdmin
      .from('user_roles')
      .select('id')
      .eq('user_id', userId)
      .eq('role', 'platform_admin')
      .limit(1);

    if (roleSelectError) {
      logger.error('Role select error', { error: roleSelectError });
    }

    if (!roleExisting || roleExisting.length === 0) {
      const { error: roleError } = await supabaseAdmin
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'platform_admin',
          tenant_id: null,
          franchise_id: null
        });
      if (roleError) {
        logger.error('Role assignment error', { error: roleError });
        throw roleError;
      }
    }
    
    return new Response(
      JSON.stringify({ message: 'Platform admin seeded successfully', userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('Error seeding platform admin', { error });
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

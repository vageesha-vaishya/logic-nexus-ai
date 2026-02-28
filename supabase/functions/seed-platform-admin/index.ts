import { Logger, serveWithLogger } from '../_shared/logger.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      if (msg.includes('already has been registered') || msg.includes('unique constraint')) {
        logger.info(`User ${email} already exists. Fetching ID...`);
        // If user exists, we need to find their ID to assign role
        // Since we can't search by email directly with simple client easily without admin listUsers permission (which we have)
        const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
        if (listErr) throw listErr;
        const existing = users.users.find(u => u.email === email);
        if (existing) {
          userId = existing.id;
        } else {
          throw new Error(`User ${email} says it exists but cannot be found in list.`);
        }
      } else {
        throw createErr;
      }
    } else {
      userId = createdUser.user.id;
      logger.info(`Created new platform admin user: ${userId}`);
    }

    // Assign 'Platform Admin' role
    // Check if role exists
    const { data: roleData, error: roleErr } = await supabaseAdmin
      .from('roles')
      .select('id')
      .eq('name', 'Platform Admin')
      .single();
    
    let roleId = roleData?.id;

    if (roleErr || !roleId) {
       logger.info("'Platform Admin' role not found. Creating it...");
       const { data: newRole, error: newRoleErr } = await supabaseAdmin
         .from('roles')
         .insert({ name: 'Platform Admin', description: 'Super user with access to all tenants' })
         .select()
         .single();
       
       if (newRoleErr) throw newRoleErr;
       roleId = newRole.id;
    }

    // Assign role to user
    if (userId && roleId) {
      const { error: assignErr } = await supabaseAdmin
        .from('user_roles')
        .upsert({ user_id: userId, role_id: roleId }, { onConflict: 'user_id, role_id' });
      
      if (assignErr) throw assignErr;
      logger.info(`Assigned 'Platform Admin' role to ${email}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: `Platform Admin seeded: ${email}` }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    logger.error(`Failed to seed platform admin: ${err.message}`, { error: err });
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}, "seed-platform-admin");

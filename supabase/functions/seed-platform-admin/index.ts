import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { email, password } = await req.json();

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return new Response(
        JSON.stringify({ error: 'User already exists' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        first_name: 'Platform',
        last_name: 'Admin'
      }
    });

    if (authError) throw authError;

    console.log('User created:', authData.user.id);

    // Assign platform_admin role
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'platform_admin',
        tenant_id: null,
        franchise_id: null
      });

    if (roleError) {
      console.error('Role assignment error:', roleError);
      throw roleError;
    }

    // Set must_change_password flag
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', authData.user.id);

    if (profileError) {
      console.error('Profile update error:', profileError);
    }

    console.log('Platform admin created successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Platform admin created successfully',
        user_id: authData.user.id 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

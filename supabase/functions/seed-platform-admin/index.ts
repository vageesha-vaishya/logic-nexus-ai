import { Logger, serveWithLogger } from '../_shared/logger.ts';
import { isServiceRoleAuthorizationHeader } from '../_shared/auth.ts';

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-bootstrap-key',
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const isProductionRuntime = (): boolean => {
  const nodeEnv = String(Deno.env.get('NODE_ENV') || '').toLowerCase();
  const environment = String(Deno.env.get('ENVIRONMENT') || '').toLowerCase();
  return nodeEnv === 'production' || environment === 'production';
};

const isSeedEnabled = (): boolean => String(Deno.env.get('SEED_PLATFORM_ADMIN_ENABLED') || '').toLowerCase() === 'true';

const isLocalBootstrapRequest = (req: Request): boolean => {
  const origin = req.headers.get('origin') || '';
  const host = req.headers.get('host') || '';
  const localHostPattern = /(localhost|127\.0\.0\.1)(:\d+)?$/i;

  if (isProductionRuntime()) {
    return false;
  }

  const originHost = origin
    ? (() => {
      try {
        return new URL(origin).host;
      } catch {
        return '';
      }
    })()
    : '';

  return localHostPattern.test(host) || localHostPattern.test(originHost);
};

const isBootstrapAuthorized = (req: Request): boolean => {
  const authHeader = req.headers.get('Authorization');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const hasServiceRoleAuthorization = isServiceRoleAuthorizationHeader(authHeader, serviceRoleKey);
  const productionRuntime = isProductionRuntime();

  if (productionRuntime && !isSeedEnabled()) {
    return false;
  }

  if (productionRuntime) {
    return hasServiceRoleAuthorization;
  }

  if (hasServiceRoleAuthorization) {
    return true;
  }

  const bootstrapKey = String(Deno.env.get('SEED_PLATFORM_ADMIN_BOOTSTRAP_KEY') || '').trim();
  if (bootstrapKey.length > 0) {
    const requestBootstrapKey = String(req.headers.get('x-bootstrap-key') || '').trim();
    return requestBootstrapKey.length > 0 && requestBootstrapKey === bootstrapKey;
  }

  return isLocalBootstrapRequest(req);
};

const findAuthUserByEmail = async (supabaseAdmin: any, email: string) => {
  let page = 1;
  const perPage = 100;
  const targetEmail = normalizeEmail(email);

  while (page <= 200) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
    if (error) {
      throw error;
    }

    const matchedUser = (data?.users || []).find((user: any) => normalizeEmail(user.email || '') === targetEmail);
    if (matchedUser) {
      return matchedUser;
    }

    if (!data?.users || data.users.length < perPage) {
      break;
    }
    page += 1;
  }

  return null;
};

const findProfileUserByEmail = async (supabaseAdmin: any, email: string) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id, email')
    .ilike('email', normalizeEmail(email))
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
};

const quarantineOrphanProfile = async (supabaseAdmin: any, profileId: string) => {
  const orphanEmail = `orphan-${profileId}@invalid.local`;
  const { error: profileUpdateError } = await supabaseAdmin
    .from('profiles')
    .update({ email: orphanEmail, is_active: false })
    .eq('id', profileId);

  if (profileUpdateError) {
    throw profileUpdateError;
  }

  const { error: roleCleanupError } = await supabaseAdmin
    .from('user_roles')
    .delete()
    .eq('user_id', profileId)
    .eq('role', 'platform_admin');

  if (roleCleanupError) {
    throw roleCleanupError;
  }
};

serveWithLogger(async (req, logger, supabaseAdmin) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!isBootstrapAuthorized(req)) {
    return new Response(
      JSON.stringify({ error: 'Forbidden: bootstrap authorization required (service role + seed enablement in production)' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();
    const email = normalizeEmail(body.email || '');
    const password = String(body.password || '');

    // Validate inputs
    if (!email || !password) {
      throw new Error('Email and password are required');
    }

    let userId: string | null = null;
    const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name: 'Platform', last_name: 'Admin' }
    });

    if (createErr) {
      const msg = String(createErr.message || createErr);
      const lowerMsg = msg.toLowerCase();
      const isDuplicateUserError = lowerMsg.includes('already has been registered') || lowerMsg.includes('unique constraint');
      const isDatabaseCreateError = lowerMsg.includes('database error creating new user');
      if (isDuplicateUserError || isDatabaseCreateError) {
        logger.info(`User ${email} already exists. Fetching ID...`);
        const existing = await findAuthUserByEmail(supabaseAdmin, email);
        if (existing) {
          userId = existing.id;
          const { error: updateUserError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password,
            email_confirm: true,
          });
          if (updateUserError) {
            throw updateUserError;
          }
        } else {
          const profileUser = await findProfileUserByEmail(supabaseAdmin, email);
          if (profileUser?.id) {
            await quarantineOrphanProfile(supabaseAdmin, profileUser.id);
            const { data: retriedUser, error: retryCreateError } = await supabaseAdmin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { first_name: 'Platform', last_name: 'Admin' }
            });
            if (retryCreateError) {
              throw retryCreateError;
            }
            userId = retriedUser.user.id;
          } else {
            throw new Error(`User ${email} could not be resolved from auth users.`);
          }
        }
      } else {
        throw createErr;
      }
    } else {
      userId = createdUser.user.id;
      logger.info(`Created new platform admin user: ${userId}`);
    }

    if (!userId) {
      throw new Error(`Unable to resolve admin user id for ${email}`);
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        first_name: 'Platform',
        last_name: 'Admin',
        is_active: true,
        must_change_password: false,
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    const { error: assignErr } = await supabaseAdmin
      .from('user_roles')
      .upsert({
        user_id: userId,
        role: 'platform_admin',
        tenant_id: null,
        franchise_id: null,
      }, { onConflict: 'user_id,role,tenant_id,franchise_id' });

    if (assignErr) throw assignErr;
    logger.info(`Assigned platform_admin role to ${email}`);

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

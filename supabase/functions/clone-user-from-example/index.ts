import { serveWithLogger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireServiceRoleOrAdmin } from '../_shared/auth.ts';

type CloneUserRequest = {
  example_user_email?: string;
  new_user_email?: string;
  new_user_first_name?: string;
  new_user_second_name?: string;
  new_user_last_name?: string;
  new_user_password?: string;
};

const jsonResponse = (payload: unknown, status: number, headers: HeadersInit) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });

const normalizeEmail = (value: unknown): string => String(value ?? '').trim().toLowerCase();
const normalizeText = (value: unknown): string => String(value ?? '').trim();

serveWithLogger(async (req, logger, supabaseAdmin) => {
  const headers = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed. Use POST.' }, 405, headers);
  }

  const authCheck = await requireServiceRoleOrAdmin(req, supabaseAdmin, logger);
  if (!authCheck.authorized) {
    return jsonResponse({ error: authCheck.error || 'Unauthorized' }, authCheck.status, headers);
  }

  const body = await req.json() as CloneUserRequest;
  const exampleUserEmail = normalizeEmail(body.example_user_email);
  const newUserEmail = normalizeEmail(body.new_user_email);
  const newUserFirstName = normalizeText(body.new_user_first_name);
  const newUserLastName = normalizeText(body.new_user_last_name || body.new_user_second_name);
  const newUserPassword = String(body.new_user_password ?? '');

  if (!exampleUserEmail || !newUserEmail || !newUserFirstName || !newUserLastName || !newUserPassword) {
    return jsonResponse({
      error: 'Missing required fields: example_user_email, new_user_email, new_user_first_name, new_user_second_name (or new_user_last_name), new_user_password',
    }, 400, headers);
  }

  if (exampleUserEmail === newUserEmail) {
    return jsonResponse({ error: 'new_user_email must be different from example_user_email' }, 400, headers);
  }

  if (newUserPassword.length < 8) {
    return jsonResponse({ error: 'new_user_password must be at least 8 characters' }, 400, headers);
  }

  const { data: sourceProfile, error: sourceProfileError } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', exampleUserEmail)
    .maybeSingle();

  if (sourceProfileError) {
    await logger.error('Failed to load example user profile', { error: sourceProfileError.message, exampleUserEmail });
    return jsonResponse({ error: 'Failed to load example user profile' }, 400, headers);
  }
  if (!sourceProfile?.id) {
    return jsonResponse({ error: `Example user not found for email ${exampleUserEmail}` }, 404, headers);
  }

  const sourceUserId = String(sourceProfile.id);

  const { data: existingTargetProfile, error: existingTargetProfileError } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('email', newUserEmail)
    .maybeSingle();

  if (existingTargetProfileError) {
    await logger.error('Failed to validate new user email uniqueness', { error: existingTargetProfileError.message, newUserEmail });
    return jsonResponse({ error: 'Failed to validate new user email uniqueness' }, 400, headers);
  }
  if (existingTargetProfile?.id) {
    return jsonResponse({ error: `User already exists for email ${newUserEmail}` }, 409, headers);
  }

  const { data: sourceRoles, error: sourceRolesError } = await supabaseAdmin
    .from('user_roles')
    .select('role, tenant_id, franchise_id')
    .eq('user_id', sourceUserId);

  if (sourceRolesError) {
    await logger.error('Failed to load source user_roles', { error: sourceRolesError.message, sourceUserId });
    return jsonResponse({ error: 'Failed to load source user roles' }, 400, headers);
  }

  const { data: sourceCustomRoles, error: sourceCustomRolesError } = await supabaseAdmin
    .from('user_custom_roles')
    .select('role_id, tenant_id, franchise_id')
    .eq('user_id', sourceUserId);

  if (sourceCustomRolesError) {
    await logger.error('Failed to load source user_custom_roles', { error: sourceCustomRolesError.message, sourceUserId });
    return jsonResponse({ error: 'Failed to load source user custom roles' }, 400, headers);
  }

  const { data: createdUserData, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: newUserEmail,
    password: newUserPassword,
    email_confirm: true,
    user_metadata: {
      first_name: newUserFirstName,
      last_name: newUserLastName,
      full_name: `${newUserFirstName} ${newUserLastName}`.trim(),
    },
  });

  if (createUserError || !createdUserData?.user?.id) {
    await logger.error('Failed to create new auth user', { error: createUserError?.message, newUserEmail });
    return jsonResponse({ error: createUserError?.message || 'Failed to create auth user' }, 400, headers);
  }

  const newUserId = createdUserData.user.id;

  try {
    const sourceProfileCopy = { ...sourceProfile };
    delete sourceProfileCopy.id;
    delete sourceProfileCopy.email;
    delete sourceProfileCopy.first_name;
    delete sourceProfileCopy.last_name;
    delete sourceProfileCopy.created_at;
    delete sourceProfileCopy.updated_at;

    const profileUpsertPayload = {
      ...sourceProfileCopy,
      id: newUserId,
      email: newUserEmail,
      first_name: newUserFirstName,
      last_name: newUserLastName,
      updated_at: new Date().toISOString(),
    };

    const { error: profileUpsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(profileUpsertPayload, { onConflict: 'id' });

    if (profileUpsertError) {
      throw new Error(`Failed to clone profile: ${profileUpsertError.message}`);
    }

    const roleRows = (sourceRoles || []).map((entry: any) => ({
      user_id: newUserId,
      role: entry.role,
      tenant_id: entry.tenant_id ?? null,
      franchise_id: entry.franchise_id ?? null,
      assigned_by: authCheck.user?.id ?? sourceUserId,
      assigned_at: new Date().toISOString(),
    }));

    if (roleRows.length > 0) {
      const { error: insertRolesError } = await supabaseAdmin
        .from('user_roles')
        .upsert(roleRows, { onConflict: 'user_id,role,tenant_id,franchise_id', ignoreDuplicates: true });
      if (insertRolesError) {
        throw new Error(`Failed to clone user roles: ${insertRolesError.message}`);
      }
    }

    const customRoleRows = (sourceCustomRoles || []).map((entry: any) => ({
      user_id: newUserId,
      role_id: entry.role_id,
      tenant_id: entry.tenant_id ?? null,
      franchise_id: entry.franchise_id ?? null,
      assigned_by: authCheck.user?.id ?? sourceUserId,
      assigned_at: new Date().toISOString(),
    }));

    if (customRoleRows.length > 0) {
      const { error: insertCustomRolesError } = await supabaseAdmin
        .from('user_custom_roles')
        .upsert(customRoleRows, { onConflict: 'user_id,role_id', ignoreDuplicates: true });
      if (insertCustomRolesError) {
        throw new Error(`Failed to clone user custom roles: ${insertCustomRolesError.message}`);
      }
    }

    await logger.info('User cloned from example user', {
      sourceUserId,
      newUserId,
      exampleUserEmail,
      newUserEmail,
      clonedRoles: roleRows.length,
      clonedCustomRoles: customRoleRows.length,
    });

    return jsonResponse({
      success: true,
      source_user_id: sourceUserId,
      new_user_id: newUserId,
      new_user_email: newUserEmail,
      cloned_user_roles: roleRows.length,
      cloned_user_custom_roles: customRoleRows.length,
    }, 200, headers);
  } catch (cloneError: any) {
    await logger.error('Clone flow failed. Rolling back new auth user.', {
      error: cloneError?.message || String(cloneError),
      newUserId,
    });
    await supabaseAdmin.auth.admin.deleteUser(newUserId);
    return jsonResponse({ error: cloneError?.message || 'Failed to clone user data' }, 400, headers);
  }
}, 'clone-user-from-example');

import { Logger } from '../_shared/logger.ts';
import { getCorsHeaders } from '../_shared/cors.ts';
import { requireAuth, createServiceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  const logger = new Logger({ function: 'export-data' });
  const headers = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  // Require authentication — this is a sensitive data export
  const { user, error: authError } = await requireAuth(req);
  if (authError || !user) {
    logger.error('Unauthorized export attempt', { error: authError });
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }

  try {
    // Verify user is a platform admin before allowing full export
    const serviceClient = createServiceClient();
    const { data: roleData, error: roleError } = await serviceClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'platform_admin')
      .maybeSingle();

    if (roleError || !roleData) {
      logger.error('Non-admin export attempt', { userId: user.id });
      return new Response(JSON.stringify({ error: 'Forbidden: platform_admin role required' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
    }

    logger.info(`Export initiated by platform admin: ${user.id}`);

    // List of tables to export
    const tables = [
      'tenants',
      'franchises',
      'profiles',
      'user_roles',
      'subscription_plans',
      'tenant_subscriptions',
      'service_types',
      'ports_locations',
      'currencies',
      'carriers',
      'services',
      'carrier_rates',
      'warehouses',
      'vehicles',
      'consignees',
      'accounts',
      'contacts',
      'campaigns',
      'leads',
      'opportunities',
      'opportunity_line_items',
      'activities',
      'quote_number_config_tenant',
      'quotes',
      'quote_items',
      'shipment_items',
      'shipments',
      'cargo_details',
      'tracking_events',
      'territory_assignments',
      'assignment_rules',
      'lead_assignment_history',
      'lead_assignment_queue',
      'emails',
      'email_templates',
      'audit_logs',
      'system_settings',
      'notifications',
      'user_custom_roles',
      'custom_roles',
      'roles_permissions',
      'custom_role_permissions',
      'user_capacity'
    ];

    const exportData: Record<string, any> = {};

    logger.info('Starting data export...');

    for (const table of tables) {
      try {
        logger.info(`Exporting table: ${table}`);
        const { data, error } = await serviceClient
          .from(table)
          .select('*')
          .limit(10000);

        if (error) {
          logger.error(`Error exporting ${table}`, { error });
          exportData[table] = { error: error.message };
        } else {
          exportData[table] = data || [];
          logger.info(`Exported ${data?.length || 0} rows from ${table}`);
        }
      } catch (err) {
        logger.error(`Exception exporting ${table}`, { error: err });
        exportData[table] = { error: String(err) };
      }
    }

    // Export auth users
    try {
      logger.info('Exporting auth users...');
      const { data: users, error } = await serviceClient.auth.admin.listUsers({
        perPage: 1000
      });

      if (error) {
        logger.error('Error exporting auth users', { error });
        exportData['auth_users'] = { error: error.message };
      } else {
        exportData['auth_users'] = users.users.map(u => ({
          id: u.id,
          email: u.email,
          phone: u.phone,
          created_at: u.created_at,
          updated_at: u.updated_at,
          email_confirmed_at: u.email_confirmed_at,
          phone_confirmed_at: u.phone_confirmed_at,
          last_sign_in_at: u.last_sign_in_at,
          user_metadata: u.user_metadata,
          role: u.role,
          aud: u.aud
        }));
        logger.info(`Exported ${users.users.length} auth users`);
      }
    } catch (err) {
      logger.error('Exception exporting auth users', { error: err });
      exportData['auth_users'] = { error: String(err) };
    }

    logger.info('Export complete!');

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    logger.error('Export failed', { error: String(error) });
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    });
  }
});

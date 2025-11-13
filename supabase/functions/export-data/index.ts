import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

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
    
    console.log('Starting data export...');
    
    for (const table of tables) {
      try {
        console.log(`Exporting table: ${table}`);
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(10000);
        
        if (error) {
          console.error(`Error exporting ${table}:`, error);
          exportData[table] = { error: error.message };
        } else {
          exportData[table] = data || [];
          console.log(`Exported ${data?.length || 0} rows from ${table}`);
        }
      } catch (err) {
        console.error(`Exception exporting ${table}:`, err);
        exportData[table] = { error: String(err) };
      }
    }

    // Export auth users
    try {
      console.log('Exporting auth users...');
      const { data: users, error } = await supabase.auth.admin.listUsers({
        perPage: 1000
      });
      
      if (error) {
        console.error('Error exporting auth users:', error);
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
        console.log(`Exported ${users.users.length} auth users`);
      }
    } catch (err) {
      console.error('Exception exporting auth users:', err);
      exportData['auth_users'] = { error: String(err) };
    }

    console.log('Export complete!');

    return new Response(JSON.stringify(exportData, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Export failed:', error);
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

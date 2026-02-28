// Script to inspect user roles
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function inspectRoles() {
  console.log('--- Inspecting User Roles ---');

  // Join user_roles table to get roles
  const { data: userRoles, error } = await supabase
    .from('user_roles')
    .select('user_id, role, tenant_id');

  if (error) {
    console.error('Error fetching user_roles:', error);
    return;
  }

  console.log(`Found ${userRoles.length} role assignments.`);
  
  const roles = new Set<string>();
  userRoles.forEach(r => {
    roles.add(r.role || 'no_role');
    console.log(`- User: ${r.user_id} | Role: ${r.role} | Tenant: ${r.tenant_id}`);
  });

  console.log('\nUnique Roles:', Array.from(roles));
}

inspectRoles();

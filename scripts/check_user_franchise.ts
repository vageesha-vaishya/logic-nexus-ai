
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkUserFranchise() {
  const tenantId = 'fbb1e554-6cf5-4091-b351-962db415efb2'; // Tenant001

  console.log(`Searching for users with tenant_id: ${tenantId} in user_roles...`);

  // Get user_ids from user_roles
  const { data: roles, error: rolesError } = await supabase
    .from('user_roles')
    .select('user_id, role, franchise_id')
    .eq('tenant_id', tenantId);

  if (rolesError) {
    console.error('Error fetching user_roles:', rolesError);
    return;
  }

  console.log(`Found ${roles.length} roles entries.`);

  const userIds = [...new Set(roles.map(r => r.user_id))];
  console.log(`Unique users: ${userIds.length}`);

  for (const userId of userIds) {
    const userRoles = roles.filter(r => r.user_id === userId);
    
    // Get profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email, first_name, last_name')
      .eq('id', userId)
      .single();

    const email = profile ? profile.email : 'Unknown Email';
    
    // Get preferences
    const { data: prefs, error: prefsError } = await supabase
      .from('user_preferences')
      .select('franchise_id')
      .eq('user_id', userId)
      .maybeSingle();

    console.log(`- User: ${email} (ID: ${userId})`);
    userRoles.forEach(r => console.log(`  Role: ${r.role}, Role Franchise: ${r.franchise_id}`));
    
    if (prefs) {
        console.log(`  Preference Franchise: ${prefs.franchise_id}`);
    } else {
        console.log('  No preferences found.');
    }
  }
}

checkUserFranchise();

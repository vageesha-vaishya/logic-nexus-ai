
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function seedMarginRules() {
  console.log('Seeding Margin Rules...');

  // 1. Get Tenant
  const { data: tenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .limit(1);

  if (tenantError) {
    console.error('Error fetching tenant:', tenantError);
    process.exit(1);
  }

  if (!tenants || tenants.length === 0) {
    console.error('No tenants found. Please create a tenant first.');
    process.exit(1);
  }

  const tenantId = tenants[0].id;
  console.log(`Using Tenant ID: ${tenantId}`);

  // 2. Define Rules
  const rules = [
    {
      tenant_id: tenantId,
      name: 'Standard Global Margin',
      adjustment_type: 'percent',
      adjustment_value: 15.0, // 15%
      condition_json: {}, // Applies to everything
      priority: 10
    },
    {
      tenant_id: tenantId,
      name: 'Air Freight Rush Fee',
      adjustment_type: 'fixed',
      adjustment_value: 50.0, // $50 flat
      condition_json: { service_type: 'air' },
      priority: 20
    },
    {
      tenant_id: tenantId,
      name: 'Small Packet Surcharge',
      adjustment_type: 'fixed',
      adjustment_value: 10.0,
      condition_json: { service_type: 'courier' },
      priority: 20
    }
  ];

  // 3. Insert Rules (Delete existing with same names first)
  const names = rules.map(r => r.name);
  await supabase
    .from('margin_rules')
    .delete()
    .eq('tenant_id', tenantId)
    .in('name', names);

  const { data, error } = await supabase
    .from('margin_rules')
    .insert(rules)
    .select();

  if (error) {
    console.error('Error inserting margin rules:', error);
    process.exit(1);
  }

  console.log('Successfully seeded margin rules:');
  data.forEach(rule => {
    console.log(`- ${rule.name}: ${rule.adjustment_type} ${rule.adjustment_value} (Conditions: ${JSON.stringify(rule.condition_json)})`);
  });
}

seedMarginRules();

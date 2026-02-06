
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env vars
dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gzhxgoigflftharcmdqj.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aHhnb2lnZmxmdGhhcmNtZHFqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTUxOTY4NywiZXhwIjoyMDg1MDk1Njg3fQ.MImJoQhZUG2lSQ9PpN0z1QwDI1nvA2AsYPOeVfDGMos';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// --- PricingService Logic (Mirrored) ---

async function getMarginRules(client) {
  const { data, error } = await client
    .from('margin_rules')
    .select('*')
    .order('priority', { ascending: false });

  if (error) {
    console.error('Failed to fetch margin rules', error);
    return [];
  }
  return data || [];
}

async function resolveMarginRules(client, context) {
  const rules = await getMarginRules(client);
  const applicableRules = [];

  for (const rule of rules) {
    let match = true;
    for (const [key, value] of Object.entries(rule.condition_json)) {
      if (context[key] != value) {
        match = false;
        break;
      }
    }
    if (match) {
      applicableRules.push(rule);
    }
  }
  return applicableRules;
}

async function calculatePriceWithRules(client, cost, context) {
  const rules = await resolveMarginRules(client, context);
  let sellPrice = cost;
  const appliedRuleNames = [];

  for (const rule of rules) {
    if (rule.adjustment_type === 'percent') {
       sellPrice += sellPrice * (Number(rule.adjustment_value) / 100);
    } else if (rule.adjustment_type === 'fixed') {
       sellPrice += Number(rule.adjustment_value);
    }
    appliedRuleNames.push(rule.name);
  }
  
  const marginAmount = sellPrice - cost;

  return {
    sellPrice: Number(sellPrice.toFixed(2)),
    buyPrice: cost,
    marginAmount: Number(marginAmount.toFixed(2)),
    appliedRules: appliedRuleNames
  };
}

// --- Verification Logic ---

async function verifyMarginRules() {
  console.log('Starting Margin Rules Verification...');
  let tenantId = null;
  let ruleIds = [];

  try {
    // 1. Get or Create Tenant
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .limit(1);

    if (tenantError) throw new Error(`Tenant fetch failed: ${tenantError.message}`);
    
    if (tenants && tenants.length > 0) {
      tenantId = tenants[0].id;
      console.log(`Using Existing Tenant ID: ${tenantId}`);
    } else {
      console.log('No tenants found. Creating dummy tenant...');
      const dummySlug = `test-tenant-${Date.now()}`;
      const dummyStripeId = `cus_${Date.now()}`;
      
      const { data: newTenant, error: createError } = await supabase
        .from('tenants')
        .insert({
          name: 'Margin Rule Test Tenant',
          slug: dummySlug,
          stripe_customer_id: dummyStripeId,
          domain_type: 'LOGISTICS'
        })
        .select()
        .single();
      
      if (createError) throw new Error(`Tenant creation failed: ${createError.message}`);
      tenantId = newTenant.id;
      console.log(`Created New Tenant ID: ${tenantId}`);
    }

    // 2. Insert Test Margin Rules
    // Rule 1: FCL -> +10%
    // Rule 2: Air -> +20 Fixed
    const rules = [
      {
        tenant_id: tenantId,
        name: 'Test FCL Markup 10%',
        condition_json: { service_type: 'FCL' },
        adjustment_type: 'percent',
        adjustment_value: 10,
        priority: 10
      },
      {
        tenant_id: tenantId,
        name: 'Test Air Fee $20',
        condition_json: { service_type: 'Air' },
        adjustment_type: 'fixed',
        adjustment_value: 20,
        priority: 5
      }
    ];

    console.log('Inserting margin rules...');
    const { data: insertedRules, error: ruleError } = await supabase
      .from('margin_rules')
      .insert(rules)
      .select();

    if (ruleError) throw new Error(`Rule insertion failed: ${ruleError.message}`);
    console.log('Margin rules inserted.');
    ruleIds = insertedRules.map(r => r.id);

    // 3. Verify Calculation for FCL
    console.log('Testing FCL Calculation (Cost: 100, Expect: 110)...');
    const fclResult = await calculatePriceWithRules(supabase, 100, { service_type: 'FCL' });
    console.log('FCL Result:', fclResult);

    if (fclResult.sellPrice === 110 && fclResult.appliedRules.includes('Test FCL Markup 10%')) {
      console.log('PASS: FCL Calculation correct.');
    } else {
      console.error('FAIL: FCL Calculation incorrect.');
    }

    // 4. Verify Calculation for Air
    console.log('Testing Air Calculation (Cost: 100, Expect: 120)...');
    const airResult = await calculatePriceWithRules(supabase, 100, { service_type: 'Air' });
    console.log('Air Result:', airResult);

    if (airResult.sellPrice === 120 && airResult.appliedRules.includes('Test Air Fee $20')) {
      console.log('PASS: Air Calculation correct.');
    } else {
      console.error('FAIL: Air Calculation incorrect.');
    }

    // 5. Verify Calculation for No Match
    console.log('Testing No Match Calculation (Cost: 100, Expect: 100)...');
    const noneResult = await calculatePriceWithRules(supabase, 100, { service_type: 'Truck' });
    console.log('No Match Result:', noneResult);

    if (noneResult.sellPrice === 100 && noneResult.appliedRules.length === 0) {
      console.log('PASS: No Match Calculation correct.');
    } else {
      console.error('FAIL: No Match Calculation incorrect.');
    }

  } catch (err) {
    console.error('Verification Failed:', err);
  } finally {
    // Cleanup
    if (ruleIds.length > 0) {
      console.log('Cleaning up rules...');
      await supabase.from('margin_rules').delete().in('id', ruleIds);
      console.log('Cleanup done.');
    }
  }
}

verifyMarginRules();


import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Helper to load env (copied from test-edge-function.js)
function loadEnvFromConfig() {
  const configPath = path.join(process.cwd(), 'supabase', 'migration-package', 'new-supabase-config.env');
  if (!fs.existsSync(configPath)) return {};
  const result = {};
  try {
    const lines = fs.readFileSync(configPath, 'utf-8')
      .split('\n')
      .filter(line => line && !line.trim().startsWith('#') && line.includes('='));
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      result[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
    }
  } catch (e) {
    console.warn('Could not read config file:', e.message);
  }
  return {
    VITE_SUPABASE_URL: result.NEW_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: result.VITE_SUPABASE_PUBLISHABLE_KEY || result.NEW_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: result.SUPABASE_SERVICE_ROLE_KEY || result.NEW_SUPABASE_SERVICE_ROLE_KEY,
  };
}

const envFromConfig = loadEnvFromConfig();
const projectUrl = process.env.VITE_SUPABASE_URL || envFromConfig.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envFromConfig.VITE_SUPABASE_PUBLISHABLE_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envFromConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!projectUrl || !serviceRoleKey) {
  console.error('Error: Supabase URL or Service Role Key not found.');
  process.exit(1);
}

const supabase = createClient(projectUrl, serviceRoleKey);

console.log(`Testing Multi-Modal Flows on: ${projectUrl}`);

async function testAiAdvisor() {
  console.log('\n--- Testing AI Advisor ---');

  // 1. Lookup Codes: Ocean (Ports)
  console.log('1. Testing Ocean Port Lookup (Shanghai)...');
  const { data: oceanData, error: oceanError } = await supabase.functions.invoke('ai-advisor', {
    body: {
      action: 'lookup_codes',
      payload: { query: 'Shanghai', mode: 'ocean' }
    }
  });
  if (oceanError) console.error('❌ Ocean Lookup Error:', oceanError);
  else console.log('✅ Ocean Lookup Result:', oceanData?.suggestions?.length > 0 ? 'Success' : 'No results', oceanData?.suggestions?.[0]);

  // 2. Lookup Codes: Air (Airports)
  console.log('2. Testing Air Airport Lookup (London)...');
  const { data: airData, error: airError } = await supabase.functions.invoke('ai-advisor', {
    body: {
      action: 'lookup_codes',
      payload: { query: 'London', mode: 'air' }
    }
  });
  if (airError) console.error('❌ Air Lookup Error:', airError);
  else console.log('✅ Air Lookup Result:', airData?.suggestions?.length > 0 ? 'Success' : 'No results', airData?.suggestions?.[0]);

  // 3. Validate Compliance: Dangerous Goods
  console.log('3. Testing Compliance Validation (Lithium Batteries via Air)...');
  const { data: complianceData, error: complianceError } = await supabase.functions.invoke('ai-advisor', {
    body: {
      action: 'validate_compliance',
      payload: { 
        origin: 'CNSHA', 
        destination: 'USLAX', 
        commodity: 'Lithium Batteries', 
        mode: 'air', 
        dangerous_goods: true 
      }
    }
  });
  if (complianceError) console.error('❌ Compliance Error:', complianceError);
  else console.log('✅ Compliance Result:', JSON.stringify(complianceData, null, 2));
}

async function testRateEngine() {
  console.log('\n--- Testing Rate Engine ---');

  // 1. Ocean Rate
  console.log('1. Testing Ocean Rate (2x 40ft Containers)...');
  const { data: oceanRate, error: oceanRateError } = await supabase.functions.invoke('rate-engine', {
    body: {
      origin: 'CNSHA',
      destination: 'USLAX',
      mode: 'ocean',
      containerQty: 2,
      containerSize: '40ft'
    }
  });
  if (oceanRateError) console.error('❌ Ocean Rate Error:', oceanRateError);
  else {
    console.log('Ocean Rate Response:', oceanRate);
    if (oceanRate?.options && Array.isArray(oceanRate.options)) {
      const marketOption = oceanRate.options.find((r) => r.id === 'mkt_std');
      console.log('✅ Ocean Rate Result:', marketOption ? `$${marketOption.price}` : 'No market rate');
    } else {
      console.error('❌ Ocean Rate is not an array');
    }
  }

  // 2. Air Rate
  console.log('2. Testing Air Rate (500kg)...');
  const { data: airRate, error: airRateError } = await supabase.functions.invoke('rate-engine', {
    body: {
      origin: 'LHR',
      destination: 'JFK',
      mode: 'air',
      weight: 500
    }
  });
  if (airRateError) console.error('❌ Air Rate Error:', airRateError);
  else {
    const marketOption = airRate?.options?.find((r) => r.id === 'mkt_std');
    console.log('✅ Air Rate Result:', marketOption ? `$${marketOption.price}` : 'No market rate');
  }

  // 3. Road Rate
  console.log('3. Testing Road Rate (Reefer)...');
  const { data: roadRate, error: roadRateError } = await supabase.functions.invoke('rate-engine', {
    body: {
      origin: 'Berlin',
      destination: 'Paris',
      mode: 'road',
      vehicleType: 'reefer'
    }
  });
  if (roadRateError) console.error('❌ Road Rate Error:', roadRateError);
  else {
    const marketOption = roadRate?.options?.find((r) => r.id === 'mkt_std');
    console.log('✅ Road Rate Result:', marketOption ? `$${marketOption.price}` : 'No market rate');
  }
}

async function runTests() {
  await testAiAdvisor();
  await testRateEngine();
}

runTests().catch(console.error);

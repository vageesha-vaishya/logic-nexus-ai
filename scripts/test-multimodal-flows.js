
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

  // 3. Lookup Codes: Rail (Terminals)
  console.log('3. Testing Rail Terminal Lookup (Xi\'an)...');
  const { data: railData, error: railError } = await supabase.functions.invoke('ai-advisor', {
    body: {
      action: 'lookup_codes',
      payload: { query: 'Xi\'an', mode: 'rail' }
    }
  });
  if (railError) console.error('❌ Rail Lookup Error:', railError);
  else console.log('✅ Rail Lookup Result:', railData?.suggestions?.length > 0 ? 'Success' : 'No results', railData?.suggestions?.[0]);

  // 4. Validate Compliance: Dangerous Goods
  console.log('4. Testing Compliance Validation (Lithium Batteries via Air)...');
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
    if (oceanRate?.options && Array.isArray(oceanRate.options) && oceanRate.options.length > 0) {
      const option = oceanRate.options[0];
      console.log(`✅ Ocean Rate Result: $${option.price} (${option.carrier})`);
    } else {
      console.error('❌ Ocean Rate options not found or empty');
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
    if (airRate?.options && Array.isArray(airRate.options) && airRate.options.length > 0) {
      const option = airRate.options[0];
      console.log(`✅ Air Rate Result: $${option.price} (${option.carrier})`);
    } else {
      console.log('❌ Air Rate options not found');
    }
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
    if (roadRate?.options && Array.isArray(roadRate.options) && roadRate.options.length > 0) {
      const option = roadRate.options[0];
      console.log(`✅ Road Rate Result: $${option.price} (${option.carrier})`);
    } else {
      console.log('❌ Road Rate options not found');
    }
  }

  // 4. Rail Rate
  console.log('4. Testing Rail Rate (40ft Container)...');
  const { data: railRate, error: railRateError } = await supabase.functions.invoke('rate-engine', {
    body: {
      origin: 'Berlin',
      destination: 'Beijing',
      mode: 'rail',
      containerQty: 1,
      containerSize: '40ft'
    }
  });
  if (railRateError) console.error('❌ Rail Rate Error:', railRateError);
  else {
    if (railRate?.options && Array.isArray(railRate.options) && railRate.options.length > 0) {
      const option = railRate.options[0];
      console.log(`✅ Rail Rate Result: $${option.price} (${option.carrier})`);
    } else {
      console.log('❌ Rail Rate options not found');
    }
  }
}

async function runTests() {
  await testAiAdvisor();
  await testRateEngine();
}

runTests().catch(console.error);

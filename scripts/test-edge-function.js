
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

function loadEnvFromConfig() {
  const configPath = path.join(process.cwd(), 'supabase', 'migration-package', 'new-supabase-config.env');
  if (!fs.existsSync(configPath)) return {};
  const result = {};
  const lines = fs.readFileSync(configPath, 'utf-8')
    .split('\n')
    .filter(line => line && !line.trim().startsWith('#') && line.includes('='));
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    result[key.trim()] = rest.join('=').trim().replace(/^["']|["']$/g, '');
  }
  return {
    VITE_SUPABASE_URL: result.NEW_SUPABASE_URL,
    VITE_SUPABASE_PUBLISHABLE_KEY: result.VITE_SUPABASE_PUBLISHABLE_KEY || result.NEW_SUPABASE_ANON_KEY,
  };
}

const envFromConfig = loadEnvFromConfig();

const projectUrl = process.env.VITE_SUPABASE_URL || envFromConfig.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || envFromConfig.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!projectUrl || !anonKey) {
  console.error('Error: Supabase URL or anon key not found. Configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY or new-supabase-config.env');
  process.exit(1);
}

console.log(`Testing connection to Supabase project: ${projectUrl}`);

const supabase = createClient(projectUrl, anonKey);

async function testFunction() {
  console.log('Invoking execute-sql-external function...');
  
  const functionUrl = `${projectUrl}/functions/v1/execute-sql-external`;
  
  try {
    // Method 1: Direct fetch (to check headers/CORS/raw response)
    console.log(`\n--- Direct Fetch Test (${functionUrl}) ---`);
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'test',
        connection: {
          host: 'test-host',
          database: 'test-db',
          user: 'test-user',
          password: 'test-password'
        }
      })
    });
    
    console.log(`Status: ${response.status} ${response.statusText}`);
    try {
        const text = await response.text();
        console.log('Response body:', text.substring(0, 500) + (text.length > 500 ? '...' : ''));
    } catch (e) {
        console.log('Could not read response body');
    }

    if (response.ok) {
        console.log('✅ Direct fetch successful (Function is reachable)');
    } else {
        console.log('❌ Direct fetch failed');
    }

  } catch (err) {
    console.error('❌ Direct fetch error:', err.message);
  }

  // Method 2: Supabase Client Invoke
  console.log('\n--- Supabase Client Invoke Test ---');
  const { data, error } = await supabase.functions.invoke('execute-sql-external', {
    body: {
        action: 'test',
        connection: {
          host: 'test-host',
          database: 'test-db',
          user: 'test-user',
          password: 'test-password'
        }
    }
  });

  if (error) {
    console.error('❌ Client invoke error:', error);
  } else {
    console.log('✅ Client invoke success (Data received):', data);
  }
}

testFunction();

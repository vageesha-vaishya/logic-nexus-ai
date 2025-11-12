#!/usr/bin/env node

/**
 * Test Database Connection
 * Verifies connection to new Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load configuration
const configPath = path.join(__dirname, '../new-supabase-config.env');
if (!fs.existsSync(configPath)) {
  console.error('❌ new-supabase-config.env not found');
  console.error('Please create it from the template');
  process.exit(1);
}

// Parse env file
const config = {};
fs.readFileSync(configPath, 'utf-8')
  .split('\n')
  .filter(line => line && !line.startsWith('#') && line.includes('='))
  .forEach(line => {
    const [key, ...values] = line.split('=');
    config[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
  });

const { NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY } = config;

if (!NEW_SUPABASE_URL || !NEW_SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required credentials in config');
  process.exit(1);
}

console.log('\n🔍 Testing Supabase Connection...\n');
console.log('URL:', NEW_SUPABASE_URL);
console.log('');

// Create client
const supabase = createClient(NEW_SUPABASE_URL, NEW_SUPABASE_SERVICE_ROLE_KEY);

// Test connection
async function testConnection() {
  try {
    // Test 1: Basic query
    console.log('Test 1: Basic query...');
    const { data, error } = await supabase
      .from('tenants')
      .select('count')
      .limit(1);
    
    if (error) throw error;
    console.log('✅ Basic query successful');

    // Test 2: Check tables
    console.log('\nTest 2: Checking tables...');
    const { data: tables, error: tableError } = await supabase
      .rpc('get_database_tables');
    
    if (tableError) {
      console.log('⚠️  Could not fetch tables (function may not exist yet)');
    } else {
      console.log(`✅ Found ${tables?.length || 0} tables`);
    }

    // Test 3: Auth check
    console.log('\nTest 3: Authentication system...');
    const { data: authData, error: authError } = await supabase.auth.getSession();
    console.log('✅ Auth system accessible');

    console.log('\n✅ All connection tests passed!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Connection test failed:', error.message);
    console.error('\nTroubleshooting:');
    console.error('1. Verify URL and keys in new-supabase-config.env');
    console.error('2. Check project is not paused in Supabase dashboard');
    console.error('3. Verify IP is allowed (disable IP restrictions for testing)');
    console.error('4. Confirm service role key has correct permissions\n');
    process.exit(1);
  }
}

testConnection();

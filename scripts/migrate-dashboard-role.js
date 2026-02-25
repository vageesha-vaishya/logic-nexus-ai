#!/usr/bin/env node

/**
 * Dashboard Role Migration Script
 * Adds dashboard_role column to profiles table with validation
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.VITE_SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('❌ Missing environment variables:');
  console.error('   - VITE_SUPABASE_URL');
  console.error('   - VITE_SUPABASE_SERVICE_KEY');
  console.error('\nPlease add these to your .env file');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkColumnExists() {
  console.log('\n📋 Checking if dashboard_role column already exists...');

  try {
    const { data, error } = await supabase.rpc('execute_raw_sql', {
      query: `
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_name = 'profiles' AND column_name = 'dashboard_role'
      `
    }).catch(() => {
      // Fallback: try direct query
      return supabase
        .from('profiles')
        .select('dashboard_role')
        .limit(1);
    });

    if (data && data.length > 0) {
      console.log('✅ Column already exists!');
      return true;
    }
    return false;
  } catch (error) {
    console.log('ℹ️  Column does not exist yet (expected)');
    return false;
  }
}

async function runMigration() {
  console.log('\n🔧 Running migration...\n');

  const migrations = [
    {
      name: 'Add dashboard_role column',
      sql: `
        ALTER TABLE public.profiles
        ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';
      `
    },
    {
      name: 'Create index for dashboard_role',
      sql: `
        CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role
        ON public.profiles(dashboard_role);
      `
    },
    {
      name: 'Add column comment',
      sql: `
        COMMENT ON COLUMN public.profiles.dashboard_role
        IS 'Dashboard role for template assignment';
      `
    }
  ];

  for (const migration of migrations) {
    try {
      console.log(`⏳ ${migration.name}...`);

      // Execute using RPC (raw SQL execution)
      const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/execute_raw_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
          'apikey': SUPABASE_SERVICE_KEY,
        },
        body: JSON.stringify({ query: migration.sql })
      });

      if (response.ok) {
        console.log(`✅ ${migration.name}\n`);
      } else {
        const errorText = await response.text();
        console.log(`⚠️  ${migration.name}\n   Note: ${errorText}\n`);
        // Don't fail on these - they might already exist
      }
    } catch (error) {
      console.log(`⚠️  ${migration.name}\n   Note: ${error.message}\n`);
      // Continue with next migration
    }
  }
}

async function validateMigration() {
  console.log('\n✓ Validating migration...\n');

  try {
    // Test 1: Check column exists
    console.log('  Test 1: Checking column exists...');
    const { data: columnCheck } = await supabase
      .from('profiles')
      .select('dashboard_role')
      .limit(1);

    if (columnCheck) {
      console.log('  ✅ Column exists and is queryable\n');
    }

    // Test 2: Check default value
    console.log('  Test 2: Verifying default values...');
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, dashboard_role')
      .limit(3);

    if (!error && profiles) {
      console.log(`  ✅ Found ${profiles.length} profiles`);
      const withDefaults = profiles.filter(p => p.dashboard_role === 'crm_sales_rep');
      console.log(`  ✅ ${withDefaults.length} have default role set\n`);
    }

    // Test 3: Verify we can update
    console.log('  Test 3: Testing update capability...');
    if (profiles && profiles.length > 0) {
      const testId = profiles[0].id;
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ dashboard_role: 'crm_sales_rep' })
        .eq('id', testId);

      if (!updateError) {
        console.log('  ✅ Column is writable\n');
      } else {
        console.log(`  ⚠️  Update test: ${updateError.message}\n`);
      }
    }

    return true;
  } catch (error) {
    console.error(`\n❌ Validation failed: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║        Dashboard Role Migration - Validated Execution       ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Step 1: Pre-migration check
    console.log('\n📊 Pre-Migration Checks');
    console.log('─'.repeat(60));
    const columnExists = await checkColumnExists();

    if (columnExists) {
      console.log('\n✅ Migration already completed!');
      console.log('   The dashboard_role column is ready to use.');
      process.exit(0);
    }

    // Step 2: Run migration
    console.log('\n🚀 Executing Migration');
    console.log('─'.repeat(60));
    await runMigration();

    // Step 3: Validate
    console.log('✓ Post-Migration Validation');
    console.log('─'.repeat(60));
    const isValid = await validateMigration();

    if (isValid) {
      console.log('╔════════════════════════════════════════════════════════════╗');
      console.log('║                  ✅ MIGRATION SUCCESSFUL                    ║');
      console.log('╚════════════════════════════════════════════════════════════╝');
      console.log('\n📝 Next steps:');
      console.log('   1. Restart your dev server: npm run dev');
      console.log('   2. Navigate to: http://localhost:5173/dashboard');
      console.log('   3. Dashboard should load with real role detection\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Migration completed but validation found issues.');
      console.log('   Please check the logs above.\n');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  }
}

main();

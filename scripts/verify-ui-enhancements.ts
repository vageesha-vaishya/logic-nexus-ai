// Script to verify quotation enhancements in UI
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyUIEnhancements() {
  console.log('--- Verifying UI Visibility and Configuration ---');

  // 1. Check Default Configuration
  console.log('\n1. Checking Default Configuration...');
  const { data: configs, error: configError } = await supabase
    .from('quotation_configuration')
    .select('*');
  
  if (configError) {
    console.error('FAIL: Could not fetch quotation_configuration:', configError.message);
  } else {
    console.log(`SUCCESS: Found ${configs?.length || 0} configuration records.`);
    if (configs && configs.length > 0) {
      console.log('   Default Module:', configs[0].default_module);
      console.log('   Smart Mode Enabled:', configs[0].smart_mode_enabled);
      console.log('   Multi-Option Enabled:', configs[0].multi_option_enabled);
    } else {
      console.warn('WARN: No configuration records found. UI might fallback to defaults.');
    }
  }

  // 2. Check User Preferences (Smart Mode)
  console.log('\n2. Checking User Preferences...');
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, quotation_preferences')
    .limit(5);

  if (profileError) {
    console.error('FAIL: Could not fetch profiles:', profileError.message);
  } else {
    console.log(`SUCCESS: Checked ${profiles?.length} profiles.`);
    profiles?.forEach(p => {
        const prefs = p.quotation_preferences as any;
        console.log(`   User ${p.id.slice(0,8)}... Smart Mode: ${prefs?.smart_mode_active ?? 'Not Set'}`);
    });
  }

  // 3. Check Quotation Options (Multi-Option Data)
  console.log('\n3. Checking Quotation Options Data...');
  const { data: options, error: optionsError } = await supabase
    .from('quotation_version_options')
    .select('id, rank_score, is_recommended')
    .not('rank_score', 'is', null)
    .limit(5);

  if (optionsError) {
    console.error('FAIL: Could not fetch quotation options:', optionsError.message);
  } else {
    console.log(`SUCCESS: Found ${options?.length} ranked options.`);
    if (options && options.length > 0) {
        console.log('   Data visibility confirmed for Comparison Dashboard.');
    } else {
        console.warn('WARN: No ranked options found. Comparison Dashboard might be empty.');
    }
  }

  console.log('\n--- Verification Complete ---');
}

verifyUIEnhancements();

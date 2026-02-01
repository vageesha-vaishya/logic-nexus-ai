
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyAuditTriggers() {
  console.log('Starting Audit Trigger Verification...');

  const testKey = 'audit_test_domain';
  let domainId;

  try {
    // 1. INSERT
    console.log('\n1. Testing INSERT operation...');
    const { data: insertData, error: insertError } = await supabase
      .from('platform_domains')
      .insert({
        key: testKey,
        name: 'Audit Test Domain',
        description: 'Temporary domain for audit testing',
        owner: 'System',
        status: 'active'
      })
      .select()
      .single();

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);
    domainId = insertData.id;
    console.log(`   Inserted domain with ID: ${domainId}`);

    // Wait a bit to ensure log is written (though it's in the same transaction usually)
    await new Promise(r => setTimeout(r, 1000));

    // Verify INSERT log
    const { data: insertLogs, error: insertLogError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', 'platform_domains')
      .eq('resource_id', domainId)
      .eq('action', 'INSERT');

    if (insertLogError) throw new Error(`Fetch insert log failed: ${insertLogError.message}`);
    
    if (insertLogs && insertLogs.length > 0) {
        console.log(`   ✅ Audit log for INSERT found: ${insertLogs[0].id}`);
        console.log(`      Details:`, JSON.stringify(insertLogs[0].details).substring(0, 100) + '...');
    } else {
        console.error(`   ❌ No audit log found for INSERT`);
    }

    // 2. UPDATE
    console.log('\n2. Testing UPDATE operation...');
    const { error: updateError } = await supabase
      .from('platform_domains')
      .update({ description: 'Updated description for audit test' })
      .eq('id', domainId);

    if (updateError) throw new Error(`Update failed: ${updateError.message}`);
    console.log(`   Updated domain ${domainId}`);

    await new Promise(r => setTimeout(r, 1000));

    // Verify UPDATE log
    const { data: updateLogs, error: updateLogError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', 'platform_domains')
      .eq('resource_id', domainId)
      .eq('action', 'UPDATE');

    if (updateLogError) throw new Error(`Fetch update log failed: ${updateLogError.message}`);

    if (updateLogs && updateLogs.length > 0) {
        console.log(`   ✅ Audit log for UPDATE found: ${updateLogs[0].id}`);
        console.log(`      Details:`, JSON.stringify(updateLogs[0].details).substring(0, 100) + '...');
    } else {
        console.error(`   ❌ No audit log found for UPDATE`);
    }

    // 3. DELETE
    console.log('\n3. Testing DELETE operation...');
    const { error: deleteError } = await supabase
      .from('platform_domains')
      .delete()
      .eq('id', domainId);

    if (deleteError) throw new Error(`Delete failed: ${deleteError.message}`);
    console.log(`   Deleted domain ${domainId}`);

    await new Promise(r => setTimeout(r, 1000));

    // Verify DELETE log
    const { data: deleteLogs, error: deleteLogError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('resource_type', 'platform_domains')
      .eq('resource_id', domainId)
      .eq('action', 'DELETE');

    if (deleteLogError) throw new Error(`Fetch delete log failed: ${deleteLogError.message}`);

    if (deleteLogs && deleteLogs.length > 0) {
        console.log(`   ✅ Audit log for DELETE found: ${deleteLogs[0].id}`);
        console.log(`      Details:`, JSON.stringify(deleteLogs[0].details).substring(0, 100) + '...');
    } else {
        console.error(`   ❌ No audit log found for DELETE`);
    }

  } catch (err) {
    console.error('Verification failed:', err);
  } finally {
    // Cleanup if needed (though DELETE test should handle it)
    if (domainId) {
        // Ensure it's gone
        await supabase.from('platform_domains').delete().eq('id', domainId);
        
        // Optional: Clean up audit logs created during test to avoid clutter
        // await supabase.from('audit_logs').delete().eq('resource_id', domainId);
    }
  }
}

verifyAuditTriggers();

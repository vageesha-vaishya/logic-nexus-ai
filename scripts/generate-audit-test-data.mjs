/**
 * Generate 10k+ test audit logs for performance testing
 * Usage: node scripts/generate-audit-test-data.mjs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Try .env.local first, then .env
dotenv.config({ path: '.env.local' });
if (!process.env.VITE_SUPABASE_URL) {
  dotenv.config({ path: '.env' });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Sample data
const RESOURCE_TYPES = ['lead', 'contact', 'opportunity', 'quote', 'invoice', 'interaction'];
const ACTIONS = ['create', 'update', 'delete', 'view', 'approve', 'reject', 'move', 'merge'];

// Get a real user ID for testing (or use NULL for system events)
async function getTestUserId() {
  const { data, error } = await supabase.auth.admin.listUsers();
  if (error || !data.users?.length) {
    console.warn('No users found, using NULL for user_id');
    return null;
  }
  return data.users[0].id;
}

// Generate random date within last 30 days
function getRandomDate() {
  const now = new Date();
  const days = Math.floor(Math.random() * 30);
  const hours = Math.floor(Math.random() * 24);
  const minutes = Math.floor(Math.random() * 60);
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hours, minutes, 0, 0);
  return date.toISOString();
}

// Generate test audit log entries
function generateAuditLogs(count, userId) {
  const logs = [];
  for (let i = 0; i < count; i++) {
    logs.push({
      user_id: userId,
      action: ACTIONS[Math.floor(Math.random() * ACTIONS.length)],
      resource_type: RESOURCE_TYPES[Math.floor(Math.random() * RESOURCE_TYPES.length)],
      resource_id: `test-resource-${Math.floor(Math.random() * 1000)}`,
      details: {
        entity_id: `entity-${Math.floor(Math.random() * 500)}`,
        field_changed: `field_${Math.floor(Math.random() * 10)}`,
        old_value: Math.random().toString(36).substring(7),
        new_value: Math.random().toString(36).substring(7),
      },
      created_at: getRandomDate(),
    });
  }
  return logs;
}

// Batch insert logs (Supabase has request size limits)
async function insertLogsInBatches(logs, batchSize = 1000) {
  let inserted = 0;
  for (let i = 0; i < logs.length; i += batchSize) {
    const batch = logs.slice(i, i + batchSize);
    console.log(`Inserting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(logs.length / batchSize)}...`);

    const { error, data } = await supabase.from('audit_logs').insert(batch);
    if (error) {
      console.error(`Error inserting batch:`, error);
      // Continue with next batch despite errors
    } else {
      inserted += batch.length;
      console.log(`  Inserted ${inserted}/${logs.length} logs`);
    }
  }
  return inserted;
}

async function main() {
  try {
    console.log('Starting audit log generation...');

    // Get a test user
    const userId = await getTestUserId();

    // Generate 10,000 test logs
    const COUNT = 10000;
    console.log(`Generating ${COUNT} test audit logs...`);
    const logs = generateAuditLogs(COUNT, userId);

    // Insert in batches
    const inserted = await insertLogsInBatches(logs);
    console.log(`\n✓ Successfully inserted ${inserted} audit logs`);

    // Verify count
    const { count, error: countError } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true });

    if (!countError) {
      console.log(`Total audit logs in database: ${count}`);
    }

  } catch (error) {
    console.error('Fatal error:', error);
    process.exit(1);
  }
}

main();

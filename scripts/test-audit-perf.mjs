/**
 * Performance Test: Measure audit log query performance
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load env
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testQueryPerformance() {
  console.log('Starting performance test...\n');

  // Test 1: Basic query (all audit logs with limit)
  console.log('Test 1: Basic query (SELECT * LIMIT 500)');
  const start1 = performance.now();
  const { data: data1, error: err1 } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  const time1 = performance.now() - start1;

  if (err1) {
    console.error('  Error:', err1.message);
  } else {
    console.log(`  ✓ Returned ${data1?.length || 0} rows`);
    console.log(`  ⏱️  Query time: ${time1.toFixed(2)}ms`);
  }
  console.log();

  // Test 2: Filtered query (by resource type)
  console.log('Test 2: Filtered query (resource_type = "lead" LIMIT 500)');
  const start2 = performance.now();
  const { data: data2, error: err2 } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_type', 'lead')
    .order('created_at', { ascending: false })
    .limit(500);
  const time2 = performance.now() - start2;

  if (err2) {
    console.error('  Error:', err2.message);
  } else {
    console.log(`  ✓ Returned ${data2?.length || 0} rows`);
    console.log(`  ⏱️  Query time: ${time2.toFixed(2)}ms`);
  }
  console.log();

  // Test 3: Double filtered query (resource type + action)
  console.log('Test 3: Double filtered query (resource_type = "lead" AND action = "create")');
  const start3 = performance.now();
  const { data: data3, error: err3 } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('resource_type', 'lead')
    .eq('action', 'create')
    .order('created_at', { ascending: false })
    .limit(500);
  const time3 = performance.now() - start3;

  if (err3) {
    console.error('  Error:', err3.message);
  } else {
    console.log(`  ✓ Returned ${data3?.length || 0} rows`);
    console.log(`  ⏱️  Query time: ${time3.toFixed(2)}ms`);
  }
  console.log();

  // Test 4: Count query
  console.log('Test 4: Count total audit logs');
  const start4 = performance.now();
  const { count, error: err4 } = await supabase
    .from('audit_logs')
    .select('*', { count: 'exact', head: true });
  const time4 = performance.now() - start4;

  if (err4) {
    console.error('  Error:', err4.message);
  } else {
    console.log(`  ✓ Total audit logs: ${count}`);
    console.log(`  ⏱️  Query time: ${time4.toFixed(2)}ms`);
  }
  console.log();

  // Test 5: Count by resource type
  console.log('Test 5: Count logs by resource type');
  const resourceTypes = ['lead', 'contact', 'opportunity', 'quote', 'invoice', 'interaction'];
  for (const type of resourceTypes) {
    const start = performance.now();
    const { count, error } = await supabase
      .from('audit_logs')
      .select('*', { count: 'exact', head: true })
      .eq('resource_type', type);
    const time = performance.now() - start;

    if (error) {
      console.log(`  ${type}: Error - ${error.message}`);
    } else {
      console.log(`  ${type}: ${count} logs (${time.toFixed(2)}ms)`);
    }
  }
  console.log();

  // Test 6: Repeated queries (simulating real dashboard usage)
  console.log('Test 6: Rapid successive queries (5x)');
  const times = [];
  for (let i = 0; i < 5; i++) {
    const start = performance.now();
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500);
    const time = performance.now() - start;
    times.push(time);
    console.log(`  Query ${i + 1}: ${time.toFixed(2)}ms`);
  }
  const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
  console.log(`  Average: ${avgTime.toFixed(2)}ms`);
  console.log();

  // Summary
  console.log('=== PERFORMANCE SUMMARY ===');
  console.log(`Test 1 (basic):     ${time1.toFixed(2)}ms`);
  console.log(`Test 2 (filtered):  ${time2.toFixed(2)}ms`);
  console.log(`Test 3 (d-filter):  ${time3.toFixed(2)}ms`);
  console.log(`Test 4 (count):     ${time4.toFixed(2)}ms`);
  console.log(`Test 6 (avg):       ${avgTime.toFixed(2)}ms`);
  console.log();

  const maxTime = Math.max(time1, time2, time3, avgTime);
  if (maxTime < 2000) {
    console.log('✓ PASS: All queries completed in < 2 seconds');
  } else {
    console.log('✗ FAIL: Some queries took > 2 seconds');
  }
}

testQueryPerformance().catch(console.error);

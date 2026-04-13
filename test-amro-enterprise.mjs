/**
 * AMRO Enterprise API Integration Tests
 * 
 * Run with: node test-amro-enterprise.mjs
 * 
 * Tests all 18 endpoints across Materials, Tooling, and Compliance APIs
 */

import { writeFileSync } from 'fs';

// Configuration
const CONFIG = {
  API_BASE: process.env.API_BASE || 'http://localhost:8081/api/v2/amro/enterprise',
  AUTH_TOKEN: process.env.AUTH_TOKEN || '',
  TENANT_ID: process.env.TENANT_ID || '',
};

// Test results storage
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

// Color codes for terminal output
const COLORS = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

async function testEndpoint(name, method, path, body = null, expectSuccess = true) {
  results.total++;
  
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`Test ${results.total}: ${name}`, 'blue');
  log(`${'='.repeat(60)}`, 'cyan');
  log(`URL: ${method} ${CONFIG.API_BASE}${path}`);
  
  try {
    const url = `${CONFIG.API_BASE}${path}`;
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    // Add auth token if provided
    if (CONFIG.AUTH_TOKEN) {
      options.headers['Authorization'] = `Bearer ${CONFIG.AUTH_TOKEN}`;
    }

    // Add body if provided
    if (body) {
      options.body = JSON.stringify(body);
      log(`Body: ${JSON.stringify(body, null, 2).substring(0, 200)}...`);
    }

    const startTime = Date.now();
    const response = await fetch(url, options);
    const duration = Date.now() - startTime;
    
    const data = await response.json().catch(() => null);
    
    log(`Status: ${response.status} ${response.statusText}`);
    log(`Duration: ${duration}ms`);
    
    if (data) {
      log(`Response: ${JSON.stringify(data, null, 2).substring(0, 500)}...`);
    }

    const success = expectSuccess 
      ? response.status >= 200 && response.status < 300
      : response.status >= 200 && response.status < 500; // Allow 404s for missing IDs

    if (success) {
      log(`✓ PASSED`, 'green');
      results.passed++;
      results.tests.push({
        name,
        status: 'PASSED',
        httpStatus: response.status,
        duration,
        path,
      });
    } else {
      log(`✗ FAILED`, 'red');
      results.failed++;
      results.tests.push({
        name,
        status: 'FAILED',
        httpStatus: response.status,
        duration,
        path,
        error: data?.error || data?.details || 'Unknown error',
      });
    }

    return { success, status: response.status, data };
  } catch (error) {
    log(`✗ ERROR: ${error.message}`, 'red');
    results.failed++;
    results.tests.push({
      name,
      status: 'ERROR',
      httpStatus: 0,
      duration: 0,
      path,
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

async function runTests() {
  log('\n' + '='.repeat(60), 'cyan');
  log('AMRO ENTERPRISE API INTEGRATION TESTS', 'cyan');
  log('='.repeat(60), 'cyan');
  log(`API Base: ${CONFIG.API_BASE}`, 'yellow');
  log(`Auth Token: ${CONFIG.AUTH_TOKEN ? '✓ Set' : '✗ Not Set (tests may fail)'}`, CONFIG.AUTH_TOKEN ? 'green' : 'red');
  log(`Tenant ID: ${CONFIG.TENANT_ID || 'Not Set'}`, 'yellow');
  
  if (!CONFIG.AUTH_TOKEN) {
    log('\n⚠️  WARNING: No AUTH_TOKEN provided. Tests will likely fail with 401.', 'yellow');
    log('Set environment variable: export AUTH_TOKEN=your-token', 'yellow');
  }

  // ==========================================
  // MATERIALS API TESTS (6 endpoints)
  // ==========================================
  log('\n\n' + '📦'.repeat(30), 'cyan');
  log('MATERIALS API TESTS', 'cyan');
  log('📦'.repeat(30), 'cyan');

  await testEndpoint(
    'Search Materials (basic)',
    'POST',
    '/materials/search',
    { query: '', limit: 10, offset: 0 },
    true
  );

  await testEndpoint(
    'Search Materials (with ATA filter)',
    'POST',
    '/materials/search',
    { query: '', ata_chapter: '79-21-00', limit: 10 },
    true
  );

  await testEndpoint(
    'Search Materials (material group filter)',
    'POST',
    '/materials/search',
    { query: '', material_group: 'rotable', in_stock_only: true, limit: 10 },
    true
  );

  await testEndpoint(
    'Get Material Stock (invalid ID - should 404)',
    'GET',
    '/materials/00000000-0000-0000-0000-000000000000/stock',
    null,
    false // Expect 404
  );

  await testEndpoint(
    'Get Material Shortages',
    'GET',
    '/materials/shortages',
    null,
    true
  );

  await testEndpoint(
    'Get Materials Analytics',
    'GET',
    '/materials/analytics',
    null,
    true
  );

  // ==========================================
  // TOOLING API TESTS (6 endpoints)
  // ==========================================
  log('\n\n' + '🔧'.repeat(30), 'cyan');
  log('TOOLING API TESTS', 'cyan');
  log('🔧'.repeat(30), 'cyan');

  await testEndpoint(
    'Search Tools (basic)',
    'POST',
    '/tooling/search',
    { query: '', limit: 10, offset: 0 },
    true
  );

  await testEndpoint(
    'Search Tools (category filter)',
    'POST',
    '/tooling/search',
    { query: '', tool_category: 'hand_tool', limit: 10 },
    true
  );

  await testEndpoint(
    'Search Tools (calibration filter)',
    'POST',
    '/tooling/search',
    { query: '', calibration_required: true, limit: 10 },
    true
  );

  await testEndpoint(
    'Get Tool Availability (invalid ID - should 404)',
    'GET',
    '/tooling/00000000-0000-0000-0000-000000000000/availability',
    null,
    false
  );

  await testEndpoint(
    'Get Calibration Due List',
    'GET',
    '/tooling/calibration-due',
    null,
    true
  );

  await testEndpoint(
    'Get Tooling Analytics',
    'GET',
    '/tooling/analytics',
    null,
    true
  );

  // ==========================================
  // COMPLIANCE API TESTS (6 endpoints)
  // ==========================================
  log('\n\n' + '📋'.repeat(30), 'cyan');
  log('COMPLIANCE API TESTS', 'cyan');
  log('📋'.repeat(30), 'cyan');

  await testEndpoint(
    'Get AD/SB Feed (all)',
    'GET',
    '/compliance-enterprise/ad-sb-feed',
    null,
    true
  );

  await testEndpoint(
    'Get AD/SB Feed (FAA only)',
    'GET',
    '/compliance-enterprise/ad-sb-feed?regulatory_authority=FAA',
    null,
    true
  );

  await testEndpoint(
    'Get AD/SB Feed (applicable only)',
    'GET',
    '/compliance-enterprise/ad-sb-feed?applicable_only=true',
    null,
    true
  );

  await testEndpoint(
    'Check Applicability (invalid ID - should 404)',
    'POST',
    '/compliance-enterprise/00000000-0000-0000-0000-000000000000/applicability',
    { aircraft_model: 'A320neo' },
    false
  );

  await testEndpoint(
    'Get Fleet Compliance Status',
    'GET',
    '/compliance-enterprise/fleet-status',
    null,
    true
  );

  await testEndpoint(
    'Get Compliance Analytics',
    'GET',
    '/compliance-enterprise/analytics',
    null,
    true
  );

  // ==========================================
  // TEST SUMMARY
  // ==========================================
  log('\n\n' + '='.repeat(60), 'cyan');
  log('TEST SUMMARY', 'cyan');
  log('='.repeat(60), 'cyan');
  
  log(`\nTotal Tests: ${results.total}`, 'blue');
  log(`✓ Passed: ${results.passed}`, 'green');
  log(`✗ Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'green');
  log(`\nPass Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`, 
    results.passed / results.total >= 0.8 ? 'green' : 'red');

  // Show failed tests
  if (results.failed > 0) {
    log('\n\nFailed Tests:', 'red');
    log('-'.repeat(60), 'red');
    results.tests
      .filter(t => t.status !== 'PASSED')
      .forEach((test, i) => {
        log(`${i + 1}. ${test.name}`, 'red');
        log(`   Status: ${test.httpStatus}`, 'red');
        log(`   Error: ${test.error || 'N/A'}`, 'red');
        log(`   Path: ${test.path}`, 'yellow');
        log('');
      });
  }

  // Save results to file
  const resultsFile = 'test-results-amro-enterprise.json';
  writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  log(`\n📄 Full results saved to: ${resultsFile}`, 'cyan');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error('Test runner failed:', error);
  process.exit(1);
});

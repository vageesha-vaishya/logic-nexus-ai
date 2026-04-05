import http from 'k6/http';
import { check, group, sleep } from 'k6';

const MODE = __ENV.K6_UIM_MODE || 'smoke';
const BASE_URL = __ENV.K6_UIM_BASE_URL || 'http://localhost:3000';
const TENANT_ID = __ENV.K6_UIM_TENANT_ID || 'dev-tenant';
const FRANCHISE_ID = __ENV.K6_UIM_FRANCHISE_ID || '';

const profiles = {
  smoke: {
    vus: 20,
    duration: '2m',
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<1200'],
    },
  },
  baseline: {
    stages: [
      { duration: '2m', target: 100 },
      { duration: '4m', target: 300 },
      { duration: '2m', target: 0 },
    ],
    thresholds: {
      http_req_failed: ['rate<0.01'],
      http_req_duration: ['p(95)<1500'],
    },
  },
  target_2000: {
    stages: [
      { duration: '5m', target: 250 },
      { duration: '5m', target: 750 },
      { duration: '8m', target: 2000 },
      { duration: '5m', target: 2000 },
      { duration: '4m', target: 0 },
    ],
    thresholds: {
      http_req_failed: ['rate<0.02'],
      http_req_duration: ['p(95)<2200'],
    },
  },
};

if (!profiles[MODE]) {
  throw new Error(`Unknown K6_UIM_MODE: ${MODE}`);
}

export const options = profiles[MODE];

function buildHeaders() {
  return {
    headers: {
      'X-Tenant-Id': TENANT_ID,
      'X-Franchise-Id': FRANCHISE_ID,
      'Content-Type': 'application/json',
    },
    tags: {
      mode: MODE,
      module: 'uim',
      phase: 'phase5',
    },
  };
}

export default function () {
  const requestOptions = buildHeaders();

  group('health-and-contracts', () => {
    const healthRes = http.get(`${BASE_URL}/api/v2/uim/health`, requestOptions);
    check(healthRes, {
      'health status 200': (r) => r.status === 200,
    });

    const contractsRes = http.get(`${BASE_URL}/api/v2/uim/integration-contracts`, requestOptions);
    check(contractsRes, {
      'integration-contracts status 200': (r) => r.status === 200,
    });
  });

  group('analytics-reads', () => {
    const kpisRes = http.get(`${BASE_URL}/api/v2/uim/analytics/kpis`, requestOptions);
    check(kpisRes, {
      'kpis status 200': (r) => r.status === 200,
    });

    const etlRes = http.get(`${BASE_URL}/api/v2/uim/analytics/etl`, requestOptions);
    check(etlRes, {
      'etl status 200': (r) => r.status === 200,
    });

    const reconciliationRes = http.get(`${BASE_URL}/api/v2/uim/analytics/reconciliation`, requestOptions);
    check(reconciliationRes, {
      'reconciliation status 200': (r) => r.status === 200,
    });
  });

  group('analytics-workflow', () => {
    const qaPayload = JSON.stringify({
      signoff_status: 'signed_off',
      signed_off_by: 'perf.bot@logicnexus.ai',
      signed_off_role: 'performance_engineer',
      reconciliation_verified: true,
      latency_target_met: true,
      data_dictionary_published: true,
      bi_cube_deployed: true,
      notes: `k6-${MODE}-scenario`,
    });
    const qaRes = http.post(`${BASE_URL}/api/v2/uim/analytics/qa-signoff`, qaPayload, requestOptions);
    check(qaRes, {
      'qa-signoff status 200': (r) => r.status === 200,
    });

    const slaRes = http.get(`${BASE_URL}/api/v2/uim/analytics/sla-evidence`, requestOptions);
    check(slaRes, {
      'sla-evidence status 200': (r) => r.status === 200,
    });
  });

  sleep(0.5);
}

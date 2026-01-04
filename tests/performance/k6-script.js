import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // Ramp up to 20 users
    { duration: '1m', target: 20 },  // Stay at 20 users
    { duration: '30s', target: 0 },  // Ramp down to 0
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:54321/functions/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${AUTH_TOKEN}`,
    },
  };

  // Example: Test get-account-label function (Read-only operation)
  // Replace 'get-account-label' with your actual function name
  const res = http.post(`${BASE_URL}/get-account-label`, JSON.stringify({ id: '123' }), params);

  check(res, {
    'status is 200 or 401': (r) => r.status === 200 || r.status === 401, // 401 is acceptable if token is invalid, measuring latency
    'transaction time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}

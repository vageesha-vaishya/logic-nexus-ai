# Stock Ledger P0 Performance Benchmarks

## Benchmark Scope
- Transaction create throughput (`POST /api/v2/amro/stock-ledger`)
- Read latency (`GET /api/v2/amro/stock-ledger`)
- Current balance fetch (`GET /api/v2/amro/stock-ledger/balance`)

## Suggested Load Profiles
- Warmup: 30s @ 5 rps
- Normal load: 2m @ 20 rps
- Peak burst: 1m @ 60 rps

## k6 Example (create)
```javascript
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 5 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 60 },
    { duration: '30s', target: 0 },
  ],
};

export default function () {
  const payload = JSON.stringify({
    part_inventory_id: __ENV.PART_ID,
    movement_type: 'receipt',
    quantity_delta: 1,
    unit_cost: 10,
    idempotency_key: `bench-${__VU}-${__ITER}`,
  });
  const res = http.post(`${__ENV.BASE_URL}/api/v2/amro/stock-ledger`, payload, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${__ENV.BEARER}`,
    },
  });
  check(res, { 'status is 201': (r) => r.status === 201 });
}
```

## P0 Acceptance Targets
- p95 POST latency <= 250ms (single movement transaction path)
- p95 GET ledger list <= 500ms (page_size 50)
- p95 balance endpoint <= 400ms
- error rate < 1% under normal load profile

## Data Integrity Checks During Load
- No negative `quantity_on_hand`, `quantity_reserved`, or `quantity_available`
- No duplicate idempotency writes for same `(tenant_id, idempotency_key)`
- Every successful POST has audit timeline evidence row

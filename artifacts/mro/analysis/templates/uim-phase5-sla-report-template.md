# UIM Phase 5 SLA Report

- Generated at: `{{generated_at}}`
- Scenario mode: `{{mode}}`
- Base URL: `{{base_url}}`

## Summary
- Checks passed: `{{checks_passed}} / {{checks_total}}`
- HTTP error rate: `{{http_req_failed_rate}}`
- HTTP p95 latency (ms): `{{http_req_duration_p95}}`
- HTTP average latency (ms): `{{http_req_duration_avg}}`

## Threshold Evaluation
- p95 target: `{{p95_target_ms}} ms`
- p95 status: `{{p95_status}}`
- error-rate target: `< {{error_rate_target}}`
- error-rate status: `{{error_rate_status}}`

## Release Gate Signals
- p95 SLA compliance: `{{p95_gate}}`
- reliability gate: `{{reliability_gate}}`
- phase5 recommendation: `{{phase5_recommendation}}`

## Notes
- Keep raw k6 summary JSON in:
  - `artifacts/mro/analysis/performance/uim-phase5-k6-summary.json`

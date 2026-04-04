# AUTO-0M3IJA Engine Seeding Benchmark

## Objective
- Benchmark remote Supabase execution characteristics for the RPC seeding workflow:
- `public.seed_auto_0m3ija_engine_dataset()`
- Capture query latency samples for seeded engine datasets.
- Provide extrapolated scale estimate for 10,000 aircraft-equivalent seed runs.

## Benchmark Runner
- Script: `scripts/amro-auto-0m3ija-engine-benchmark.mjs`
- Output: `artifacts/mro/analysis/auto-0m3ija-engine-benchmark-report.json`

Run command:

```bash
node scripts/amro-auto-0m3ija-engine-benchmark.mjs --iterations=5
```

Optional scoped run:

```bash
node scripts/amro-auto-0m3ija-engine-benchmark.mjs --iterations=10 --tenant-id=<tenant_uuid> --franchise-id=<franchise_uuid>
```

## Measurements Captured
- Seed RPC latency per iteration.
- Aggregated timing statistics (`min`, `avg`, `p95`, `p99`, `max`).
- Query timing samples:
- `engine_parameter_history` count/range scan.
- `maintenance_events` status retrieval.
- `asset_health_signals` time-window retrieval.
- Scale projection:
- Estimated total execution for 10,000 aircraft-equivalent runs using observed average latency.

## Result Interpretation Guide
- `executionMetrics.p95Ms`:
- Primary indicator for sustained remote seeding experience.
- `queryMetrics[].latencyMs`:
- Spot check for operational read performance after seed.
- `projectedScale.estimatedTotalMinutes`:
- High-level planning estimate for large-batch migration windows.

## Data Integrity Gate
- Seeding RPC embeds hard validation thresholds:
- parameter rows `>= 1000`
- maintenance events `>= 500`
- performance points `>= 200`
- Benchmark result is valid only when these thresholds are met in every forced run.

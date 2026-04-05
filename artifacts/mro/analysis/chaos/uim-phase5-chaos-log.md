# UIM Phase5 Chaos Log

- Generated at: `2026-04-05T04:54:35.115Z`
- Base URL: `http://localhost:3000`
- Result: `pass` (3/4)

## Experiments
- CH-001 Dependency timeout simulation: PASS (Timeout/connection error captured: TypeError)
- CH-002 ETL queue burst and drain: PASS (process status=200, queued=0)
- CH-003 Reconciliation under scheduler stop/start: PASS (reconciliation status=200)
- CH-004 Invalid payload rejection: FAIL (status=200)

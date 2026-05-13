# SOS Services Canvas Deployment Guide

## Deployment Targets

- Kubernetes (primary): Helm-based deployment with HPA/VPA.
- Container runtime fallback: Docker Compose for local and staging smoke environments.

## Zero-Downtime Strategy

- Default rollout mode: blue-green.
- Optional rollout mode: canary with progressive traffic shifting.
- Health gates:
  - readiness probes pass before traffic shift;
  - synthetic auth + tenancy check must pass;
  - error budget guardrails enforced during rollout.

## Required Runtime Components

- API gateway (Envoy/Kong/Nginx) with mTLS upstream.
- Redis for cache and distributed rate limiting.
- Message bus (Kafka/NATS/SQS-compatible adapter).
- SQL datastore with read replicas and failover automation.
- Vault or KMS-backed secret manager.

## Environment Variables

- `CANVAS_AUTH_ISSUER`
- `CANVAS_AUTH_AUDIENCE`
- `CANVAS_TLS_MODE=tls1_3_required`
- `CANVAS_ENCRYPTION_AT_REST=aes_256`
- `CANVAS_DEFAULT_REGION`
- `CANVAS_RATE_LIMIT_RPM`
- `CANVAS_CIRCUIT_BREAKER_FAILURE_THRESHOLD`
- `CANVAS_COMPLIANCE_PROFILE` (`gdpr,soc2,hipaa,pci_dss`)

## Horizontal Scaling Guidance

- Stateless services scale by request rate and CPU.
- Tenant-heavy workloads scale by custom metric `tenant_requests_per_minute`.
- Event consumers scale on queue lag and processing latency.
- Target architecture capacity:
  - 1M+ users;
  - 10k concurrent active sessions;
  - p95 < 100ms on hot paths.

## Operational SLOs

- Availability SLA: 99.9%.
- Auth success rate SLI: > 99.95%.
- Event publish success SLI: > 99.99%.
- Error budget policy tied to canary progression and auto-rollback.

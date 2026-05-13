# SOS Services Canvas Architecture

## Architecture Style

- Clean architecture with dependency inversion.
- Domain-first contracts with infrastructure adapters plugged in at composition time.
- Framework-agnostic protocol surfaces for REST, gRPC, and asynchronous eventing.

## Layer Model

1. Presentation Layer
- Protocol handlers and transport DTO boundaries.
- Request validation and standardized error mapping.

2. Application Layer
- Use cases: authentication, tenant isolation, franchise hierarchy, gateway governance, event integration.
- Depends only on domain types and abstract ports.

3. Domain Layer
- Core entities and value objects: tenant, franchise, claims, compliance profile, policy definitions.
- Invariants: strict tenant boundary and permission checks.

4. Infrastructure Layer
- Adapter implementations for JWT/OIDC, cache, queue, rate limiter, payment gateways, notifications.
- Deployment configuration and operations defaults.

## Core Capabilities Matrix

| Capability | Current Module Contract | Extension Strategy |
| --- | --- | --- |
| AuthN/AuthZ | `AuthenticationService`, `JwtProviderPort`, `PolicyEnginePort` | Plug in external IdP and policy-as-code engines |
| Multi-tenancy | `TenantIsolationService`, `TenantRepositoryPort` | Shared-schema or dedicated-database resolver adapters |
| Franchise hierarchy | `FranchiseService`, `FranchiseRepositoryPort` | Add franchise analytics and hierarchy rollups |
| API gateway controls | `GatewayPolicyService`, `RateLimiterPort` | Wire Envoy/Kong/Nginx adapters |
| Eventing | `EventAndIntegrationService`, `EventBusPort` | Add outbox + DLQ + schema-registry adapter |
| Payments | `PaymentGatewayPort` | Add Stripe/Adyen/Braintree adapters |
| Notifications | `NotificationPort` | Add email/SMS/push providers and delivery analytics |

## Scalability Model

- Horizontal scaling for stateless services.
- Sharding-ready tenant metadata (`shardKey`) to route traffic and data.
- Cache-first reads for tenancy and policy resolution.
- Circuit breaker and rate-limit controls to protect shared dependencies.

## Reliability and SLO Alignment

- API target p95 latency: under 100ms for cached authorization and tenant resolution paths.
- Uptime target: 99.9% with blue-green/canary deployment and health probes.
- Incident response: integrate metrics, logs, and distributed tracing through adapter ports.

## Security and Compliance Mapping

- TLS 1.3 in transit and AES-256 at rest enforced by deployment/runtime configuration.
- JWT short-lived tokens + refresh via OIDC integration ports.
- Mandatory audit logging and retention policy fields in compliance config.
- PCI/HIPAA/GDPR/SOC2 controls represented in `CompliancePolicy` and operationalized via environment policy.

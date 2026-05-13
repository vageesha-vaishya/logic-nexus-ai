# SOS Services Canvas

`SOS Services Canvas` is an extractable core infrastructure module for building SaaS, PaaS, multi-tenant, and multi-franchise applications.

## Purpose

- Provide a clean, framework-agnostic infrastructure foundation.
- Standardize security, isolation, API governance, eventing, and operations.
- Enable independent versioning and backward-compatible adoption by other stacks.

## Module Scope

- Authentication and authorization (JWT, OAuth2/OIDC, RBAC).
- Tenant and franchise isolation controls.
- API gateway policy abstractions (rate limiting, circuit breaking).
- Event bus, payment, notification, and configuration integration ports.
- Compliance and observability contracts.

## Repository Layout

- `src/core/sos-services-canvas/domain`: Domain contracts and invariants.
- `src/core/sos-services-canvas/application`: Use-case services and ports.
- `src/core/sos-services-canvas/infrastructure`: Adapter implementations and defaults.
- `src/core/sos-services-canvas/presentation`: Protocol-facing handlers.
- `src/core/sos-services-canvas/__tests__`: Unit and service-level tests.

## Quick Start

```ts
import { createCanvasModule } from '@/core/sos-services-canvas';

const canvas = createCanvasModule();

const token = await canvas.services.authService.issueServiceToken({
  userId: 'user-1',
  tenantId: 'tenant-demo',
  roles: ['tenant_admin'],
  permissions: ['tenant.read'],
});

const response = await canvas.apiHandlers.getTenantContext({
  headers: { authorization: `Bearer ${token}` },
  params: { tenantId: 'tenant-demo' },
});
```

## Linked Documents

- [Architecture](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/ARCHITECTURE.md)
- [Repository Separation Evaluation](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/REPOSITORY_SEPARATION_EVALUATION.md)
- [Repository Implementation Plan](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/REPOSITORY_IMPLEMENTATION_PLAN.md)
- [Integration Protocols](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/INTEGRATION_PROTOCOLS.md)
- [Governance Model](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/GOVERNANCE_MODEL.md)
- [Migration Guide: Independent Repo](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/MIGRATION_GUIDE_INDEPENDENT_REPO.md)
- [OpenAPI Spec](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/OPENAPI.yaml)
- [AsyncAPI Spec](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/ASYNCAPI.yaml)
- [Deployment Guide](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/DEPLOYMENT.md)
- [SDK Strategy](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/SDK.md)
- [ADR 0001](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/ADR-0001-EXTRACTABLE-CANVAS.md)
- [ADR 0002](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/docs/SOS_SERVICES_CANVAS/ADR-0002-INDEPENDENT-REPOSITORY-STRATEGY.md)

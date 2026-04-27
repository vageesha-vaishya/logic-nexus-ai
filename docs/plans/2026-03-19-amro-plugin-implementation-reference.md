# AMRO Plugin - M0 Implementation Reference

**Document:** Complete Implementation Details for M0-1 through M0-4
**Date:** 2026-03-19
**Status:** All Tasks Complete & Quality Approved
**Author:** Engineering Team (Subagent-Driven Development)

---

# M0-1: AMRO Operational Schema ✅ COMPLETE

**Timeline:** Weeks 1-2
**Status:** Spec Compliant ✅ | Code Quality Approved ✅
**Key Commits:** cb0fa5cd, f4c33cda

## Overview
Created operational database schema with 7 core tables, 46 optimized indexes, 14 RLS policies, and 27 integration tests.

## Database Tables

### 1. aircraft
- **Purpose:** Aircraft registry for maintenance tracking
- **Key Columns:** id (UUID PK), tenant_id (FK), tail_number (UNIQUE), aircraft_model, owner_id, status
- **Indexes:** tenant_id, tail_number
- **Status Values:** active, maintenance, grounded, retired, storage
- **Domain Type:** aircraft_status

### 2. components
- **Purpose:** Serialized parts/rotables with life-limited part (LLP) tracking
- **Key Columns:** id, tenant_id, aircraft_id, part_number, serial_number (UNIQUE), ata_chapter, llp_hours, llp_cycles, llp_calendar_days, current_hours, current_cycles, status
- **Indexes:** aircraft_id, serial_number, status
- **Lifecycle:** Tracks installation/removal events with timestamps
- **Domain Type:** component_status

### 3. work_orders
- **Purpose:** Maintenance work orders (corrective, preventive, regulatory)
- **Key Columns:** id, tenant_id, aircraft_id, work_type, source, source_id, title, priority, status, created_by, assigned_to, estimated_labor_hours, estimated_downtime_minutes, maintenance_type
- **Indexes:** (tenant_id, status), aircraft_id
- **Status Values:** planning, approved, scheduled, in_progress, on_hold, completed, closed, cancelled
- **Domain Types:** work_order_status, maintenance_type (line/base segregation)

### 4. tasks
- **Purpose:** Individual maintenance actions within work packages
- **Key Columns:** id, tenant_id, work_order_id, sequence, procedure_reference, steps (JSONB), assigned_technician_id, qualifications (JSONB), status, evidence_fields (JSONB)
- **Indexes:** work_order_id
- **Evidence Fields:** Photos, inspection checklists, notes
- **Domain Type:** task_status

### 5. staff_qualifications
- **Purpose:** Technician certifications and authority levels
- **Key Columns:** id, tenant_id, technician_id, rating (A&P, Powerplant, Avionics, etc.), scope, issued_date, expiration_date, issuing_authority (FAA/EASA), can_certify_release (BOOLEAN), can_defer (BOOLEAN)
- **Indexes:** (technician_id, expiration_date)
- **Domain Type:** audit_actor_role

### 6. maintenance_events
- **Purpose:** Immutable audit trail of task execution, sign-offs, evidence
- **Key Columns:** id, tenant_id, task_id, executed_by, execution_start, execution_end, event_type, evidence (JSONB), signed_at, signed_by, signature_method (digital/pin/biometric), created_at
- **Indexes:** task_id, created_at DESC
- **Domain Type:** signature_method

### 7. amro_work_order_materials
- **Purpose:** Parts procurement and allocation for work packages
- **Key Columns:** id, tenant_id, work_order_id, component_id, action (install/remove/inspect/repair), required_quantity, allocated_quantity, status, warehouse_location, supplier_id, supplier_eta
- **Indexes:** work_order_id
- **Domain Type:** material_action, material_status

## Domain Types Created

| Domain Type | Values | Purpose |
|---|---|---|
| aircraft_status | active, maintenance, grounded, retired, storage | Aircraft operational status |
| component_status | installed, removed, repair_queue, under_repair, awaiting_installation, condemned, obsolete | Part lifecycle state |
| maintenance_type | line, base, component, inspection, overhaul, repair, upgrade, modification | Maintenance classification |
| work_order_status | planning, approved, scheduled, in_progress, on_hold, completed, closed, cancelled | Work order status |
| task_status | pending, not_started, in_progress, on_hold, completed, rework_required, cancelled | Task execution status |
| material_status | pending, ordered, received, installed, cancelled, returned | Parts procurement status |
| material_action | install, remove, inspect, repair | Material action type |
| signature_method | digital, pin, biometric | Digital signature method |

## RLS Policies

- **Platform Admin Policy:** Full access to all AMRO data (for admin operations)
- **Tenant User Policy:** SELECT/INSERT/UPDATE/DELETE only own tenant_id data
- Applied to all 7 tables with consistent naming pattern

## Migration File
`supabase/migrations/20260319_001_create_amro_schema.sql` (720 lines)

## Test Coverage
27 integration tests validating:
- All 7 tables exist with correct columns
- RLS policies enforce tenant isolation
- Foreign key relationships
- 46 indexes present and functional
- Timestamp audit columns

---

# M0-2: Immutable Audit Schema ✅ COMPLETE

**Timeline:** Weeks 1-2
**Status:** Spec Compliant ✅ | Code Quality Approved ✅
**Key Commits:** 93f4aede, 8a6b8594

## Overview
Created separate `mro_audit` schema with immutable records and audit trails. Implemented database-level triggers to prevent updates/deletes on audit tables.

## Audit Tables

### 1. mro_audit.records
- **Purpose:** Immutable ledger of all sign-offs, approvals, overrides
- **Key Columns:** id, tenant_id, record_type, related_entity_id, related_entity_type, actor_id, actor_role, action, context (JSONB), signature (BYTEA), previous_hash (BYTEA), created_at
- **Immutability:** Trigger prevents UPDATE/DELETE
- **Indexes:** (related_entity_id, created_at DESC), (tenant_id, created_at DESC), created_at DESC
- **Retention:** 10-year policy
- **Domain Types:** audit_record_type, audit_actor_role, audit_entity_type

### 2. mro_audit.trails
- **Purpose:** Event stream for compliance replay and forensic verification
- **Key Columns:** id, tenant_id, event_type, entity_type, entity_id, user_id, user_email, timestamp, action_description, regulatory_context (JSONB), created_at
- **Immutability:** Trigger prevents UPDATE/DELETE
- **Indexes:** (tenant_id, created_at DESC), (entity_type, entity_id), created_at DESC
- **Regulatory Context:** Tracks FAA/EASA/ICAO audit references
- **Domain Types:** audit_event_type, audit_entity_type

## Immutability Enforcement

**Trigger Function:** `mro_audit.prevent_audit_updates()`
- Raises EXCEPTION with ERRCODE '55005' (object_in_use)
- Applies to both records and trails tables
- Applied BEFORE UPDATE OR DELETE
- INSERT allowed (append-only pattern)

## RLS Policies

**Records Table (2 policies):**
- Platform admin: SELECT, INSERT, full access
- Tenant users: SELECT, INSERT own tenant_id data

**Trails Table (2 policies):**
- Platform admin: SELECT, INSERT
- Tenant users: SELECT, INSERT own tenant_id data

## Permissions

```sql
GRANT SELECT, INSERT ON mro_audit.records TO authenticated;
GRANT SELECT, INSERT ON mro_audit.trails TO authenticated;
-- UPDATE/DELETE prevented by trigger
```

## Migration File
`supabase/migrations/20260319_002_create_amro_audit_schema.sql` (390 lines)

## Test Coverage
25 integration tests validating:
- Append-only pattern (INSERT works, UPDATE/DELETE blocked)
- Immutability enforcement via triggers
- RLS tenant isolation
- Index coverage
- Timestamp handling

---

# M0-3: Express API Backend Service ✅ COMPLETE

**Timeline:** Weeks 1-2
**Status:** Spec Compliant ✅ | Code Quality Approved ✅
**Key Commits:** ffa3a1b6, 115a619e, 6ebb87b1

## Overview
Created separate Node.js/Express backend service at `/services/amro-api/` with JWT authentication, multi-tenant isolation, and CRUD endpoints for work orders and tasks.

## Architecture

**Service:** Standalone Express backend (not monolithic)
**Pattern:** Fire-and-forget error handling (errors logged, don't crash API)
**Authentication:** JWT via Supabase auth.getUser()
**Tenant Isolation:** Explicit tenant_id filtering on all queries
**Database:** Service role client with multi-tenant isolation

## Core Files

### src/types/amro.types.ts
- `Aircraft` interface (all fields from M0-1)
- `WorkOrder` interface (all fields from M0-1)
- `Task` interface (all fields from M0-1)
- `StaffQualifications` interface
- Request/Response types

### src/middleware/auth.middleware.ts
- Extract Bearer token from Authorization header
- Verify JWT with `supabase.auth.getUser(token)`
- Look up tenant_id from user_roles table
- Set req.tenantId and req.user
- Return 401 for invalid/missing tokens

### src/services/work-orders.service.ts
- `createWorkOrder(tenantId, data)` → WorkOrder
- `getWorkOrder(tenantId, id)` → WorkOrder | 404
- `listWorkOrders(tenantId, status?)` → WorkOrder[]
- `updateWorkOrder(tenantId, id, updates)` → WorkOrder
- `deleteWorkOrder(tenantId, id)` → void
- **All queries explicitly filter by tenant_id** (belt and suspenders)

### src/routes/work-orders.routes.ts
- POST `/api/v1/work-orders` → create (201)
- GET `/api/v1/work-orders` → list
- GET `/api/v1/work-orders/:id` → getOne
- PATCH `/api/v1/work-orders/:id` → update
- DELETE `/api/v1/work-orders/:id` → delete
- Plus similar routes for tasks

### src/utils/logger.ts
Structured logging wrapper:
- `logger.info(msg, meta)` - Info level with metadata
- `logger.warn(msg, meta)` - Warnings
- `logger.error(msg, meta)` - Errors with context
- `logger.debug(msg, meta)` - Debug (only if process.env.DEBUG)

### src/utils/asyncHandler.ts
Async route wrapper to eliminate try/catch duplication:
- Wraps route handlers
- Automatically catches promise rejections
- Passes to global error handler

### src/app.ts
Express app setup:
- Middleware chain: auth → routes → error handler
- CORS configured
- JSON parsing
- Request logging
- 404 handler
- Global error handler with proper error response format

### src/index.ts
Server entry point:
- Load .env with dotenv
- Initialize Kafka producer
- Start on PORT (default 3001)
- Graceful shutdown handlers (SIGTERM, SIGINT)

## API Endpoints

**Work Packages:**
- `POST /api/v1/work-orders` - Create work package (201)
- `GET /api/v1/work-orders` - List with optional status filter
- `GET /api/v1/work-orders/:id` - Get one (200 or 404)
- `PATCH /api/v1/work-orders/:id` - Update
- `DELETE /api/v1/work-orders/:id` - Delete (204)

**Tasks:**
- `POST /api/v1/work-orders/:id/tasks` - Create task
- `GET /api/v1/work-orders/:id/tasks` - List tasks
- `GET /api/v1/tasks/:id` - Get task
- `PATCH /api/v1/tasks/:id` - Update task
- `DELETE /api/v1/tasks/:id` - Delete task

**Health:**
- `GET /health` - Health check
- `GET /` - Root endpoint

## Authentication

**Token Extraction:**
```
Authorization: Bearer <JWT_TOKEN>
```

**Tenant Lookup:**
1. Verify JWT with Supabase
2. Extract user_id
3. Query user_roles table for tenant_id
4. Fail with 401 if tenant not assigned

## Error Handling

**Format:** `{ error: string, code: string, statusCode: number }`

**HTTP Status Codes:**
- 201 Created
- 200 OK
- 204 No Content
- 400 Bad Request (VALIDATION_ERROR)
- 401 Unauthorized (MISSING_TOKEN, INVALID_TOKEN, NO_TENANT_ASSIGNMENT)
- 404 Not Found (RESOURCE_NOT_FOUND)
- 500 Internal Server Error

## Testing

**20 Integration Tests:**
- Health check endpoints
- Authentication validation (401 on missing token)
- CORS headers verification
- All CRUD endpoints with auth check
- 404 error handling
- Request/response format validation

## Environment Variables (.env.example)

```
PORT=3001
NODE_ENV=development
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<keep-secret>
CORS_ORIGIN=http://localhost:3000
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC_WORK_ORDERS=amro.work-orders
KAFKA_TOPIC_TASKS=amro.tasks
KAFKA_CLIENT_ID=amro-service
KAFKA_PRODUCER_TIMEOUT=5000
```

---

# M0-4: Kafka Event Stream ✅ COMPLETE

**Timeline:** Weeks 1-2
**Status:** Spec Compliant ✅ | Code Quality Approved ✅
**Key Commits:** Multiple (initial + spec gap fix + code quality fixes)

## Overview
Created Kafka producer service with idempotent publishing. 9 event types cover work order and task CRUD operations plus maintenance event recording. 40 integration tests.

## Architecture

**Pattern:** Fire-and-forget publishing (async, non-blocking)
**Deduplication:** Kafka broker-side (idempotency_key + producer ID)
**Partitioning:** Tenant-based for ordered delivery
**Error Handling:** Log errors but don't fail API calls
**Shutdown:** Graceful disconnect on SIGTERM/SIGINT

## Event Types (9 Total)

### Work Order Events
1. **WORK_ORDER_CREATED** - Published when work package created
2. **WORK_ORDER_UPDATED** - Published when work package updated
3. **WORK_ORDER_DELETED** - Published when work package deleted

### Task Events
4. **TASK_CREATED** - Published when task created
5. **TASK_UPDATED** - Published when task updated
6. **TASK_DELETED** - Published when task deleted
7. **TASK_STARTED** - Published when task status → in_progress
8. **TASK_COMPLETED** - Published when task status → completed

### Maintenance Events
9. **MAINTENANCE_EVENT_RECORDED** - Published when maintenance event (sign-off, evidence) recorded

## Core Files

### src/events/amro-events.types.ts

```typescript
enum AmroEventType {
  WORK_ORDER_CREATED = 'amro.work_order.created',
  WORK_ORDER_UPDATED = 'amro.work_order.updated',
  WORK_ORDER_DELETED = 'amro.work_order.deleted',
  TASK_CREATED = 'amro.task.created',
  TASK_UPDATED = 'amro.task.updated',
  TASK_DELETED = 'amro.task.deleted',
  TASK_STARTED = 'amro.task.started',
  TASK_COMPLETED = 'amro.task.completed',
  MAINTENANCE_EVENT_RECORDED = 'amro.maintenance_event.recorded',
}

interface AmroWorkOrderEvent {
  event_type: AmroEventType,
  tenant_id: string,
  work_order_id: string,
  aircraft_id: string,
  data: Record<string, any>,
  timestamp: Date,
  idempotency_key: string
}

interface AmroTaskEvent {
  event_type: AmroEventType,
  tenant_id: string,
  task_id: string,
  work_order_id: string,
  data: Record<string, any>,
  timestamp: Date,
  idempotency_key: string
}

interface AmroMaintenanceEvent {
  event_type: AmroEventType,
  tenant_id: string,
  task_id: string,
  executed_by: string,
  data: Record<string, any>,
  timestamp: Date,
  idempotency_key: string
}
```

### src/events/amro-events.producer.ts

**Singleton Pattern:**
```typescript
class AmroEventsProducer {
  private kafka: Kafka;
  private producer: Producer;

  constructor() {
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID,
      brokers: process.env.KAFKA_BROKERS.split(','),
    });
    this.producer = this.kafka.producer({
      idempotent: true,
      maxInFlightRequests: 5,
      transactionTimeout: 60000,
    });
  }

  async publishWorkOrderEvent(event: AmroWorkOrderEvent): Promise<void> {
    try {
      await this.producer.send({
        topic: process.env.KAFKA_TOPIC_WORK_ORDERS,
        messages: [{
          key: `${event.tenant_id}-${event.work_order_id}`,
          value: JSON.stringify(event),
          headers: {
            'idempotency-key': event.idempotency_key,
            'event-type': event.event_type,
          },
        }],
      });
      logger.info('Published work order event', { event_type: event.event_type, work_order_id: event.work_order_id });
    } catch (error) {
      logger.error('Failed to publish work order event', { error: error.message, event_type: event.event_type });
    }
  }

  // Similar methods for tasks and maintenance events

  async gracefulShutdown(): Promise<void> {
    await this.producer.disconnect();
  }
}
```

**Fire-and-Forget Integration in Service:**
```typescript
// In work-orders.service.ts
async createWorkOrder(tenantId: string, data: any) {
  const workOrder = await this.supabase.from('work_orders').insert({...}).select().single();

  // Fire-and-forget event publishing
  this.eventsProducer.publishWorkOrderEvent({
    event_type: AmroEventType.WORK_ORDER_CREATED,
    tenant_id: tenantId,
    work_order_id: workOrder.id,
    aircraft_id: workOrder.aircraft_id,
    data: workOrder,
    timestamp: new Date(),
    idempotency_key: crypto.randomUUID(),
  }).catch(err => {
    logger.error('Failed to publish event', { error: err.message, event_type: 'WORK_ORDER_CREATED' });
  });

  return workOrder;
}
```

## Kafka Configuration

**Topics:**
- `amro.work-orders` - Work order CRUD events
- `amro.tasks` - Task CRUD + state transition events

**Producer Configuration:**
- `idempotent: true` - Enable idempotent writes
- `maxInFlightRequests: 5` - Maintain ordering within partition
- `transactionTimeout: 60000` - Transaction timeout
- Broker-side deduplication window: 5 minutes (default)

**Message Structure:**
```json
{
  "event_type": "amro.work_order.created",
  "tenant_id": "uuid",
  "work_order_id": "uuid",
  "aircraft_id": "uuid",
  "data": { /* full work order object */ },
  "timestamp": "2026-03-19T10:30:00Z",
  "idempotency_key": "uuid"
}
```

## Deduplication Strategy

**Idempotency Key:** v4 UUID, unique per event instance
**Producer ID:** Kafka automatically assigns based on client_id + broker
**Broker Deduplication:** 5-minute window (configurable)
**No Application Cache:** Rely entirely on Kafka broker-side deduplication

## Error Handling

**Fire-and-Forget Pattern:**
```typescript
this.eventsProducer.publishEvent(event)
  .catch(err => {
    logger.error('Event publishing failed', {
      error: err.message,
      event_type: event.event_type,
      tenant_id: event.tenant_id,
    });
  });
```


**Security:** Service role key safeguarded with validation + comment

## Testing

**40 Integration Tests:**
- All 9 event types validated
- Event format verification (idempotency_key, tenant_id, timestamps)
- Fire-and-forget error handling
- Graceful shutdown
- Tenant-based partitioning

---

# M0 Status Report (Audit Snapshot)

**Snapshot Date:** 2026-03-19  
**Milestone:** M0 Foundation (Weeks 1-2)  
**Branch:** `feat/amro-plugin-phase-a`  
**Worktree:** `.worktrees/feat-amro-plugin-phase-a`

## Executive Status
- **Completion:** 6/7 tasks complete (**85.7%**)
- **Overall Assessment:** M0 is mostly complete with one critical gap in mobile offline framework delivery
- **Production Readiness:** Not yet ready for M1a sign-off until M0-6 is implemented and validated

## Milestone Progress

| Task | Planned Outcome | Implementation Status | Evidence |
|---|---|---|---|
| **M0-1** | Operational AMRO schema | ✅ Complete | `supabase/migrations/20260319_001_create_amro_schema.sql`, `tests/integration/amro-schema.test.ts` |
| **M0-2** | Immutable audit schema | ✅ Complete | `supabase/migrations/20260319_002_create_amro_audit_schema.sql`, `tests/integration/amro-audit-schema.test.ts` |
| **M0-3** | API scaffolding and CRUD endpoints | ✅ Complete | `services/amro-api/src/app.ts`, `services/amro-api/src/routes/work-orders.routes.ts`, `services/amro-api/src/services/work-orders.service.ts` |
| **M0-4** | Kafka event stream integration | ✅ Complete | `services/amro-api/src/events/amro-events.types.ts`, `services/amro-api/src/events/amro-events.producer.ts`, `services/amro-api/tests/amro-events.test.ts` |
| **M0-5** | OpenTelemetry tracing integration | ✅ Complete | `services/amro-api/src/instrumentation/amro-tracing.ts`, `services/amro-api/src/instrumentation/tracer-provider.ts`, `services/amro-api/tests/amro-tracing.test.ts` |
| **M0-6** | Mobile offline-first framework | ❌ Gap | No `mobile/` implementation files present in worktree |
| **M0-7** | AMRO CI/CD pipeline | ✅ Complete | `.github/workflows/amro-ci.yml`, `vitest.config.amro.ts`, `package.json` scripts |

## Requirement-to-Code Traceability (M0)

| Requirement Area | Requirement Intent | Code Implementation |
|---|---|---|
| Multi-tenant isolation | Enforce tenant-scoped access for AMRO records | RLS in `20260319_001_create_amro_schema.sql`; explicit `tenant_id` filtering in `work-orders.service.ts` |
| Immutable compliance records | Prevent audit tampering | Append-only triggers in `20260319_002_create_amro_audit_schema.sql` |
| AMRO API service foundation | Isolated AMRO backend with auth and CRUD | `app.ts`, `auth.middleware.ts`, `work-orders.routes.ts`, `work-orders.service.ts` |
| Event-driven integration | Publish non-blocking AMRO domain events | `amro-events.producer.ts`, `amro-events.types.ts` |
| Observability | Trace critical operations end-to-end | `amro-tracing.ts`, `tracer-provider.ts`, tracing test coverage |
| Delivery automation | Automated CI validation for AMRO scope | `.github/workflows/amro-ci.yml`, `vitest.config.amro.ts`, AMRO test scripts |

## Gap Analysis Matrix (Appendix A)

| Gap ID | Area | Severity | Impact | Current State | Required Closure |
|---|---|---|---|---|---|
| **GAP-M0-001** | M0-6 Mobile Offline Framework | High | Blocks planned offline execution and conflict-resolution foundation for M1a | `mobile/src/services/offline-cache.ts`, `mobile/src/types/offline.types.ts`, and `mobile/src/stores/work-order.store.ts` are absent | Implement mobile offline files and tests, then rerun AMRO lint/typecheck/test gates |

## Git Traceability Summary

- `53f9544c`, `cb0fa5cd`, `f4c33cda`: M0-1 schema foundation and spec alignment
- `93f4aede`, `8a6b8594`: M0-2 immutable audit schema and quality fixes
- `ffa3a1b6`, `6ebb87b1`: M0-3 API service and integration hardening
- `3de5ab5d`, `55e15c27`: M0-4 event coverage and reliability fixes
- `5df2be0f`: M0-5 tracing integration
- `c6142de4`: M0-7 CI pipeline setup

## Exit-Criteria Assessment

- ✅ Operational schema established and tested
- ✅ Immutable audit schema established and tested
- ✅ API scaffolding and event infrastructure complete
- ✅ Tracing and CI pipelines integrated
- ❌ Mobile offline-first framework incomplete

**Conclusion:** M0 is at **85.7% completion** and requires M0-6 closure before milestone sign-off.

---

# New WP Work Package Template Selector Integration (Aircraft Module)

## API Integration Points

| Integration Point | Method + Endpoint | Auth | Request Shape | Response Shape | Error Handling |
|---|---|---|---|---|---|
| Template registry list | `GET /api/v2/amro/master-data/work_order_templates?page=1&page_size=100&sort_by=updated_at&sort_dir=desc` | `Authorization: Bearer <access_token>` from `buildApiHeaders` | Query params only | `{ output: { records: WorkOrderTemplateRegistryRecord[] } }` | Network failures map to `Network error. Verify connectivity and try again.`; aborted requests map to `Request timed out. Please check your connection and retry.` |
| Create work package from selected template | `POST /api/v2/amro/work-orders?interface=create-work-order` | `Authorization: Bearer <access_token>` from `buildApiHeaders` | `AircraftWorkOrderCreateRequest` (includes `template_id`) | `{ output: { work_order_id?: string, id?: string } }` | `>=500` maps to `Work package service is temporarily unavailable. Try again shortly.`; other failures return API `error` payload text |
| Rollback after partial create failure | `DELETE /api/v2/amro/work-orders/{workOrderId}?rollback=1` | `Authorization: Bearer <access_token>` from `buildApiHeaders` | `{ transaction_id: string, rollback_reason: string }` | Best-effort operation | Failure tracked through telemetry event `rollback_failed`; user keeps local draft |

## TypeScript Contract Reference

```typescript
type WorkOrderTemplateRegistryItem = {
  id: string;
  templateCode: string;
  templateName: string;
  description: string;
  maintenanceType: 'line' | 'base' | 'hangar' | 'shop';
  version: string;
  active: boolean;
  scopeItems: string[];
  taskRows: Array<{
    id: string;
    taskNumber: string;
    ataCode: string;
    serialNumber: string;
    partNumber: string;
    description: string;
  }>;
};

type AircraftWorkOrderCreateRequest = {
  aircraft_id: string;
  work_order_number: string;
  title: string;
  opening_date: string;
  revision_number: string;
  revision_date: string | null;
  transmission_date: string;
  expected_reception_date: string;
  maintenance_release_date: string;
  work_reception_date: string;
  work_report_number: string;
  comments: string;
  ttaf_hours: number;
  validation_state: string;
  selected_task: {
    task_number: string;
    ata_code: string;
    serial_number: string;
    part_number: string;
    description: string;
  };
  source: string;
  trigger_source: string;
  maintenance_type: 'line' | 'base' | 'hangar' | 'shop';
  station: string;
  priority: string;
  status: string;
  planned_window: string;
  scope_items: string[];
  selected_task_ids: string[];
  template_id?: string;
  template_code?: string;
  reference_id: string;
  trigger_reference_id: string;
  triggered_at: string;
};
```

## Component Integration Guidelines

- New WP flow loads registry on dialog open and renders template options as `Template Name · vVersion · Description`.
- `Create New Work Package` remains disabled until `selectedWorkOrderTemplateId` is populated.
- Form validation blocks submission if template is missing, even after switching tabs.
- Empty registry state displays `No templates available. Add templates in Template Registry and refresh.`
- Async states:
  - Registry loading: `Loading template registry…`
  - Create submit loading: button label switches to `Creating…`
- Success feedback uses toast `Aircraft work package created`.
- Failure feedback uses normalized error mapping from `resolveWorkOrderApiErrorMessage`.

## Error Code and Message Mapping

| Condition | HTTP/Runtime Signal | User-Facing Message |
|---|---|---|
| Request timeout | `AbortError` | `Request timed out. Please check your connection and retry.` |
| Network unavailable | `TypeError: Failed to fetch` | `Network error. Verify connectivity and try again.` |
| Service unavailable | HTTP `5xx` | `Work package service is temporarily unavailable. Try again shortly.` |
| Validation: no template selected | Client-side validation | `Select a template before creating a new work package` |
| Validation: missing fields/tasks | Client-side validation | `Please resolve aircraft work package validation errors` |

## Configuration and Environment Requirements

- Requires authenticated session token resolved through `useAuth`/Supabase session flow.
- No additional environment variables are required for this selector; it uses existing AMRO API base routing (`/api/v2/amro/...`) and existing header builder utilities.
- Timeout behavior:
  - Template registry fetch timeout: `TEMPLATE_REGISTRY_TIMEOUT_MS = 12000`
  - Create mutation timeout: `WORK_PACKAGE_CREATE_TIMEOUT_MS = 20000`

# AMRO Quick Reference Guide
## Essential Information for Developers & Stakeholders

**Document ID:** GUIDE-AMRO-QUICK-001
**Version:** 1.0.0
**Date:** 2026-03-19
**Purpose:** Fast lookup guide for key AMRO specifications and decisions

---

## 1. Document Navigation Map

### Master Documents
| Document | Purpose | Owner | Update Frequency |
|---|---|---|---|
| **AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md** | Complete design, UI/UX, phases, testing, deployment | Architecture | Per PR |
| **amro-plugin-requirements-spec-v1.0.md** | Business requirements, traceability, compliance | Product | Quarterly |
| **amro-plugin-implementation.md** | 13-week Phase A task breakdown | Engineering | Per milestone |
| **amro-plugin-implementation-reference.md** | API contracts and schema reference | Backend | Per sprint |

### Quick References
- **AMRO_QUICK_REFERENCE_GUIDE.md** (this file) — Fast lookup for developers
- **AMRO_IMPLEMENTATION_ROADMAP.md** — Timeline and milestones
- **AMRO_DEPLOYMENT_PROCEDURES.md** — Step-by-step deployment guide

---

## 2. At-a-Glance Overview

### What is AMRO?
**Asset Maintenance, Repair, and Overhaul** domain for aviation and heavy asset maintenance.

### Strategic Goals (by 2026-Q3)
- Reduce MTTR by 30%
- Achieve 99.99% availability
- Support 10,000 concurrent users
- Enable 99.5% regulatory compliance
- Scale to 30+ locales and 160+ currencies

### Tech Stack
- **Backend:** Node.js 18+, NestJS, TypeScript
- **Database:** PostgreSQL 15+ (Supabase)
- **Mobile:** React Native 0.72+, Zustand
- **Events:** Kafka 3.x+
- **Observability:** OpenTelemetry
- **Testing:** Jest + Supertest + Playwright

### Architecture Position
AMRO is a **platform-integrated domain module** that reuses shared services (auth, RBAC, events, observability) while owning its own workflows, APIs, schema, and compliance logic.

---

## 3. Implementation Phases at a Glance

```
Phase 1 (Weeks 1-6)        Phase 2 (Weeks 7-12)        Phase 3 (Weeks 13-20)       Phase 4 (Weeks 21-26)
Core UI & APIs             Advanced UX & Mobile        Optimization & Polish       Integration & Scale
────────────────           ─────────────────           ──────────────────          ───────────────────
✓ Overview dashboard       ✓ Mobile task card          ✓ Accessibility (WCAG AA)   ✓ ERP adapters
✓ Work package list        ✓ Offline sync              ✓ Performance tuning        ✓ Reporting engine
✓ Work package detail      ✓ E-signatures              ✓ Error recovery            ✓ Analytics
✓ Task management          ✓ Compliance gates          ✓ Load optimization         ✓ Predictive AI
✓ Role-based actions       ✓ Materials planning        ✓ UAT & feedback            ✓ Multi-region DR
✓ CRUD APIs                ✓ Audit timeline            ✓ Documentation             ✓ Runbooks
✓ Kafka events             ✓ Scheduler board           ✓ Go-live prep              ✓ Production launch
                           ✓ Conflict resolution
```

---

## 4. Key Decisions & Rationale

### Decision 1: Schema-Per-Tenant Strategy
**What:** AMRO data isolated per tenant with row-level security (RLS)
**Why:** Compliance, data residency, regulatory separation (FAA/EASA/ISO 55000)
**Impact:** All queries must include `tenant_id` and pass RLS filter

**Code Pattern:**
```typescript
const query = supabase
  .from('work_packages')
  .select('*')
  .eq('tenant_id', currentTenant); // ← MANDATORY
```

### Decision 2: Immutable Audit Schema
**What:** Separate `mro_audit` schema with append-only records, no updates/deletes allowed
**Why:** 10-year regulatory retention, forensic replay, compliance evidence
**Impact:** Audit records created for every significant action (sign-off, status change, etc.)

**Structure:**
```sql
-- Cannot be updated or deleted
mro_audit.records (id, tenant_id, entity_id, action, context, signature, created_at)
mro_audit.trails (id, tenant_id, event_type, user_id, timestamp, action_description)
```

### Decision 3: Feature Flag Deployment
**What:** All Phase 1-4 features behind feature flags for gradual rollout
**Why:** Zero-disruption deployments, easy rollback, phased risk reduction
**Impact:** Feature flags toggled per tenant during rollout

**Workflow:**
```
Deploy Code (BLUE/GREEN) → Canary 1% → Monitor 30min → 25% → 100% → Keep 24h → Decommission
```

### Decision 4: Offline-First Mobile
**What:** Mobile tasks execute offline with local cache, sync when reconnected
**Why:** Field technicians need to work without connectivity
**Impact:** 30-day encrypted cache, conflict detection on sync, cryptographic signing

**Storage:**
```typescript
AsyncStorage → Zustand store → Sync queue → Server on reconnect
```

### Decision 5: Backward Compatible APIs
**What:** All API changes are additive (v1 → v1.1 → v2, never breaking)
**Why:** Multi-tenant platform with external integrators
**Impact:** Minimum 2-version API support window

**Versioning:**
```
/api/amro/v1/work-orders (current)
/api/amro/v1.1/work-orders (additive fields only)
/api/amro/v2/work-orders (next major, v1 still supported)
```

---

## 5. Component Reference (All 20 UI/UX Elements)

### Phase 1 (6 components)
| ID | Component | Effort | Status | Link |
|---|---|---|---|---|
| UX-001 | Overview KPI Dashboard | 2 days | Pending | Section 4.3.1 |
| UX-002 | Kanban Board | 4 days | Pending | Section 4.3.1 |
| UX-003 | List & Filters | 3 days | Pending | Section 4.3.2 |
| UX-004 | Create Drawer | 2 days | Pending | Section 4.3.1 |
| UX-005 | Detail Sheet | 3 days | Pending | Section 4.3.3 |
| UX-006 | Task List | 2 days | Pending | Section 4.3.3 |

### Phase 2 (9 components)
| ID | Component | Effort | Status | Link |
|---|---|---|---|---|
| UX-007 | Mobile Task Card | 4 days | In Progress | Section 4.3.4 |
| UX-008 | E-Signature Modal | 3 days | Pending | Section 4.3.5 |
| UX-009 | Evidence Capture | 2 days | Pending | Section 4.3 |
| UX-010 | Compliance Gate | 3 days | Pending | Section 4.3 |
| UX-011 | Materials Panel | 2.5 days | Pending | Section 4.3 |
| UX-012 | Qualification Chips | 1.5 days | Pending | Section 4.3 |
| UX-013 | Audit Timeline | 3 days | In Progress | Section 4.3 |
| UX-015 | Sync Status Banner | 2 days | Pending | Section 4.3 |
| UX-019 | Scheduler Board | 3 days | Pending | Section 4.3 |

### Phase 3-4 (5 components)
| ID | Component | Effort | Status | Link |
|---|---|---|---|---|
| UX-014 | Compliance Filters | 2 days | Pending | Section 6.4 |
| UX-016 | Error Fallback States | 2 days | In Progress | Section 6.4 |
| UX-017 | Role-Aware Actions | 1.5 days | Pending | Section 6.2 |
| UX-018 | Export & Reporting | 2 days | Pending | Section 6.5 |
| UX-020 | ERP Adapter Panel | 3 days | Pending | Section 6.5 |

---

## 6. Database Tables (Operational Layer)

### Core Tables
```sql
-- Aircraft/Asset Registry
aircraft (id, tenant_id, tail_number, aircraft_model, status, created_at, updated_at)

-- Components/Parts (Serialized items)
components (id, tenant_id, aircraft_id, part_number, serial_number, ata_chapter, llp_*, status)

-- Main Work Orders
work_packages (id, tenant_id, aircraft_id, work_type, title, priority, status, estimated_*, created_at)

-- Individual Tasks within WP
tasks (id, tenant_id, work_package_id, sequence, description, procedure_reference, steps, status)

-- Staff Qualifications
staff_qualifications (id, tenant_id, technician_id, rating, scope, issued_date, expiration_date, can_certify_release)

-- Execution Records
maintenance_events (id, tenant_id, task_id, executed_by, execution_start, execution_end, evidence, signed_by, signature_method)

-- Materials/Parts Planning
work_package_materials (id, tenant_id, work_package_id, component_id, action, required_qty, allocated_qty, status)
```

### Immutable Audit Tables (mro_audit schema)
```sql
-- Append-only audit records
mro_audit.records (id, tenant_id, record_type, entity_id, entity_type, actor_id, action, context, signature, created_at)

-- Compliance replay trail
mro_audit.trails (id, tenant_id, event_type, entity_type, entity_id, user_id, timestamp, action_description, regulatory_context)
```

---

## 7. API Endpoints (Quick Reference)

### Work Orders
```
GET    /api/amro/v1/work-orders              # List with filters
GET    /api/amro/v1/work-orders/:id          # Get detail
POST   /api/amro/v1/work-orders              # Create
PATCH  /api/amro/v1/work-orders/:id          # Update
PATCH  /api/amro/v1/work-orders/:id/status   # Change status
```

### Tasks
```
GET    /api/amro/v1/work-orders/:id/tasks    # List tasks in WP
POST   /api/amro/v1/work-orders/:id/tasks    # Add task
PATCH  /api/amro/v1/tasks/:id                # Update task
POST   /api/amro/v1/tasks/:id/complete       # Mark complete
```

### Materials
```
GET    /api/amro/v1/work-orders/:id/materials
POST   /api/amro/v1/work-orders/:id/materials
PATCH  /api/amro/v1/materials/:id
```

### Audit & Compliance
```
GET    /api/amro/v1/work-orders/:id/audit-trail    # Immutable history
POST   /api/amro/v1/work-orders/:id/sign-off       # E-signature
GET    /api/amro/v1/compliance/audit-replay        # Replay at point in time
```

### Metrics & Dashboard
```
GET    /api/amro/v1/metrics/overview         # KPI data
GET    /api/amro/v1/metrics/throughput       # Performance metrics
GET    /api/amro/v1/compliance/scorecard     # Compliance scores
```

### Master Data CRUD (Settings)
```
GET    /api/v2/amro/master-data/:entity?page=1&page_size=25&search=...
POST   /api/v2/amro/master-data/:entity
PATCH  /api/v2/amro/master-data/:entity/:id
DELETE /api/v2/amro/master-data/:entity/:id
POST   /api/v2/amro/master-data/:entity               # body.operation=bulk_import
GET    /api/v2/amro/master-data/:entity/export?format=csv
```

### Master Data Entities
- aircraft
- parts_inventory
- suppliers
- maintenance_facilities
- work_centers
- skill_codes
- regulator_profiles
- shift_calendars
- work_package_templates

### Master Data Form Usage and Validation
- Each entity has a dedicated create/update form with required field enforcement before submit.
- All master data calls require scoped headers (`x-tenant-id`, `x-franchise-id`) and bearer auth.
- Destructive actions use explicit confirmation before delete execution.
- Search and filtering are supported through `search` and pagination query parameters.
- Bulk import uses `operation: "bulk_import"` with `records` array payload.
- Referential checks are enforced for linked records (for example `parts_inventory.supplier_id`).
- Every create/update/delete operation writes an audit event for compliance traceability.

---

## 8. Event Topics (Kafka)

### Published Events
```
amro.work_order.created       # New WO created
amro.work_order.updated       # WO fields changed
amro.work_order.status_changed # Status transition (with audit)
amro.work_order.closed        # WO completed and signed

amro.task.started             # Task execution began
amro.task.completed           # Task finished
amro.task.signed              # E-signature captured

amro.maintenance_event.recorded # Evidence logged
amro.materials.allocated       # Parts reserved
amro.compliance.gate_passed    # Release gate cleared
```

### Event Structure
```typescript
{
  event_type: 'amro.work_order.created',
  tenant_id: 'uuid',
  work_order_id: 'uuid',
  timestamp: '2026-03-19T14:32:45Z',
  idempotency_key: 'uuid',  // For deduplication
  data: { ... }
}
```

---

## 9. Security & Compliance Checklist

### Every Component Must Have:
- [ ] Tenant isolation via RLS (tenant_id filter)
- [ ] Role-based action visibility (RBAC)
- [ ] Audit event logging to mro_audit schema
- [ ] Encryption for sensitive data (credentials, evidence)
- [ ] OWASP Top 10 protection (XSS, CSRF, injection)
- [ ] Input validation and type checking
- [ ] Error handling without sensitive data exposure
- [ ] Rate limiting on public endpoints

### Every Deployment Must Verify:
- [ ] No auth tokens in logs
- [ ] No cross-tenant data leakage in error messages
- [ ] RLS policies enforced on all tables
- [ ] Audit trail populated for all sign-offs
- [ ] Signature validation working
- [ ] Feature flag configuration correct

---

## 10. Performance Targets (SLAs)

| Metric | Target | P-Percentile | Measurement |
|---|---|---|---|
| Dashboard Load | <1s | p99 | Initial render time |
| List Filter | <300ms | p95 | Filter applied time |
| Detail View Save | <200ms | p95 | Update API response |
| Mobile Task Submit (offline) | <100ms | p95 | Local storage write |
| Mobile Sync | <500ms/item | p99 | Per-item upload time |
| Search Response | <200ms | p95 | Debounced query result |
| Kanban Drag | <200ms | p99 | UI response time |
| Signature Capture | <500ms | p95 | Validation time |

### Scalability Targets
- 10,000 concurrent users
- 5,000 transactions per second (TPS)
- 99.99% availability SLA
- RTO (Recovery Time Objective): ≤5 minutes
- RPO (Recovery Point Objective): ≤1 minute

---

## 11. Testing Checklist (Before Merge)

### Unit Tests
- [ ] Component renders correctly
- [ ] State changes work (loading, error, success)
- [ ] User interactions trigger correct handlers
- [ ] Data validation works

### Integration Tests
- [ ] API calls return correct data
- [ ] Auth/RLS filters applied
- [ ] Tenant isolation enforced
- [ ] Error handling works

### Accessibility Tests
- [ ] Keyboard navigation works
- [ ] Tab order is logical
- [ ] Screen reader announces content
- [ ] Color contrast ≥4.5:1

### Security Tests
- [ ] No XSS vulnerabilities (DOMPurify check)
- [ ] CSRF token present in forms
- [ ] SQL injection prevented (parameterized queries)
- [ ] Auth boundaries enforced

### Performance Tests
- [ ] Load time <target
- [ ] Memory usage acceptable
- [ ] No memory leaks
- [ ] Render time <target

---

## 12. Common Patterns

### Pattern 1: Tenant-Safe Query
```typescript
// ✅ CORRECT: Tenant filter included
const { data } = await supabase
  .from('work_packages')
  .select('*')
  .eq('tenant_id', currentTenant)
  .eq('id', wpId);

// ❌ WRONG: Missing tenant filter
const { data } = await supabase
  .from('work_packages')
  .select('*')
  .eq('id', wpId); // Could leak other tenant's data!
```

### Pattern 2: Loading States
```typescript
// ✅ CORRECT: Explicit states
const [data, setData] = useState(null);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

if (loading) return <Skeleton />;
if (error) return <ErrorBoundary error={error} />;
if (!data) return <EmptyState />;
return <Content data={data} />;

// ❌ WRONG: Hidden state dependencies
const [state, setState] = useState({});
```

### Pattern 3: Audit Event Logging
```typescript
// ✅ CORRECT: Log to immutable audit schema
await auditLog.record({
  tenant_id: currentTenant,
  entity_id: wpId,
  entity_type: 'work_package',
  action: 'status_changed',
  actor_id: currentUser.id,
  context: {
    old_status: 'open',
    new_status: 'planning'
  },
  timestamp: new Date()
});

// ❌ WRONG: No audit trail
updateWorkPackage(wpId, { status: 'planning' });
```

### Pattern 4: Error Handling
```typescript
// ✅ CORRECT: User-safe error messages
try {
  const result = await updateWP(id, data);
  showToast('Work package updated', 'success');
} catch (error) {
  logger.error('Update failed:', error); // Log full error
  showToast('Failed to update work package. Please try again.'); // User-safe message
}

// ❌ WRONG: Exposed error details
showToast(`Error: ${error.message}`); // Could expose internal details
```

---

## 13. Troubleshooting Guide

### "Data not appearing in list"
1. Check tenant_id in query matches current tenant
2. Verify RLS policies are active on table
3. Check user has SELECT permission via auth context
4. Review Postgres logs for RLS filter errors

### "Audit records not created"
1. Verify `mro_audit.records` insert is called
2. Check `immutable` trigger is active (prevents updates)
3. Verify tenant_id is set in audit record
4. Check user has INSERT permission on audit tables

### "Offline sync fails with conflict"
1. Check version numbers on local vs server
2. Run conflict resolver (keep local/use server/merge)
3. Verify signature is valid post-merge
4. Re-attempt sync after conflict resolved

### "E-signature validation fails"
1. Check signature method matches user's auth method
2. Verify user has `can_certify_release` permission
3. Check signature hasn't expired (timestamp within 24h)
4. Verify cryptographic hash matches task data

### "Performance degradation on large dataset"
1. Check pagination is working (limit 25, offset N)
2. Verify indexes exist on filtered columns
3. Check no N+1 queries in component
4. Profile with OpenTelemetry traces

---

## 14. Settings Sub-Module Migration

### Routing and Navigation
- Primary AMRO settings entry: `/dashboard/amro/settings`
- Master data location after migration: `/dashboard/amro/settings/master-data`
- Backward-compatible redirect retained: `/dashboard/amro/master-data` → `/dashboard/amro/settings/master-data`
- AMRO navigation item now points to **Settings** instead of direct **Master Data**

### Frontend Module Structure
- Settings dashboard page: `src/features/module-amro/settings/pages/AmroSettingsPage.tsx`
- Migrated master data page: `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- Backward-compatible export bridge: `src/features/module-amro/pages/AmroMasterDataPage.tsx`
- AMRO module exports updated in: `src/features/module-amro/index.ts`
- AMRO route wiring updated in: `src/App.tsx`
- AMRO menu wiring updated in: `src/config/navigation.ts`

### Migration Notes for Maintenance
- All CRUD operations continue to use `/api/v2/amro/master-data/:entity` endpoints.
- Tenant/franchise/user scoping headers are unchanged and still required for every request.
- Data persistence behavior remains unchanged because migration is UI-route and module-structure focused.
- Access checks now explicitly enforce `edit_aircraft_records` on AMRO settings and master data routes.

---

## 15. Key Contacts & Resources

### Documentation
- **Main Spec:** `docs/AMRO_COMPREHENSIVE_DESIGN_SPECIFICATION.md`
- **Requirements:** `artifacts/mro/analysis/amro-plugin-requirements-spec-v1.0.md`
- **Implementation Plan:** `docs/plans/2026-03-19-amro-plugin-implementation.md`
- **API Reference:** `docs/plans/2026-03-19-amro-plugin-implementation-reference.md`

### Key Files
- **Backend Module:** `src/modules/amro/`
- **Mobile:** `mobile/src/`
- **Migrations:** `supabase/migrations/20260319_*.sql`
- **CI/CD:** `.github/workflows/amro-ci.yml`

### Standards
- **Design System:** Platform component library
- **Accessibility:** WCAG 2.1 Level AA
- **Security:** OWASP Top 10 controls
- **Compliance:** FAA/EASA/ISO 55000 requirements

---

**Last Updated:** 2026-03-24
**Next Review:** After each phase completion

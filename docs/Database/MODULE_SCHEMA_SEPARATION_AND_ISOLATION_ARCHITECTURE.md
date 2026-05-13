# Module Schema Separation and Database Isolation Architecture

## 1. Objective and Scope

This document defines a production-grade architecture for module schema separation and database-level isolation across all existing modules in the platform.

Execution companion:

- `docs/Database/MODULE_SCHEMA_EXECUTION_MATRIX.md`

The target outcomes are:

- deterministic ownership boundaries per module;
- hardened least-privilege database access;
- migration with backward compatibility and minimal downtime;
- measurable operational controls for performance, reliability, and security.

## 2. Core Design Principles

- Domain-driven design with bounded contexts per module.
- Single source of truth for each entity.
- Normalized schema design at minimum 3NF.
- Explicit ownership and stewardship for every module schema.
- Backward compatibility for at least 2 release cycles during transition.

## 3. Standardized Naming and Schema Model

### 3.1 Schema Boundary Rules

- Every module receives an isolated PostgreSQL schema named:
  - `module_<module_name>`
- Every table in each module schema uses the table prefix:
  - `module_<module_name>_<entity>`
- Shared reference data remains in a dedicated schema:
  - `module_shared`
- Cross-module joins are disallowed in write paths and limited in read paths through controlled views or APIs.

### 3.2 Naming Convention Standard

- Table:
  - `module_<module_name>_<entity>`
  - Example: `module_crm_leads`, `module_amro_work_packages`
- Index:
  - `idx_<module_name>_<table>_<columns>`
  - Example: `idx_crm_module_crm_leads_tenant_id_created_at`
- Primary key constraint:
  - `pk_<module_name>_<table>`
  - Example: `pk_crm_module_crm_leads`
- Foreign key constraint:
  - `fk_<module_name>_<table>_<referenced_table>`
  - Example: `fk_amro_module_amro_stock_ledger_module_amro_parts`
- View:
  - `vw_<module_name>_<purpose>`
  - Example: `vw_crm_pipeline_summary`
- Trigger:
  - `trg_<module_name>_<table>_<purpose>`
- Function:
  - `fn_<module_name>_<purpose>`

### 3.3 Ownership Registry

Maintain a module ownership registry with:

- module name;
- schema name;
- technical owner;
- backup owner;
- data steward;
- on-call rotation group;
- SLA tier.

## 4. Data Organization and Governance Standards

### 4.1 Single Source of Truth Rules

- Each business entity has one authoritative table in one module schema.
- Replicas in other modules are materialized projections only.
- Derived or denormalized structures must reference authoritative record identifiers.

### 4.2 Normalization Rules

- Minimum 3NF for all transactional tables.
- Reference catalogs normalized into lookup tables.
- No multi-valued attributes in scalar columns.
- JSONB usage only for clearly non-relational extension metadata.

### 4.3 Documentation Requirements Per Module

Each module must maintain:

- ERD covering all tables, relationships, and cardinalities.
- Data dictionary with:
  - field name;
  - type;
  - nullability;
  - default;
  - constraints;
  - PII/sensitivity class;
  - description.
- Change log mapping schema versions to release tags.

## 5. Database-Level Isolation Architecture

### 5.1 Schema and Role Separation

For each module `<module_name>`, create:

- schema: `module_<module_name>`
- roles:
  - `module_<module_name>_ro`
  - `module_<module_name>_rw`
  - `module_<module_name>_admin`

Privileges follow least privilege:

- `ro`: SELECT only on module-owned tables/views.
- `rw`: SELECT/INSERT/UPDATE/DELETE on module-owned tables, no DDL.
- `admin`: DDL + DML limited to module schema.

### 5.2 Multi-Tenant RLS Model

RLS is mandatory for tenant-bound tables:

- policy key columns:
  - `tenant_id`
  - `franchise_id` where applicable.
- request context settings:
  - `app.current_tenant_id`
  - `app.current_franchise_id`
  - `app.current_role`

Policy pattern:

- tenant match enforced for all reads/writes;
- optional franchise scoping for franchise-bound records;
- platform admin override gated by explicit policy and audit logging.

### 5.3 Connection Pooling (PgBouncer)

Module pool profile:

- `pool_mode = transaction`
- `default_pool_size = 100` per module pool
- `max_client_conn` sized by module traffic tier
- `query_timeout = 30s`
- `server_idle_timeout = 30s`

Each module uses a dedicated PgBouncer user and logical pool mapping.

### 5.4 Network-Level Isolation

Critical modules (finance, identity, payment, audit):

- isolated cluster or dedicated VLAN segment;
- dedicated subnet per critical module group;
- east-west traffic restricted through allowlist security groups;
- mTLS required between service tier and DB proxies.

## 6. Cross-Schema Access Control Policy

### 6.1 Explicit GRANT-Based Access

Cross-schema access is denied by default.

Allow only explicit read/procedure access such as:

- approved reporting views;
- event projection readers;
- controlled integration functions.

### 6.2 REVOKE and Audit Trail Procedure

Privilege removal process:

1. raise access revocation request ticket;
2. execute REVOKE migration script;
3. persist before/after privilege snapshot in audit store;
4. validate no orphan role grants remain.

### 6.3 Cross-Schema Query Auditing

Enable audit logging for all cross-schema queries capturing:

- database user;
- timestamp;
- query text;
- execution time;
- source application/service identity;
- correlation id.

## 7. Security Controls

### 7.1 Encryption

- In transit: TLS 1.3 enforced for all DB connections.
- At rest: AES-256 storage encryption.
- Sensitive fields:
  - application-level encryption or pgcrypto for selective columns.

### 7.2 Certificate-Based Authentication

- client certificates issued per module service identity.
- short-lived certs with automated renewal.
- cert pinning for DB proxy endpoints in critical modules.

### 7.3 Certificate Rotation Procedure

- rotate every 60 days (or earlier on incident).
- 3-step overlap:
  - issue new cert;
  - deploy dual trust chain;
  - retire old cert after connection churn threshold met.

## 8. Phased Migration Architecture

### Phase 0: Discovery and Baseline

- inventory tables and map each to module bounded context.
- classify entities:
  - authoritative;
  - shared reference;
  - derived projection.
- baseline performance and utilization metrics.

### Phase 1: Isolated Schema Bootstrap

- create module schemas and roles.
- deploy naming compliance checks.
- introduce RLS policies in new schemas.
- no production cutover yet.

### Phase 2: Dual-Write Transition (minimum 2 release cycles)

- implement dual-write from legacy + new schema.
- enforce write-through cache updates.
- trigger-based synchronization for legacy parity.
- conflict resolution strategy:
  - latest-write-wins with vector timestamp fallback;
  - deterministic tie-break on source priority.

### Phase 3: Read Cutover by Feature Flag

- progressive read routing:
  - percentage-based rollout;
  - geographic rollout segments.
- monitor consistency and latency SLOs.
- rollback by flipping read path flag to legacy source.

### Phase 4: Write Cutover and Legacy Freeze

- switch primary writes to module schema.
- keep reverse sync to legacy for stabilization window.
- freeze legacy schema writes after stability threshold.

### Phase 5: Decommission Legacy Paths

- disable dual-write triggers;
- archive legacy tables according to retention policy;
- finalize ownership and schema certification.

## 9. Migration Validation and Rollback Controls

### 9.1 Validation Controls

- count checks per entity:
  - source vs target row counts.
- checksum checks:
  - hash aggregates for deterministic subsets.
- sample data checks:
  - random and deterministic key sample comparisons.
- referential integrity checks:
  - orphan detection and FK parity.

### 9.2 Performance Benchmarking

Track pre/post metrics:

- p50/p95/p99 query latency;
- connection pool utilization;
- CPU, memory, IO;
- lock wait and deadlock rates.

### 9.3 Downtime Minimization Strategy

- blue-green DB cutover per module;
- replication lag threshold gating (for example: block cutover if lag > 5s);
- automated failover playbooks;
- target downtime:
  - less than 5 minutes per module.

### 9.4 Rollback Plan

Rollback triggers:

- consistency drift above threshold;
- p95 latency regression above threshold;
- error-rate increase above threshold.

Rollback steps:

1. disable new read path via flag;
2. restore legacy write path;
3. replay durable outbox events;
4. validate integrity checkpoints;
5. issue incident and recovery report.

## 10. Monitoring, Alerting, and On-Call Operations

### 10.1 Post-Migration Monitoring

- schema-level query error rate.
- RLS deny event rate.
- cross-schema query volume.
- pool saturation by module.
- replication lag and failover health.

### 10.2 Alert Thresholds

- p95 DB latency > 200ms for 10 minutes.
- pool utilization > 85% for 5 minutes.
- replication lag > 5 seconds for 3 minutes.
- failed migrations > 0 in production window.
- consistency check failure > 0.

### 10.3 Escalation Procedure

- L1 on-call DBA within 5 minutes.
- L2 module owner and platform SRE within 15 minutes.
- L3 architecture review board for sustained incidents > 30 minutes.

## 11. Acceptance Criteria

- 100% module schemas mapped and owned.
- 100% critical tables protected with RLS and role-scoped access.
- 0 unauthorized cross-schema access paths.
- migration downtime under 5 minutes per module.
- no critical data integrity defect in post-cutover verification window.

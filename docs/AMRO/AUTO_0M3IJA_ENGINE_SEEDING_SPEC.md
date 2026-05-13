# AUTO-0M3IJA Engine Seeding Specification

## Scope
- Aircraft Tail Number: `AUTO-0M3IJA`
- Registration: `AUTO-0M3IJA`
- Aircraft Type: `auto_seeded`
- Model: `AMRO Bootstrap`
- Migration: `supabase/migrations/20260404100000_amro_auto_0m3ija_engine_comprehensive_seed.sql`
- Primary RPC: `public.seed_auto_0m3ija_engine_dataset()`
- Verification RPC: `public.verify_auto_0m3ija_engine_seed()`

## Design Summary
- Reuses existing AMRO core schema (`aircraft`, `components`, `maintenance_events`, `maintenance_schedule`, `asset_health_signals`, `work_orders`, `parts_inventory`, `flight_logs`, `compliance_obligations`, `compliance_records`, `staff_qualifications`).
- Adds engine-specific versioning and history where existing tables were insufficient:
- `engine_configuration_versions`
- `engine_parameter_history`
- `engine_seed_audit_runs`
- Extends existing entities for hierarchy and audit completeness:
- `components.parent_component_id`, `components.component_role`, `components.engine_module_code`, `components.deleted_at`
- `maintenance_events.event_status`, `maintenance_events.updated_at`, `maintenance_events.updated_by`, `maintenance_events.deleted_at`
- `asset_health_signals.flight_phase`, effective date columns, audit columns

## Engine Hierarchy Coverage
- Turbine assembly modules: left and right roots.
- Fuel subsystem: manifolds and pumps linked to each module.
- Lubrication subsystem: dedicated pumps per side.
- Ignition subsystem: exciters per side.
- Exhaust subsystem: mixers per side.
- Airframe interface links:
- Hydraulic interface
- Electrical interface
- Pneumatic interface
- Relationship model:
- Parent-child enforced through `components.parent_component_id` foreign key.
- Aircraft ownership enforced through `components.aircraft_id`.

## Seeded Workflow Data
- Maintenance scheduling:
- Includes statuses supporting demo workflow interpretation (`planned`, `near_due`, `due`, `overdue`, `completed`) plus human labels in metadata (`scheduled`, `in-progress`, `completed`, `overdue`).
- Work package lifecycle:
- Multiple work package statuses (`planning`, `approved`, `scheduled`, `in_progress`, `completed`).
- Maintenance events:
- 500 lifecycle events with `event_status` = `scheduled | in_progress | completed | overdue`.
- Event payload includes component part/serial and regulatory references.
- Performance monitoring:
- 240 `asset_health_signals` rows with `flight_phase` coverage (`takeoff`, `climb`, `cruise`, `descent`, `landing`).
- 1000 `engine_parameter_history` rows covering:
- `egt_c`
- `n1_pct`
- `n2_pct`
- `fuel_flow_lbh`
- `vibration_ips`
- `thrust_takeoff_lbf`
- `thrust_cruise_lbf`
- `sfc_lbf_per_lbf_hr`
- `oil_pressure_psi`
- `efficiency_pct`
- Compliance:
- AD/SB-style references in obligations and event payloads.
- Compliance records linked to obligations and maintenance events.

## Validation and Constraint Model
- Parameter limits are enforced by trigger-backed validator:
- EGT bounded to realistic redline range.
- N1/N2 bounded to rotor operating envelope.
- Fuel flow, vibration, thrust, SFC, oil pressure bounded.
- Maintenance chronology:
- Trigger rejects events that backdate earlier than latest event for same component scope.
- Identifier validation:
- Trigger validates aviation-style part number, serial number, and regulatory reference formats.
- Effective date ordering:
- `engine_parameter_history` and `engine_configuration_versions` enforce `effective_to >= effective_from`.

## Audit and Versioning Controls
- `created_at`, `updated_at`, `deleted_at` coverage added/standardized for engine-seed entities.
- `created_by` and `updated_by` fields populated with actor user.
- `engine_configuration_versions` provides explicit version lineage per component.
- `engine_parameter_history` tracks parameter changes with sample and effective timestamps.
- `engine_seed_audit_runs` logs per-run execution metrics and seeded volume counts.

## Security and Access Control
- RLS enabled for all new engine-specific tables.
- Policies follow platform standard:
- Platform admin full access via `public.is_platform_admin(auth.uid())`.
- Tenant/franchise scoped access via `public.get_user_tenant_id()` and `public.get_user_franchise_id()`.

## Realistic Value Justification
- Takeoff thrust seeded in 31k-lbf class to align with required 25k-35k envelope.
- Cruise thrust seeded near 6.7k-lbf band to align with required 5k-8k envelope.
- SFC seeded around 0.42-0.51 to align with required 0.35-0.55 envelope.
- EGT, N1/N2, vibration, and oil pressure generated in bounded operational ranges.
- Efficiency parameter includes gradual decline metadata to demonstrate degradation curves.

## Execution
- Apply migration through standard migration workflow.
- Execute seed RPC:

```sql
select public.seed_auto_0m3ija_engine_dataset(
  p_tenant_id := null,
  p_franchise_id := null,
  p_actor_user_id := null,
  p_force := true
);
```

- Verify dataset:

```sql
select *
from public.verify_auto_0m3ija_engine_seed(null);
```

## Expected Minimum Volumes
- Engine parameter history: `>= 1000`
- Maintenance events: `>= 500`
- Performance monitoring points: `>= 200`

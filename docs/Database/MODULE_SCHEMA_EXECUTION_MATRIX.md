# Module-by-Module Schema Execution Matrix

This matrix operationalizes `MODULE_SCHEMA_SEPARATION_AND_ISOLATION_ARCHITECTURE.md` into an executable migration sequence for `CRM`, `AMRO`, `UIM`, `Finance`, and `Shared`.

## 1. Module Inventory and Target Schemas

| Module | Current Primary Tables (public) | Target Schema | Target Table Prefix | Module Owner |
| --- | --- | --- | --- | --- |
| CRM | `leads`, `accounts`, `contacts`, `opportunities`, `activities`, `quotes`, `quote_items`, `quote_options`, `quote_versions` | `module_crm` | `module_crm_` | CRM Product Engineering |
| AMRO | `aircraft`, `task_templates`, `work_packages`, `tasks`, `work_package_materials`, `maintenance_events`, `parts_inventory`, `amro_stock_ledger_transactions`, `amro_stock_reconciliation_runs`, `amro_tooling_registry`, `amro_compliance_requirements_enhanced` | `module_amro` | `module_amro_` | AMRO Engineering |
| UIM | `uim_catalog_items`, `uim_inventory_items`, `uim_inventory_ledger`, `uim_inventory_reservations`, `uim_inventory_commands`, `uim_inventory_projection_snapshots`, `uim_form_records`, `uim_amro_sync_jobs`, `uim_amro_sync_audit` | `module_uim` | `module_uim_` | UIM Platform Team |
| Finance | `invoices`, `invoice_items`, `payments`, `payment_transactions`, `currencies`, `tax_jurisdictions`, `margin_rules` | `module_finance` | `module_finance_` | Finance Platform Team |
| Shared | `tenants`, `franchises`, `profiles`, `user_roles`, `user_custom_roles`, `user_preferences`, `platform_domains`, `tenant_domain_assignments`, `user_domain_assignments`, `system_logs` | `module_shared` | `module_shared_` | Platform Core Team |

## 2. Exact Migration Order (Global Sequence)

### Wave 0: Foundation and Controls

1. Bootstrap module schemas and roles (`ro/rw/admin`) for all 5 modules.
2. Deploy naming compliance checks and ownership registry records.
3. Deploy cross-schema audit objects and query logging hooks.
4. Enable certificate auth + TLS enforcement + PgBouncer module pools.

### Wave 1: Shared Module (Dependency Root)

1. `tenants` -> `module_shared_tenants`
2. `franchises` -> `module_shared_franchises`
3. `profiles` -> `module_shared_profiles`
4. `user_roles` -> `module_shared_user_roles`
5. `user_custom_roles` -> `module_shared_user_custom_roles`
6. `user_preferences` -> `module_shared_user_preferences`
7. `platform_domains` -> `module_shared_platform_domains`
8. `tenant_domain_assignments` -> `module_shared_tenant_domain_assignments`
9. `user_domain_assignments` -> `module_shared_user_domain_assignments`
10. `system_logs` -> `module_shared_system_logs`

### Wave 2: CRM Module

1. `accounts` -> `module_crm_accounts`
2. `contacts` -> `module_crm_contacts`
3. `leads` -> `module_crm_leads`
4. `opportunities` -> `module_crm_opportunities`
5. `activities` -> `module_crm_activities`
6. `quotes` -> `module_crm_quotes`
7. `quote_versions` -> `module_crm_quote_versions`
8. `quote_items` -> `module_crm_quote_items`
9. `quote_options` -> `module_crm_quote_options`
10. `quote_charges` -> `module_crm_quote_charges`

### Wave 3: Finance Module

1. `currencies` -> `module_finance_currencies`
2. `tax_jurisdictions` -> `module_finance_tax_jurisdictions`
3. `margin_rules` -> `module_finance_margin_rules`
4. `invoices` -> `module_finance_invoices`
5. `invoice_items` -> `module_finance_invoice_items`
6. `payments` -> `module_finance_payments`
7. `payment_transactions` -> `module_finance_payment_transactions`

### Wave 4: UIM Module

1. `uim_catalog_items` -> `module_uim_catalog_items`
2. `uim_inventory_items` -> `module_uim_inventory_items`
3. `uim_inventory_ledger` -> `module_uim_inventory_ledger`
4. `uim_inventory_reservations` -> `module_uim_inventory_reservations`
5. `uim_inventory_commands` -> `module_uim_inventory_commands`
6. `uim_inventory_projection_snapshots` -> `module_uim_inventory_projection_snapshots`
7. `uim_form_records` -> `module_uim_form_records`
8. `uim_amro_sync_jobs` -> `module_uim_amro_sync_jobs`
9. `uim_amro_sync_audit` -> `module_uim_amro_sync_audit`

### Wave 5: AMRO Module

1. `manufacturers` -> `module_amro_manufacturers`
2. `assembly_types` -> `module_amro_assembly_types`
3. `assembly_models` -> `module_amro_assembly_models`
4. `aircraft` -> `module_amro_aircraft`
5. `airports` -> `module_amro_airports`
6. `ata_codes` -> `module_amro_ata_codes`
7. `task_templates` -> `module_amro_task_templates`
8. `work_package_templates` -> `module_amro_work_package_templates`
9. `work_package_template_task_templates` -> `module_amro_work_package_template_task_templates`
10. `work_packages` -> `module_amro_work_packages`
11. `tasks` -> `module_amro_tasks`
12. `work_package_materials` -> `module_amro_work_package_materials`
13. `maintenance_events` -> `module_amro_maintenance_events`
14. `parts_inventory` -> `module_amro_parts_inventory`
15. `amro_stock_ledger_transactions` -> `module_amro_stock_ledger_transactions`
16. `amro_stock_valuation_layers` -> `module_amro_stock_valuation_layers`
17. `amro_stock_reconciliation_runs` -> `module_amro_stock_reconciliation_runs`
18. `amro_stock_reconciliation_items` -> `module_amro_stock_reconciliation_items`
19. `amro_stock_period_closes` -> `module_amro_stock_period_closes`
20. `amro_stock_approval_queue` -> `module_amro_stock_approval_queue`
21. `amro_stock_audit_timeline` -> `module_amro_stock_audit_timeline`
22. `amro_tooling_registry` -> `module_amro_tooling_registry`
23. `amro_tooling_instances` -> `module_amro_tooling_instances`
24. `amro_tool_reservations` -> `module_amro_tool_reservations`
25. `amro_calibration_logs` -> `module_amro_calibration_logs`
26. `amro_compliance_ad_sb_registry` -> `module_amro_compliance_ad_sb_registry`
27. `amro_compliance_requirements_enhanced` -> `module_amro_compliance_requirements_enhanced`
28. `amro_compliance_documents` -> `module_amro_compliance_documents`

## 3. Risk Score and Cutover Window Matrix

Risk scale:

- `1-3`: low
- `4-6`: medium
- `7-8`: high
- `9-10`: critical

| Module | Risk Score | Primary Risks | Cutover Window (UTC) | Max Planned Downtime | Rollback SLA |
| --- | --- | --- | --- | --- | --- |
| Shared | 9 | identity and tenancy dependency blast radius | Sunday 00:00-02:00 | 5 min | 10 min |
| CRM | 7 | quote consistency and workflow coupling | Sunday 02:00-04:00 | 5 min | 15 min |
| Finance | 8 | invoice/payment correctness and reconciliation | Sunday 04:00-06:00 | 5 min | 10 min |
| UIM | 6 | projection lag and sync pipeline backpressure | Sunday 06:00-08:00 | 5 min | 15 min |
| AMRO | 8 | high table count, complex task/stock/workflow dependencies | Sunday 08:00-12:00 | 5 min per sub-batch | 10 min |

## 4. Module-Level Cutover Runbook (Per Module)

For each module wave:

1. Pre-cutover:
  - execute dry-run migration and validation SQL;
  - verify replication lag < 5s;
  - verify PgBouncer pool saturation < 70%.
2. Transition:
  - enable dual-write triggers;
  - route 5% read traffic to new schema;
  - validate checksums and consistency.
3. Expansion:
  - increase read routing to 25%, 50%, 100%;
  - keep writes dual for 2 release cycles.
4. Stabilization:
  - monitor p95, error rate, RLS denials, lock waits.
5. Decision:
  - continue cutover or rollback by feature flag and reverse routing.

## 5. Validation Matrix by Module

| Validation Type | Shared | CRM | Finance | UIM | AMRO |
| --- | --- | --- | --- | --- | --- |
| Count parity | required | required | required | required | required |
| Checksum parity | required | required | required | required | required |
| Sample row compare | required | required | required | required | required |
| FK integrity checks | required | required | required | required | required |
| RLS enforcement tests | required | required | required | required | required |
| Query latency benchmark | required | required | required | required | required |
| Pool utilization benchmark | required | required | required | required | required |

## 6. Feature Flag Rollout Matrix

| Flag | Module | Type | Initial | Ramp | Full |
| --- | --- | --- | --- | --- | --- |
| `db_schema_shared_read_v2` | Shared | percentage + region | 5% | 25/50/75 | 100% |
| `db_schema_crm_read_v2` | CRM | percentage + region | 5% | 25/50/75 | 100% |
| `db_schema_finance_read_v2` | Finance | percentage + region | 5% | 25/50/75 | 100% |
| `db_schema_uim_read_v2` | UIM | percentage + region | 5% | 25/50/75 | 100% |
| `db_schema_amro_read_v2` | AMRO | percentage + region | 5% | 25/50/75 | 100% |
| `db_schema_<module>_write_v2` | all | write switch | off | canary tenant set | on |

## 7. Monitoring and Escalation Targets

Alert thresholds during each module cutover:

- p95 DB latency > 200ms for 10 minutes;
- error rate > 1% for 5 minutes;
- replication lag > 5s for 3 minutes;
- pool utilization > 85% for 5 minutes;
- checksum mismatch > 0.

Escalation:

1. L1 DBA on-call in 5 minutes.
2. L2 module owner + SRE in 15 minutes.
3. L3 architecture board in 30 minutes.

## 8. Sign-Off Checklist Per Module

- migration script dry-run approved;
- validation matrix complete with evidence;
- rollback rehearsal passed in staging;
- on-call roster confirmed;
- change advisory approval completed.

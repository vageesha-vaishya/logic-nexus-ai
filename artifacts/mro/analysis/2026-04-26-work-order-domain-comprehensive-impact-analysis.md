# AMRO Work Order Domain Comprehensive Impact Analysis

Date: 2026-04-26
Scope: Full replacement of legacy work order naming conventions in schema, code, APIs, and configuration.

## 1. Database Layer Impact

- Replaced legacy table naming with canonical `public.work_orders`.
- Replaced legacy template table naming with canonical `public.work_order_templates`.
- Aligned canonical work order number column to `work_order_number`.
- Added/verified canonical indexes and constraints:
  - `uq_work_orders_tenant_work_order_number`
  - `idx_work_orders_work_order_number`
  - `idx_work_order_templates_tenant_id`
- Rebound key FKs:
  - `work_orders.work_order_template_id -> work_order_templates(id)`
  - `tasks.work_order_template_id -> work_order_templates(id)`

## 2. Application Code Layer Impact

- Performed repository-wide symbol and identifier replacement for:
  - `work_packages` -> `work_orders`
  - `work_package_templates` -> `work_order_templates`
  - `work_package*` -> `work_order*`
- Updated file paths and module names where legacy naming existed.
- Updated runtime persistence/service code paths to query and write canonical `work_order_number`.

## 3. API Layer Impact

- Updated REST route handlers and adapters to canonical `work_order_*` naming.
- Updated response mappers to remain backward-safe where required by emitting compatibility fields derived from canonical values.
- Updated API contract files and request/response key references through naming replacement.

## 4. Configuration and Migration Layer Impact

- Updated migration and SQL utility files to canonical naming conventions.
- Added canonical replacement migration:
  - `20260426180000_amro_work_order_domain_final_replacement.sql`
- Repaired transitional migrations that became invalid after full naming replacement so migration chain remains executable.

## 5. Validation Summary

- Legacy naming pattern scan after refactor:
  - `work_packages`: 0 matches
  - `work_package_templates`: 0 matches
  - `work_package`: 0 matches
  - `work_package_number`: 0 matches
  - `work_package_id`: 0 matches
- TypeScript typecheck: pass.
- Targeted AMRO API tests: core v2 work order suites passed; non-blocking environment/framework test harness issues remain in service-side suites requiring SUPABASE env and Jest runtime context.

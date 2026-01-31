# Service Architecture Research & Analysis

## 1. Executive Summary
This document outlines the comprehensive research, analysis, and remediation plan for the platform's Service Architecture. The goal is to establish a domain-agnostic, normalized, and scalable foundation for all business domains (Logistics, Trading, etc.).

## 2. Current State Analysis

### 2.1 Existing Artifacts
- **Tables**:
  - `transport_modes`: High-level modes (Ocean, Air, Road, Rail).
  - `service_types`: The core classification (e.g., Ocean LCL, Air Express). Recently updated to use `mode_id` FK.
  - `services`: Tenant-specific implementations. Contains legacy columns (`service_type` text, `mode` text) and unstructured `metadata` JSONB.
  - `service_type_mappings`: Maps Tenant Services to Platform Service Types.
  - `service_leg_categories`: Defines non-transport categories (Warehousing, Customs) used in quoting.
  - `quotation_version_option_legs`: References `service_types`.

### 2.2 Identified Issues
1.  **Redundancy**: `service_leg_categories` overlaps with `service_types` (e.g., Warehousing exists in both).
2.  **Data Integrity**: `services` table has mixed usage of `service_type_id` (FK) and legacy text columns.
3.  **Unstructured Data**: Domain-specific attributes (e.g., "Container Size" for Ocean, "Temperature" for Cold Chain) are buried in unvalidated `metadata` JSONB blobs.
4.  **Fragmentation**: "Transport" vs "Service" legs are treated differently in the schema, making unified quoting difficult.
5.  **Missing "Service Details"**: There is no dedicated structure for defining the *capabilities* or *configurations* of a service in a standard way.

## 3. Proposed Normalized Architecture

To achieve domain-agnosticism, we have designed a **Schema-Driven Service Architecture**.

### 3.1 Core Entity Model

1.  **`service_modes`** (formerly `transport_modes`)
    - *Role*: Top-level classification.
    - *Examples*: Ocean, Air, Road, Digital (for non-physical services).
    - *Fields*: `id`, `code` (enum), `name`, `is_active`.

2.  **`service_categories`** (Unifies `service_leg_categories`)
    - *Role*: Functional grouping within or across modes.
    - *Examples*: Transport, Storage, Customs, Insurance.
    - *Fields*: `id`, `code`, `name`.

3.  **`service_types`**
    - *Role*: The specific class of service.
    - *Relationships*: FK to `service_modes` (optional, for transport), FK to `service_categories`.
    - *Examples*: Ocean LCL (Mode: Ocean, Cat: Transport), Bonded Warehousing (Mode: null, Cat: Storage).
    - *Fields*: `id`, `code`, `name`, `mode_id`, `category_id`.

4.  **`service_attribute_definitions`** (Configuration Management)
    - *Role*: Defines the *schema* for a Service Type.
    - *Fields*: `id`, `service_type_id`, `attribute_key` (e.g., 'container_size'), `data_type` (text, number, boolean, select), `validation_rules` (JSONB), `is_required`.

5.  **`services`** (Tenant Offerings)
    - *Role*: The catalog item.
    - *Fields*: `id`, `tenant_id`, `service_type_id`, `name`, `status`.

6.  **`service_details`** (The requested table)
    - *Role*: Stores the specific attribute values for a Service, validated against definitions.
    - *Structure*: 1:1 or 1:N with `services`.
    - *Fields*: `id`, `service_id`, `attributes` (JSONB - validated against `service_attribute_definitions`).
    - *Note*: Using a separate table allows for versioning and cleaner separation from core service info.

7.  **`service_type_mappings`**
    - *Role*: Routing logic.
    - *Fields*: `id`, `tenant_id`, `service_type_id`, `service_id`, `priority`.

## 4. Implementation Plan & Deliverables

### 4.1 Migration Scripts
Located at: `supabase/migrations/20260131000000_service_architecture_overhaul.sql`
- Renames `transport_modes` to `service_modes`.
- Creates `service_categories` and unifies data.
- Adds `category_id` to `service_types`.
- Creates `service_attribute_definitions` and `service_details` tables.
- Implements `validate_service_details` trigger function.

### 4.2 Seed Data Strategies
Located at: `scripts/seed_service_definitions.ts`
- Demonstrates how to programmatically define schema attributes (e.g., Ocean Container Types, Air AWB Types).
- Ensures consistent initial configuration across environments.

### 4.3 Test Validation
Located at: `scripts/test_service_architecture.ts`
- Validates that `service_details` cannot be inserted without required attributes defined in `service_attribute_definitions`.
- Verifies successful CRUD operations for valid data.

## 5. Impact Assessment Report

### 5.1 API & Integrations
- **Impact**: High. Endpoints creating/updating services must now populate `service_details` instead of `services.metadata`.
- **Mitigation**: The migration script copies existing `metadata` to `service_details`, ensuring no data loss. APIs should be updated to read from the new table.

### 5.2 Frontend/UI
- **Impact**: Medium. Service configuration forms need to become dynamic.
- **Opportunity**: The UI can now use `service_attribute_definitions` to auto-generate forms (e.g., if `data_type` is 'select', render a dropdown with `validation_rules.options`).

### 5.3 Downstream Systems (Quoting)
- **Impact**: Low to Medium. `quotation_version_option_legs` already references `service_types`. The addition of `service_categories` simplifies the logic for distinguishing "Transport" vs "Service" legs.

## 6. Next Steps
1.  **Execute Migration**: Run `supabase db push` or apply the migration file.
2.  **Run Seeds**: Execute `npx ts-node scripts/seed_service_definitions.ts`.
3.  **Run Tests**: Execute `npx ts-node scripts/test_service_architecture.ts`.

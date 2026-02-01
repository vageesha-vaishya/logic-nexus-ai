# Service Domain Testing Protocols

This document outlines the testing protocols for the Service Domain Architecture, ensuring data integrity, functionality, and UX consistency.

## 1. Automated Verification Scripts

These scripts are designed to be run after any migration or deployment to verify the database state.

### `scripts/verify_service_architecture.js`
**Purpose:** Validates that the "Canonical" data exists and is correctly structured.
**Checks:**
- Presence of all 6 Service Modes (Ocean, Air, Road, Rail, Digital, Multimodal).
- Presence of all 6 Service Categories.
- Correct linking of Service Types to Categories and Modes.
- Existence of Attribute Definitions for key service types.
- **Run Command:** `node scripts/verify_service_architecture.js`

### `scripts/verify_non_logistics_seeding.js`
**Purpose:** Specific verification for non-logistics domains (Trading, Insurance, Customs).
**Checks:**
- Verifies specific service types (Procurement Agent, Quality Inspection).
- Checks for attribute definitions specific to these domains.
- **Run Command:** `node scripts/verify_non_logistics_seeding.js`

## 2. Lifecycle Integration Tests

These scripts simulate real-world usage patterns to ensure the system functions as expected "End-to-End".

### `scripts/test_domain_service_lifecycle.js`
**Purpose:** Tests the CRUD (Create, Read, Update, Delete) lifecycle of a Service.
**Flow:**
1.  **Setup:** Identifies a valid Tenant and Service Type (e.g., Procurement Agent).
2.  **Create:** Inserts a new Service record.
3.  **Details:** Inserts `service_details` with JSONB attributes matching the definition.
4.  **Update:** Modifies the attributes and verifies persistence.
5.  **Cleanup:** Deletes the test data to maintain a clean environment.
**Run Command:** `node scripts/test_domain_service_lifecycle.js`

## 3. Database Integrity Constraints

We rely on the database engine to enforce critical business rules:
- **Foreign Keys:** `service_types` -> `service_categories`, `service_types` -> `service_modes`.
- **Check Constraints:** `service_attribute_definitions.data_type` must be one of ('text', 'number', 'boolean', 'select', 'date', 'json').
- **Uniqueness:** `(tenant_id, service_code)` must be unique to prevent duplicate service codes within a tenant.

## 4. UI/UX Testing Checklist

When validating the `Services` dashboard page:

- [ ] **Render:** Does the "Services" table load without errors?
- [ ] **Create:** Can you open the "Add Service" dialog?
- [ ] **Dynamic Form:** When you select a Type (e.g., "Ocean Freight"), do the specific fields (Container Type, etc.) appear?
- [ ] **Validation:** Does the form prevent submission if required attributes are missing?
- [ ] **View:** Does the "Eye" icon open a read-only view of the attributes?
- [ ] **Edit:** Can you change an attribute value and save?
- [ ] **Sort/Filter:** Do the filters for Type and Status work correctly?

## 5. Migration Testing

Before deploying new migrations:
1.  **Backup:** Always ensure a backup exists (handled by `scripts/automated_migration.js` in prod).
2.  **Dry Run:** Review the SQL for potential destructive operations.
3.  **Idempotency:** Run the migration script TWICE in dev. It should succeed both times and result in the same state.

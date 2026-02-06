# Hierarchy Gap Analysis & Enforcement Report

## 1. Executive Summary
This report analyzes the current state of the platform's hierarchical structure (Super Admin → Tenant → Franchise → Leaf Entities). While the core CRM and Logistics modules (Accounts, Opportunities, Shipments) have robust hierarchy support, significant gaps existed in the **Invoicing and Payments** modules and **HQ User Visibility**. These gaps have now been **RESOLVED** with strict database-level enforcement.

## 2. Hierarchy Model & Data Ownership

| Hierarchy Level | Actor | Data Ownership Scope | Access Rights |
|----------------|-------|----------------------|---------------|
| **L1: Platform** | Super Admin | Global (All Tenants) | Full Access (Read/Write/Delete) across all data. |
| **L2: Tenant** | Tenant Admin | Single Tenant (All Franchises) | Manage all data within their Tenant ID. Can configure global settings for the tenant. |
| **L3: Franchise** | Franchise Admin | Single Franchise | Manage data explicitly linked to their Franchise ID. Restricted from seeing other franchises' data. |
| **L4: Leaf** | User / Agent | Assigned Records | Access only records assigned to them or within their Franchise (depending on role config). |

## 3. Current Implementation Status

### 3.1. Compliant Modules (Green)
The following modules correctly implement `tenant_id` and `franchise_id` columns with appropriate RLS policies:
- **CRM Core**: `accounts`, `contacts`, `leads`
- **Sales**: `opportunities`, `quotes`, `activities`
- **Logistics**: `shipments`, `warehouses`, `vehicles`
- **Configuration**: `carriers`, `rates`, `services` (Global/Tenant hybrid model)
- **Finance**: `invoices`, `payments`
- **Compliance**: `compliance_screenings`

### 3.2. Resolved Gaps
The following modules had critical hierarchy gaps that have been addressed:

#### **A. Invoicing & Billing** (RESOLVED)
- **Table**: `invoices`
- **Status**: Fixed in `20260211130000_enforce_invoice_hierarchy_strict.sql` and `20260211160000_fix_hierarchy_gaps.sql`.
- **Resolution**: Added `franchise_id` column and implemented strict RLS policies ensuring Franchise users only see their data. Updated RLS to support HQ (Tenant-level) users accessing non-franchise invoices.
- **Table**: `payments`
- **Status**: Fixed in `20260211130000_enforce_invoice_hierarchy_strict.sql`.
- **Resolution**: Added `franchise_id` column and implemented strict RLS policies.

#### **B. Compliance Screening** (RESOLVED)
- **Table**: `compliance_screenings`
- **Status**: Fixed in `20260211140000_enforce_compliance_hierarchy.sql`, `20260211143000_auto_populate_compliance_hierarchy.sql`, and `20260211170000_update_compliance_trigger.sql`.
- **Resolution**: Added `franchise_id` column, backfilled data, implemented strict RLS, and added trigger to auto-populate hierarchy IDs. Default `performed_by` logic ensures seamless integration.

#### **C. CRM & Sales (HQ Visibility Gap)** (RESOLVED)
- **Modules**: `accounts`, `contacts`, `leads`, `opportunities`, `quotes`, `shipments`, `activities`
- **Status**: Fixed in `20260211150000_fix_hq_visibility.sql` and `20260211160000_fix_hierarchy_gaps.sql`.
- **Resolution**: Updated RLS policies to explicitly handle HQ users (NULL franchise_id) accessing HQ data. Pattern used: `(get_user_franchise_id() IS NULL AND franchise_id IS NULL) OR franchise_id = get_user_franchise_id()`.

## 4. Remediation Plan

### 4.1. Completed Actions
- [x] **Alter `invoices` table**: Added `franchise_id` and strict RLS.
- [x] **Alter `payments` table**: Added `franchise_id` and strict RLS.
- [x] **Compliance Module**: Updated schema to include `franchise_id`, enforced RLS, and added auto-population trigger.
- [x] **HQ Visibility Fix**: Updated RLS policies for CRM core modules, invoices, shipments, and activities to support HQ user visibility.
- [x] **Automated Testing**: `scripts/verify_all_hierarchy.cjs` created and verified.

### 4.2. Pending Actions
- [x] **Billing & Accounting**: Verified `subscription_invoices` is for platform billing (SaaS) and correctly scoped to Tenant. No Franchise isolation required for this table.
- [x] **Global Search**: Verified that `src/components/ui/global-search.tsx` uses the authenticated Supabase client, ensuring RLS policies are respected.

### 4.3. Automated Testing Expansion
- `scripts/verify_hierarchy_full.cjs` now covers:
  1.  **Invoices Isolation**: Verifies Franchise B cannot see Franchise A's invoices.
  2.  **Compliance Screenings**: Verifies auto-population and isolation.
  3.  **HQ Visibility**: Verifies HQ users can see HQ accounts (where `franchise_id` is NULL) but not specific franchise accounts.

## 5. Success Criteria
- [x] `invoices` and `payments` tables have `franchise_id`.
- [x] RLS policies strictly enforce Franchise isolation across all modules.
- [x] Automated test suite (`scripts/verify_hierarchy_full.cjs`) passes with zero violations.
- [x] Gap Analysis Report is updated to "Resolved".

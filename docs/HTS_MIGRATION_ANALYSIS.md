# HTS Database Table Analysis & Migration Plan

**Date:** 2026-02-06
**Status:** Final Analysis

## 1. Executive Summary
A comprehensive audit of the database and codebase identified two competing HTS code tables: `aes_hts_codes` and `master_hts`.
- **Active Table:** `aes_hts_codes` (Integrated into UI, Enterprise Architecture, and recent migrations).
- **Obsolete Table:** `master_hts` (Standalone, used only by unintegrated Python ETL scripts).

**Recommendation:** Remove `master_hts` and its associated infrastructure to reduce technical debt and confusion.

## 2. Usage Analysis

### 2.1 `aes_hts_codes` (Keep)
- **Role:** Primary source of truth for HTS/Schedule B codes.
- **Dependencies (Database):**
  - Referenced by `master_commodities.aes_hts_id` (Foreign Key).
  - Referenced by `duty_rates.aes_hts_id` (Foreign Key).
  - Used in `calculate_duty` RPC.
  - Used in `search_hts_codes` RPC.
- **Dependencies (Code):**
  - `src/components/aes-hts-code-manager.tsx` (Main Management UI).
  - `src/components/logistics/SmartCargoInput.tsx` (Search Component).
  - `src/components/logistics/CargoDetailsForm.tsx` (Validation & Selection).
- **Status:** **CRITICAL / ACTIVE**.

### 2.2 `master_hts` (Remove)
- **Role:** Legacy or Proof-of-Concept "Discovery Framework".
- **Dependencies (Database):**
  - Linked to `master_hts_history` (Audit trail).
  - Linked to `discrepancy_logs` (Validation logs).
  - Linked to `hts_verification_reports`.
  - **No Foreign Keys** from core application tables (Tenants, Cargo, etc.).
- **Dependencies (Code):**
  - `scripts/hts_etl_pipeline.py` (Unused Python script).
  - `scripts/generate_hts_report.py` (Unused Python script).
  - **Zero references** in `src/` (React Application).
- **Status:** **OBSOLETE**.

## 3. Impact Assessment
- **Downstream Systems:** No impact. The core application does not read/write to `master_hts`.
- **Data Loss:** The data in `master_hts` is redundant or stale compared to `aes_hts_codes`.
- **Integrations:** The "Federal Register" fetcher in the Python scripts is not currently scheduled or active in the production runtime.

## 4. Removal Plan

### 4.1 Database Cleanup
Execute a migration to drop the following tables:
1. `master_hts_history`
2. `discrepancy_logs`
3. `hts_verification_reports`
4. `master_hts`
5. `app_feature_flags` (Cleanup HTS-specific flags only)

### 4.2 Codebase Cleanup
Delete the following files:
1. `scripts/hts_etl_pipeline.py`
2. `scripts/generate_hts_report.py`
3. `scripts/apply_master_hts_migration.py`
4. `supabase/migrations/20260130180000_master_hts_framework.sql` (Archival only, do not delete if maintaining strict history, but create a reversal migration).

### 4.3 Documentation Update
Update `docs/HTS_TECHNICAL_SPEC.md` to deprecate the "Discovery Framework" section and point to the new Enterprise Architecture (`aes_hts_codes`).

## 5. Rollback Strategy
Since `master_hts` is not used, a backup is only needed for archival purposes.
1. **Backup:** `pg_dump -t master_hts > backups/master_hts_legacy.sql`
2. **Restore:** If needed, verify against `backups/master_hts_legacy.sql`.

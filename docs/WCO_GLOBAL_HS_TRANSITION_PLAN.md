# WCO Global HS Transition Plan (Phase 3)

**Date:** 2026-02-08
**Status:** Planning
**Objective:** Transition from US-centric AES/HTS architecture to a WCO-based Global HS root model to support multi-country compliance.

## 1. Executive Summary
The current architecture relies on `aes_hts_codes` (US Census Bureau data) as the single source of truth. This prevents the system from handling non-US regulatory domains (e.g., TARIC for EU, HS for China). The goal is to implement a "Hub-and-Spoke" model where:
- **Hub:** `global_hs_roots` (WCO 6-digit Standard) - Universal across all WCO member countries.
- **Spokes:** National extensions (e.g., `aes_hts_codes` for US, `taric_codes` for EU) linked to the Hub.

## 2. Current Architecture Analysis
- **Table:** `aes_hts_codes`
- **Structure:** Flat table with `hts_code` (10-digit), `chapter` (2), `heading` (4), `subheading` (6).
- **Limitation:** Tightly coupled to US definitions. Duplicate 6-digit roots exist implicitly but are not modeled as shared entities.

## 3. Target Architecture (WCO Global HS Model)

### 3.1 New Entities
1.  **`global_hs_roots`**
    - `id` (UUID, PK)
    - `hs6_code` (Text, Unique, 6-digit)
    - `description` (Text, WCO standard description)
    - `chapter` (Text, 2-digit, Computed/Stored)
    - `heading` (Text, 4-digit, Computed/Stored)

### 3.2 Relationships
- `aes_hts_codes` (and future `taric_codes`) will have a Foreign Key `global_hs_root_id` referencing `global_hs_roots(id)`.
- This enables querying: "Show me the US and EU duty rates for HS Code 8517.13".

## 4. Migration Strategy

### Step 1: Infrastructure Setup (Migration Script)
- Create `global_hs_roots` table with indexes.
- Create RLS policies for `global_hs_roots` (viewable by authenticated, manageable by admins).

### Step 2: Data Extraction & Seeding
- **Source:** Existing `aes_hts_codes`.
- **Logic:**
    1.  Select distinct `subheading` (6-digit) from `aes_hts_codes`.
    2.  Insert into `global_hs_roots`.
    3.  Use the most generic description available (or `MAX(description)` initially, to be refined later).

### Step 3: Association (Linking)
- Add `global_hs_root_id` column to `aes_hts_codes`.
- Run Update statement to link `aes_hts_codes` to `global_hs_roots` based on `subheading = hs6_code`.
- Add Not Null constraint after verification.

### Step 4: Verification
- Verify that every `aes_hts_codes` record has a parent `global_hs_root_id`.
- Verify count of `global_hs_roots` matches expected unique 6-digit codes.

## 5. Implementation Roadmap

### Milestone 1: Database Migration (Immediate)
- [ ] Create `global_hs_roots` table.
- [ ] Seed data from `aes_hts_codes`.
- [ ] Link `aes_hts_codes` to parent.

### Milestone 2: Application Layer Updates (Next)
- [ ] Update `SmartCargoInput` to search against `global_hs_roots` for initial broad classification.
- [ ] Update `CommodityDetail` to allow selecting a Global HS Root if a specific US HTS is not yet known.

### Milestone 3: Future Country Expansion (Post-Phase 3)
- [ ] Add `taric_codes` (EU) table linked to `global_hs_roots`.
- [ ] Add `cn_hs_codes` (China) table linked to `global_hs_roots`.

## 6. Rollback Procedure
- If migration fails, drop `global_hs_root_id` column from `aes_hts_codes`.
- Drop `global_hs_roots` table.
- Restore `aes_hts_codes` if data corruption occurred (unlikely as we are adding columns).

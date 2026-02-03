# WCO Global HS Architecture

**Date:** 2026-02-08
**Status:** Implemented (Phase 3 Initialization)

## Overview
The WCO Global HS Architecture represents a shift from a US-centric data model (AES HTS) to a global, multi-jurisdictional compliance model. This is achieved by introducing a "Hub-and-Spoke" architecture where the 6-digit WCO Harmonized System (HS) code serves as the universal root, and national tariffs (US HTS, EU TARIC, CN HS) are attached as extensions.

## Core Data Model

### 1. Global HS Roots (`global_hs_roots`)
The "Hub" of the system. Represents the universal 6-digit classification shared by all WCO member countries.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `hs6_code` | TEXT | Unique 6-digit code (e.g., "851762") |
| `description` | TEXT | Standard WCO description |
| `chapter` | TEXT | First 2 digits (Generated) |
| `heading` | TEXT | First 4 digits (Generated) |

### 2. National Extensions (Spokes)
#### US AES HTS (`aes_hts_codes`)
Existing table, refactored to be a child of `global_hs_roots`.

| Column | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary Key |
| `hts_code` | TEXT | Full 10-digit US code |
| `global_hs_root_id` | UUID | FK to `global_hs_roots` |
| ... | ... | Other US-specific fields (Unit, Duty, etc.) |

## Benefits
1.  **Global Compatibility:** Allows adding EU/China tariffs without schema duplication.
2.  **Unified Classification:** Users can classify a product once (to 6 digits) and see duties for multiple destination countries.
3.  **Data Integrity:** Enforces the WCO hierarchy structure.

## Migration Status (Feb 2026)
- **Database:** `global_hs_roots` table created and seeded.
- **Linkage:** All `aes_hts_codes` linked to their respective `global_hs_roots`.
- **API:** `get_hts_hierarchy` RPC still serves the UI, but backend is ready for "Global Mode".

## Next Steps
1.  **UI Update:** Update `VisualHTSBrowser` to fetch Chapters/Headings from `global_hs_roots` instead of aggregating `aes_hts_codes`.
2.  **Search:** Update `SmartCargoInput` to search `global_hs_roots` for faster, broader results.
3.  **Expansion:** Import EU TARIC data into a new `taric_codes` table linked to `global_hs_roots`.

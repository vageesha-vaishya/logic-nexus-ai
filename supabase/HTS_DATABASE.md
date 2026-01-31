# AES HTS/Schedule B Database System

This document outlines the comprehensive database system designed for AES filing compliance, specifically focusing on Harmonized Tariff Schedule (HTS) codes and Schedule B classifications.

## 1. Database Schema

### `public.aes_hts_codes`
The primary table for storing current HTS and Schedule B data.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary Key (auto-generated) |
| `hts_code` | VARCHAR(15) | Unique HTS code (e.g., "0101.21.00"). Format validated via regex. |
| `schedule_b` | VARCHAR(15) | Corresponding Schedule B number (optional). |
| `category` | VARCHAR(100) | Classification category (e.g., Chapter description). |
| `description` | TEXT | Detailed commodity description. |
| `unit_of_measure`| VARCHAR(50) | Primary Unit of Measure (UOM). |
| `duty_rate` | VARCHAR(50) | Applicable duty rate. |
| `special_provisions` | TEXT | Special tariff provisions. |
| `uom1`, `uom2` | VARCHAR | Additional UOMs for specific filing requirements. |
| `created_at`, `updated_at` | TIMESTAMPTZ | Metadata. |

**Constraints:**
- `hts_code` must match regex `^[0-9]{4}(\.[0-9]{2}){0,3}$`.
- `hts_code` must be unique.

**Indexes:**
- B-Tree on `hts_code`, `category`.
- GIN (Full Text Search) on `description`.

### `public.aes_hts_codes_history`
A comprehensive version control system that tracks every change to the HTS codes.

| Column | Type | Description |
|--------|------|-------------|
| `history_id` | UUID | PK for history entry. |
| `original_id` | UUID | FK reference to original record (even if deleted). |
| `operation_type` | TEXT | 'INSERT', 'UPDATE', 'DELETE'. |
| `changed_at` | TIMESTAMPTZ | When the change occurred. |
| ... | ... | Snapshot of all columns at time of change. |

### `public.audit_logs` (Integration)
All changes are also logged to the centralized `audit_logs` table with `resource_type='aes_hts_codes'` and JSON details of the change (old vs new values).

## 2. Stored Procedures & API

### Validation
`public.validate_hts_code(code text) -> boolean`
Checks if a given string matches the required HTS format.

### Search
`public.search_hts_codes(search_term text) -> SETOF aes_hts_codes`
Performs a full-text search on descriptions and partial matching on HTS codes. Results are ranked by relevance.

### Details & History
`public.get_hts_code_details(code text) -> TABLE(current_record jsonb, history jsonb)`
Retrieves the current record and its full history (version control) in a single call.

## 3. Data Import Utility

A Python utility is provided at `scripts/import_hts_data.py`.

**Supported Formats:** CSV, JSON, Excel (.xlsx).

**Usage:**
```bash
python3 scripts/import_hts_data.py path/to/data.csv
```

**Options:**
- `--dry-run`: Validates the input file and prints stats without modifying the database.

**CSV Format Requirements:**
The script attempts to map common column names (e.g., "HTS Number" -> "hts_code").
Minimum required columns: `hts_code`, `description`, `category` (category can be derived from chapter).

## 4. Compliance & Updates

- **Audit Trails**: Implemented via database triggers (`trg_aes_hts_changes`). Cannot be bypassed by application code.
- **Data Integrity**: Enforced via Check constraints and Foreign Keys.
- **Updates**: Use the import utility to bulk update. The system handles "Upserts" (Update if exists, Insert if new) and automatically logs previous versions to history.

## 5. Maintenance

To verify database integrity or stats:
```sql
SELECT count(*) FROM aes_hts_codes;
SELECT count(*) FROM aes_hts_codes_history;
```

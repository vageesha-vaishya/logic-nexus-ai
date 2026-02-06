
# Container Data Normalization & Defensive Architecture

## Overview
This document details the resolution of duplicate container type issues and the implementation of a four-tier defensive architecture to prevent recurrence.

## Problem
Duplicate container types (e.g., "Dry Standard" vs "Standard Dry") caused data inconsistency across Quick Quote and Detailed Quote modules.

## Solution Architecture

### 1. Database Layer (Tier 1)
- **Normalization**: `quote_cargo_configurations` now links to `container_types` (UUID) instead of storing text.
- **Constraints**: 
  - `container_types`: Unique constraint on `name` (case-insensitive trigger).
  - `container_sizes`: Unique constraint on `(type_id, name)` and `iso_code`.
- **Triggers**: 
  - `trigger_normalize_container_types`: Trims and uppercases codes.
  - `trigger_normalize_container_sizes`: Trims and uppercases ISO codes.
- **Cascading Deletes**: `ON DELETE CASCADE` enabled for `container_sizes`.

### 2. Backend Layer (Tier 2)
- **Validation**: Database constraints enforce uniqueness.
- **Cleanup**: Migration `20260216143000_cleanup_container_duplicates.sql` merged duplicates and reassigned references.

### 3. Frontend Layer (Tier 3)
- **Quick Quote**: `QuickQuoteModal.tsx` stores UUIDs for container type/size.
- **Detailed Quote**: `QuoteCargoConfigurations.tsx` binds to `container_type_id`.
- **Legacy Support**: Text fields are still populated for backward compatibility but derived from master data.

### 4. Verification & Testing
- **Automated Test**: `scripts/tests/verify_container_constraints.js` verifies:
  - Absence of duplicates.
  - Enforcement of unique constraints (attempts to insert duplicate).
  - Existence of foreign key columns.

## Migrations
- `20260216140000_normalize_quote_cargo.sql`: Adds FK columns.
- `20260216143000_cleanup_container_duplicates.sql`: Merges/Deletes duplicates.
- `20260216150000_container_constraints.sql`: Adds constraints.
- `20260216153000_fix_normalization_trigger.sql`: Fixes trigger logic.

## Usage
When adding new container types, ensure you use the `container_types` API. Direct text insertion into `quote_cargo_configurations` is deprecated.

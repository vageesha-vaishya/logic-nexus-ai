# Location Handling Fix & Architecture

## Overview
This document details the resolution of issues related to unpopulated Origin/Destination fields in the `UnifiedQuoteComposer` and the associated persistence and loading mechanisms.

## Issue Description
Users reported that "Origin City/Port" and "Destination City/Port" fields were not populating when loading existing quotes, and sometimes showing "No results" during search.

### Root Causes
1.  **Column Name Conflict**: The `quotes` table contains JSONB columns named `origin_location` and `destination_location`. The `UnifiedQuoteComposer` query was aliasing the joined `ports_locations` data with the same names (`origin_location:origin_port_id(...)`), causing Supabase/PostgREST to return the (often empty) JSONB column instead of the joined location data.
2.  **Missing Seed Data**: The search for "Delhi" returned no results because the seed data for Delhi was missing or incomplete in the `ports_locations` table.
3.  **RLS Permissions**: The `search_locations` RPC was defined as `SECURITY DEFINER` (or had incorrect permissions), potentially bypassing RLS or failing for certain users.

## Resolution

### 1. UnifiedQuoteComposer Query Update
The query in `UnifiedQuoteComposer.tsx` has been updated to use distinct aliases for the joined location data to avoid conflicts with existing columns.

**Old Query:**
```typescript
.select('*, origin_location:origin_port_id(location_name, location_code), destination_location:destination_port_id(location_name, location_code)')
```

**New Query:**
```typescript
.select('*, origin_port_data:origin_port_id(location_name, location_code), destination_port_data:destination_port_id(location_name, location_code)')
```

The component logic was updated to map `origin_port_data` and `destination_port_data` to the form fields.

### 2. Search Locations RPC Security
The `search_locations` RPC has been updated to use `SECURITY INVOKER` to ensure it respects Row Level Security (RLS) policies of the invoking user.
- Migration: `20260302120000_fix_search_locations_security.sql`

### 3. Seed Data
Added seed data for "Delhi" to ensure search results are returned.
- Migration: `20260302130000_seed_delhi_locations.sql`

## Verification

### Automated Verification
- **Loading Logic**: `scripts/verify_quote_loading.cjs` verifies that the new query syntax correctly retrieves location names.
- **Unit Tests**: `src/components/sales/unified-composer/__tests__/UnifiedQuoteComposer.load.test.tsx` has been updated to mock the new data structure and passes successfully.

### RLS Compliance
- Confirmed that `ports_locations` table has an RLS policy allowing read access for all authenticated users (`true` for SELECT), ensuring the join works correctly for regular users.

## Data Persistence
- Quotes are saved using `origin_port_id` and `destination_port_id` (UUIDs).
- The `origin_location` and `destination_location` JSONB columns in the `quotes` table are currently not being populated by the `UnifiedQuoteComposer` save logic (it relies on the relational IDs). The loading logic now correctly prefers the relational IDs (`origin_port_id` -> `ports_locations`) over the JSONB columns.

## Next Steps
- Monitor for any edge cases where `origin_port_id` might be missing but JSONB data exists (legacy data). The current implementation prioritizes the relational ID but falls back to the `origin` text field if needed.

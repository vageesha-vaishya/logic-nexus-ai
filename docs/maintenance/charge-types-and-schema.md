# Charge Type Management & Schema Maintenance Guide

## Overview
This document outlines the standard operating procedures for managing shipping charge types, updating schemas, and maintaining data integrity in the SOS Logistics Pro system.

## Adding New Charge Types

### 1. Identification
*   **Monitor**: Regularly check for new charge keys in carrier APIs or AI responses (e.g., "Peak Season Surcharge", "Low Sulphur Surcharge").
*   **Classification**: Determine if the charge appears in the `charges` array (standard carrier API) or the `price_breakdown` object (AI/legacy structure).

### 2. Implementation
*   **Charges Array**: If the charge comes in the `charges` array, no code change is usually needed as the system iterates through this array dynamically.
*   **Price Breakdown**: If the charge comes via `price_breakdown`, ensure it is handled in the recursive parsing logic in `QuoteNew.tsx`.
*   **Mapping**: Ensure the new charge key maps to a valid `charge_category` in the database. If a new category is needed, add it to the `charge_categories` table via migration.

### 3. Validation
*   **UI**: Verify the charge appears in the Quote Composer UI under the correct leg.
*   **Calculation**: Ensure the charge is included in the total buy/sell rates and margin calculations.

## Schema Changes

### 1. RateOption Structure
*   **Code Reference**: `src/lib/schemas/quote-transfer.ts`
*   **Rule**: Any change to the `RateOption` interface must be immediately reflected in the Zod schema.
*   **Prevention**: The schema uses `.passthrough()` to allow unknown fields, but critical fields must be explicitly defined to ensure type safety.

### 2. Data Integrity
*   **Type Guards**: Use Zod's `safeParse` to validate data before processing.
*   **Error Handling**: Log validation errors but allow non-critical failures to proceed (with warnings) to prevent blocking the user workflow.

## Testing Requirements

### 1. Unit Tests
*   **Location**: `src/lib/schemas/quote-transfer.test.ts`
*   **Scope**: Validate that standard payloads, payloads with explicit `charges` arrays, and payloads with nested `price_breakdown` objects are all accepted.

### 2. Integration Tests
*   **Manual**: Verify the end-to-end flow from Quick Quote -> New Quote -> Database Insert -> Composer Load.

## Troubleshooting
*   **Missing Charges**: Check if the charge key in the source data matches the `charge_categories` mapping logic in `QuoteNew.tsx`.
*   **Schema Validation Errors**: Check the browser console or server logs for "Quote Transfer Validation Failed" messages.

# Root Cause Analysis: Zero Financial Data Display in Quotation Modules

## Executive Summary
Users reported an issue where financial data (charges, totals, margins) appeared as $0.00 in the Quotation Composer and Edit Quote modules, despite data being entered. This investigation confirmed the issue was caused by a combination of missing financial aggregations in the database, overly strict Row Level Security (RLS) policies, and frontend hydration gaps. A comprehensive fix has been implemented, including data repair, logic updates, and enhanced validation.

## Problem Description
- **Symptoms:**
  - Quote Total appearing as $0.00 in the "Edit Quote" form.
  - "Quotation Composer" showing calculated charges but failing to persist totals to the quote summary.
  - E2E checks flagging quotes with missing versions or zero totals.
- **Scope:** Affected all quotation modules (Quote Details, Transport Legs, Charges).
- **Impact:** Users could not see accurate pricing, leading to potential revenue loss or quoting errors.

## Root Cause Analysis

### 1. Database & Schema Issues
- **Missing Totals in `quotation_version_options`:**
  - The `total_amount`, `buy_subtotal`, and `sell_subtotal` columns in the `quotation_version_options` table were defaulting to 0 or null.
  - The application logic relied on these aggregated fields for display, rather than summing the individual `quote_charges` dynamically in all views.
- **Overly Strict RLS on `quote_charges`:**
  - The `quote_charges` table had RLS policies that restricted access strictly by `tenant_id`.
  - In some flows (e.g., admin viewing a quote), the tenant context was not correctly inferred, causing charges to return as empty arrays, leading to 0 totals.
- **Missing Parent Records:**
  - Several quotes (e.g., `MGL-SYS-1770819021371`) were missing `quotation_versions` records entirely, causing the hydration logic to fail silently.

### 2. Frontend Logic Gaps
- **Missing Calculation in Save Logic:**
  - The `MultiModalQuoteComposer` component was saving charges to the `quote_charges` table but **was not** updating the parent `quotation_version_options` table with the new totals.
  - This resulted in a "disconnect" where detailed charges existed, but the summary total remained 0.
- **Incomplete Hydration Fallback:**
  - The `useQuoteRepository` hook (responsible for loading quote data) did not initially have a fallback to calculate totals from charges on-the-fly if the stored total was 0.

## Resolution Implemented

### 1. Backend & Data Fixes
- **Data Repair:**
  - Executed `scripts/repair_v2.ts` to calculate and backfill `total_amount` for 717 affected quotation options by summing their associated sell-side charges.
- **RLS Policy Alignment:**
  - Applied migration `20251110194500_fix_leg_rls_alignment.sql` to align `quote_charges` policies with parent entities, ensuring proper access for authorized users.
- **Atomic Save Logic:**
  - Implemented `save_quote_atomic` RPC (via migration `20260218130000_save_quote_atomic.sql`) to ensure quotes are saved transactionally.

### 2. Frontend Enhancements
- **Enhanced Save Logic (`MultiModalQuoteComposer.tsx`):**
  - Updated the `saveCharge` function to explicitly calculate `buy_subtotal`, `sell_subtotal`, and `total_amount` and update the `quotation_version_options` table immediately after saving charges.
- **Robust Hydration (`useQuoteRepository.ts`):**
  - Added logic to dynamically calculate `effectiveTotal` from `quote_charges` if the stored `total_amount` is 0.
  - Added comprehensive logging to track data flow and identify discrepancies.
- **UI Feedback (`QuoteFinancials.tsx`):**
  - Added a warning indicator when a quote has items but a $0.00 total, prompting the user to check pricing.

### 3. Verification & Testing
- **E2E Validation Script (`scripts/e2e_quote_financials_check.ts`):**
  - Created a script to audit the latest 50 quotes.
  - Verified that valid quotes now show correct totals.
  - Identified edge cases (e.g., quotes with only "Buy" charges) which are now handled via the frontend fallback.

## Recommendations
- **Automated Integrity Checks:** Run the E2E check script periodically to monitor data health.
- **Strict Mode:** Enforce "Sell" price requirement in the UI to prevent zero-dollar quotes if business logic requires it.
- **Monitor Logs:** Watch the `[QuoteHydration]` logs in the browser console for any future occurrences of zero-total warnings.

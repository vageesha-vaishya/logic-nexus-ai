# MGL Rate Matrix Implementation Log - QUO-260303-00002

**Date:** 2026-03-07
**Task:** Implement Rate and Charges Matrix based on screenshot.
**Tenant:** Miami Global Lines (MGL)
**Quote Number:** QUO-260303-00002

## 1. Analysis & Field Extraction

The following data was extracted from the provided screenshot and mapped to the `rate_options` schema.

### Carrier Group 1: Zim
*   **Carrier Name:** `Zim`
*   **Transit Time:** `1` (Day/Unit not specified, assumed Days)
*   **Frequency:** `1` (Per Week)
*   **Columns (Equipment):**
    1.  `Standard - 20'`
    2.  `Open Top - 40'`
    3.  `Flat Rack - 40'`
    4.  `Flat Rack collapsible - 20'`
    5.  `Platform - 20'`
    6.  `High Cube - 45`
*   **Charges:**
    *   `Ocean Freight`: 2000.00 USD (All columns)
    *   `Trucking`: 1500.00 USD (All columns)
*   **Totals:**
    *   Calculated: 3500.00 USD (All columns)
    *   Screenshot Total: 3500.00
*   **Remarks:** "All Inclusive rates from SD/Port basis" (Appears in Total row)

### Carrier Group 2: EVERGREEN LINES
*   **Carrier Name:** `EVERGREEN LINES`
*   **Transit Time:** `NULL` (Blank in screenshot)
*   **Frequency:** `NULL` (Blank in screenshot)
*   **Columns (Equipment):** Same as Zim group.
*   **Charges:**
    *   `EPS`:
        *   300.00 USD for columns 1-4
        *   0.00 USD for columns 5-6 (Platform - 20', High Cube - 45)
    *   `Ocean Freight`: 2000.00 USD (All columns)
    *   `Trucking`: 1500.00 USD (All columns)
*   **Totals:**
    *   Calculated Columns 1-4: 300 + 2000 + 1500 = 3800.00 USD
    *   Calculated Columns 5-6: 0 + 2000 + 1500 = 3500.00 USD
    *   Screenshot Totals: 3800.00 / 3500.00
*   **Remarks:** "All Inclusive rates from SD/Port basis"

## 2. Implementation Details

### Database Schema Target
Data is mapped to the MGL-specific multi-rate tables defined in `20260307153000_mgl_main_template_multi_rate_foundation.sql`:
*   `rate_options`: Stores carrier, transit, frequency, and equipment columns definition.
*   `rate_charge_rows`: Stores charge descriptions (Ocean Freight, Trucking, EPS) and sorting.
*   `rate_charge_cells`: Stores the specific amount for each charge row and equipment column.

### Migration Script
A SQL seed script `supabase/migrations/20260307200000_seed_mgl_quote_data.sql` was created to:
1.  Locate `QUO-260303-00002` and its latest version.
2.  Clear existing MGL options for that version to prevent duplicates.
3.  Insert the Zim option with 2 charge rows and 12 cells.
4.  Insert the Evergreen option with 3 charge rows and 18 cells.

### Verification
*   **Test Suite:** `supabase/functions/generate-quote-pdf/tests/mgl_matrix_design.test.ts`
*   **Status:** PASSED
*   **Validation:**
    *   Constructed mock context matching the extracted data exactly.
    *   Verified the PDF renderer processes 12 total sub-options (6 columns * 2 carriers).
    *   Verified grouping logic correctly groups by Carrier/Transit/Frequency.
    *   Verified "High Cube - 45" and "Flat Rack collapsible - 20'" column headers are preserved.
    *   Confirmed variable EPS charge logic (300 vs 0) is supported by the data structure.

## 3. Discrepancies & Resolutions
*   **Transit/Frequency:** Zim had "1", Evergreen was blank. Implemented as `1` and `NULL` respectively.
*   **Column Headers:** "High Cube - 45" lacks the foot mark `'` present in others. Implemented exactly as shown in screenshot.
*   **Routing/Legs:** Screenshot does not show routing details. The renderer has been configured to hide the Routing section for this template to match the visual requirement.

## 4. Deployment
Execute the SQL script `supabase/migrations/20260307200000_seed_mgl_quote_data.sql` against the target database to apply these changes to the specific quotation.

# PDF Generation Fix for MGL Templates

## Issue Description
MGL (Miami Global Lines) templates ("MGL Standard Granular", "MGL FCL Quote", "MGL Granular Quote") were generating blank PDFs or failing with `Cannot read properties of undefined (reading 'default_locale')` for specific quotations (e.g., `QUO-260303-00002`).

## Root Cause
1.  **Missing Template Config**: MGL templates in the database lacked the `config` object, causing `template.config.default_locale` access to fail.
2.  **Strict Property Access**: The `matrix-helper.ts` logic assumed strict property names (e.g., `c.description`, `carrier`) which were missing or named differently in the quote data structure, leading to empty data groups and blank sections.
3.  **Missing Rate Options**: When rate options were missing or filtered out, the renderer produced empty sections without fallback text.

## Fix Implementation
1.  **Safe Config Access**: Updated `i18n.ts` and `renderer.ts` to use safe access `(template.config || {}).default_locale` with fallbacks.
2.  **Robust Data Mapping**: Enhanced `matrix-helper.ts` to support multiple field aliases and fallbacks:
    - Carrier: `opt.carrier` -> `opt.carriers.carrier_name` -> `opt.legs[0].carrier_name` -> "Multi-Carrier"
    - Charge Description: `c.description` -> `c.charge_name` -> `c.name` -> `c.desc` -> "Charge"
    - Charge Amount: `c.amount` -> `c.total` -> 0
3.  **Non-Blank Placeholders**: Added "No rate options available" text in `renderer.ts` to prevent blank sections.
4.  **Regression Testing**: Added `reproduce_mgl_blank.test.ts` to cover all 3 MGL templates with realistic mock data.

## Verification Steps
To verify the fix in the remote environment:

1.  **Run Validation Script**:
    ```bash
    # Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your environment
    node supabase/functions/generate-quote-pdf/scripts/validate_remote_pdf.mjs
    ```
    This script will:
    - Fetch quote `QUO-260303-00002`.
    - Iterate through all MGL templates.
    - Invoke the remote `generate-quote-pdf` function.
    - Save the generated PDFs locally.
    - Check file size (>1KB indicates success).

2.  **Run Integration Tests**:
    ```bash
    npm exec vitest run supabase/functions/generate-quote-pdf/tests/reproduce_mgl_blank.test.ts
    ```

## Prevention
- **Schema Validation**: Ensure all templates have a valid `config` object.
- **Data Normalization**: Use shared helpers for data access rather than direct property access.
- **Defensive Coding**: Always use optional chaining (`?.`) or safe access patterns for deep object properties.

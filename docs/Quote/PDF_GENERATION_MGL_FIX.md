# PDF Generation Fix for Miami Global Lines (MGL) Templates

## Issue Summary
**Reported Error:** `Cannot read properties of undefined (reading 'default_locale')`
**Symptom:** PDF generation failed completely or produced blank PDFs for quotation `QUO-260303-00002` when using MGL templates (`MGL Standard Granular`, `MGL FCL Quote`, `MGL Granular Quote`).

## Root Cause Analysis
1. **Missing Config Object:** The legacy MGL templates stored in the database lacked a `config` object, causing the renderer to crash when accessing `template.config.default_locale`.
2. **Unsupported Section Types:** The MGL templates used custom section types (e.g., `customer_matrix_header`, `shipment_matrix_details`, `rates_matrix`, `terms_mgl`) that were not recognized by the `PdfRenderer`, resulting in empty content being rendered.

## Implementation Details

### 1. Resilience & Fallbacks
- **Safe Access:** Updated `i18n.ts` and `renderer.ts` to safely access configuration properties: `(template.config || {}).default_locale`.
- **Default Locale:** Implemented a hard fallback to `"en-US"` if the locale is missing or undefined.

### 2. Section Normalization
- **New Method:** Added `normalizeSection` method to `PdfRenderer` class in `renderer.ts`.
- **Mapping Logic:** This method automatically maps legacy/custom MGL section types to supported renderer types:
  - `customer_matrix_header` / `customer_info` → `key_value_grid` (populated with customer details)
  - `shipment_matrix_details` → `key_value_grid` (populated with shipment details)
  - `rates_matrix` → `dynamic_table` (renders the rate table)
  - `terms_mgl` → `html_content` (renders terms and conditions)

### 3. Database Migration
- **File:** `supabase/migrations/20260307174000_fix_mgl_template_default_locale.sql`
- **Action:** Updates existing MGL templates in the `quote_templates` table to ensure they have a valid `config` object with `default_locale` set to `"en-US"` and default margins.

## Verification & Testing

### Automated Tests
A new integration test suite was created to verify the fix against the live remote database:
- **File:** `supabase/functions/generate-quote-pdf/tests/integration_mgl_live.test.ts`
- **Scope:** Fetches actual templates from the DB and attempts to render them with mock quotation data.
- **Success Criteria:** 
  - No runtime errors.
  - Generated PDF size > 1000 bytes (indicating content was rendered).

### Running the Tests
To verify the fix, run the backend test suite:
```bash
npm exec -- vitest run -c vitest.backend.config.ts supabase/functions/generate-quote-pdf/tests/integration_mgl_live.test.ts
```

## Deployment
After verifying the fix locally, you **must deploy** the Edge Function to the remote Supabase project for the changes to take effect:
```bash
npm run supabase:functions:deploy -- generate-quote-pdf
```
Ensure you have the correct `SUPABASE_ACCESS_TOKEN` in your `.env` file.

## Regression Prevention
- **Always use safe access** for template configuration properties.
- **Do not remove** the `normalizeSection` method unless all legacy templates in the database have been migrated to use standard section types.
- **Integration tests** should be run before deploying changes to the PDF generation engine.

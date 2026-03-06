# Quotation Module Branding Architecture

## Overview
The multi-tenant branding system allows each tenant/franchise to customize the appearance of generated Quotation PDFs. This includes configuring company details, logos, colors, and standard text blocks (header, footer, terms).

## Architecture

### 1. Database Schema
- **Table**: `quotation_configuration`
  - `tenant_id` (UUID, Foreign Key)
  - `branding_settings` (JSONB): Stores all branding configuration.
  - `organization-assets` (Storage Bucket): Stores uploaded logos.

### 2. Frontend Configuration
- **Component**: `BrandingSettingsForm.tsx`
  - Handles logo upload to Supabase Storage (`organization-assets/{tenantId}/logo-*`).
  - Manages color picking and text inputs.
  - Updates `quotation_configuration` via `QuotationConfigurationService`.
- **Integration**: `QuotationSettingsPanel.tsx` adds a "Branding" tab.

### 3. PDF Generation (Edge Function)
- **Function**: `generate-quote-pdf`
- **Logic**:
  1.  Fetches `quotation_configuration` for the quote's tenant.
  2.  Falls back to legacy `tenant_branding` table if configuration is missing.
  3.  Fetches the logo image from the URL (if provided) and converts it to Base64.
  4.  Injects branding data into `SafeContext`.
  5.  `PdfRenderer` applies branding:
      -   **Header**: Logo (or text), Company Name, Address, Header Text.
      -   **Colors**: Primary color used for accents and text.
      -   **Footer**: Custom footer text.
      -   **Terms**: Custom disclaimer/terms text with auto-wrapping.

## API Specifications

### `QuotationConfigurationService`

#### `getConfiguration(tenantId: string)`
Returns the configuration for a tenant. Creates a default record if none exists.

#### `updateConfiguration(tenantId: string, updates: Partial<QuotationConfiguration>)`
Updates the configuration.

### Branding Settings Object (JSONB)
```typescript
interface BrandingSettings {
  logo_url?: string;       // Public URL of the uploaded logo
  company_name?: string;
  company_address?: string;
  primary_color?: string;  // Hex code (e.g. #0087b5)
  secondary_color?: string;
  accent_color?: string;
  font_family?: string;
  header_text?: string;
  sub_header_text?: string;
  footer_text?: string;
  disclaimer_text?: string;
}
```

## Deployment Procedures

1.  **Database Migration**: Run `supabase/migrations/20260306000001_add_branding_configuration.sql` to create the table and storage bucket.
2.  **Edge Function**: Deploy the updated `generate-quote-pdf` function.
    ```bash
    supabase functions deploy generate-quote-pdf
    ```
3.  **Frontend**: Deploy the application with the new settings components.

## Backward Compatibility
The system checks `quotation_configuration` first. If no branding is found, it queries the legacy `tenant_branding` table. This ensures existing tenants (like "Miami Global Lines") continue to work without manual migration.

# Quotation Module Enhancements

## Overview
This update introduces significant enhancements to the Logic Nexus-AI Quotation Module, focusing on configurability, intelligence, and multi-option support.

## Key Features

### 1. Default Configuration
- **Quotation Composer** is now the default module for all new tenants.
- **Database Schema**: `quotation_configuration` table stores tenant-level preferences.
- **Service**: `QuotationConfigurationService` manages default settings and fallbacks.

### 2. Smart Quote Mode
- **Functionality**: Enables AI-driven recommendations and automated routing suggestions.
- **User Control**: Individual users can toggle this mode via settings, persisting to their profile.
- **Settings Panel**: New UI component `QuotationSettingsPanel` for managing these preferences.

### 3. Multi-Option Quotation
- **Architecture**: Supports generating multiple carrier options (e.g., Maersk, MSC, CMA CGM) for a single quote request.
- **Comparison Dashboard**: `QuotationComparisonDashboard` provides a side-by-side view of options with key metrics:
  - **Cost**: Total amount and currency.
  - **Time**: Transit time in days.
  - **Reliability**: AI-calculated reliability score.
  - **Ranking**: Automated scoring based on weighted criteria (Cost, Time, Reliability).

## Database Changes

### New Tables
- `quotation_configuration`: Tenant-level settings.
- `quotation_comparison_snapshots`: Caches comparison data for performance.

### Enhanced Tables
- `quotation_version_options`: Added `rank_score`, `is_recommended`, and `recommendation_reason`.
- `profiles`: Added `quotation_preferences` JSONB column.

## API & Services

### `QuotationConfigurationService`
- `getConfiguration(tenantId)`: Retrieves or creates default config.
- `updateConfiguration(tenantId, updates)`: Modifies tenant settings.
- `setUserSmartModePreference(userId, enabled)`: Updates user-specific smart mode setting.

## UI Components

### `QuotationSettingsPanel`
Located at `src/components/settings/QuotationSettingsPanel.tsx`.
- Toggles for "Smart Quote Mode" and "Multi-Option Quoting".

### `QuotationComparisonDashboard`
Located at `src/components/sales/quotation-versions/QuotationComparisonDashboard.tsx`.
- Visual comparison cards with "Recommended" badges and selection logic.

## Backward Compatibility
- The system defaults to "Composer" mode but retains support for "Legacy" mode via the `default_module` configuration.
- Feature flags (`smart_mode_enabled`, `multi_option_enabled`) ensure new logic is only active when explicitly enabled.

## Testing
- Unit tests: `src/services/quotation/__tests__/QuotationConfigurationService.test.ts`.
- Run tests via `npm test src/services/quotation/__tests__/QuotationConfigurationService.test.ts`.

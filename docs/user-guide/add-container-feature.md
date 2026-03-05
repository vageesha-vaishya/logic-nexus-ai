# Add Container Feature Guide

## Overview
The Add Container section supports dynamic container type and size metadata, strict validation, and edit pre-population for saved quotations.

## API Endpoints
- `GET /api/v1/container-types`
- `GET /api/v1/container-sizes?typeId=<sourceId>`
- `GET /api/v1/health`

## User Flow
1. Open Quote Composer and switch cargo mode to `Container`.
2. Click `Add Container`.
3. Select:
   - `Please select container type`
   - `Please select container size` (enabled only after type selection)
4. Enter quantity and save the quote.
5. Re-open the saved quote from quotation list. Type/size are pre-populated from saved IDs.

## Validation Rules
- Container type is mandatory.
- Container size is mandatory.
- Quantity must be greater than zero.

## Error Handling
- If metadata API fails, inline warning appears with `Retry` action.
- If no metadata exists, API returns `404` and UI falls back to cached/default references.

## Accessibility
- Dropdowns include `aria-label` attributes for screen readers.
- Keyboard navigation is supported through native Select behavior.
- Placeholders are explicit and descriptive.

## Screenshots
- Add Container section with placeholders: `docs/user-guide/screenshots/add-container-placeholders.png`
- Error + retry state: `docs/user-guide/screenshots/add-container-retry.png`
- Edit pre-population state: `docs/user-guide/screenshots/add-container-edit-prepopulate.png`

Note: Capture these screenshots from your environment after deployment to keep them current.

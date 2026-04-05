# AMRO Inventory Postman UAT Pack

## Files
- Collection: `docs/api/amro-inventory-uat.postman_collection.json`
- Environment: `docs/api/amro-inventory-uat.postman_environment.json`

## Scenarios Included
- Reconcile inventory health (`GET /api/v2/amro/inventory/work-order-sync?interface=reconcile`)
- Reserve parts for work order (`POST interface=reserve`)
- Consume reserved parts (`POST interface=consume`)
- Release reservation (`POST interface=release`)
- Scan receive (barcode) (`POST /api/v2/amro/inventory/scan`)
- Scan issue (barcode) (`POST /api/v2/amro/inventory/scan`)

## Setup
1. Import both JSON files into Postman.
2. Select environment `AMRO Inventory UAT Local`.
3. Set required environment values:
   - `accessToken`
   - `tenantId`
   - `franchiseId`
   - `workPackageId`
   - `taskId`
4. Ensure `partNumber` and `scanCode` exist in seeded AMRO inventory.

## Assertions
- Every request validates `HTTP 200`.
- Interface values are asserted:
  - `amro-work-order-reconcile`
  - `amro-work-order-reserve`
  - `amro-work-order-consume`
  - `amro-work-order-release`
  - `amro-inventory-scan`
- Collection stores generated IDs in environment:
  - `reservationId`
  - `inventoryId`
  - `scanEventId`

## UAT Sign-Off Guidance
- Pass criteria:
  - All 6 requests return `200`
  - Interface assertions pass
  - `reservationId` is populated after reserve
  - consume/release complete without validation errors
  - scan receive and scan issue both complete and return updated quantities
- Capture artifacts:
  - Postman run summary export
  - Response payloads for all steps
  - Final environment values snapshot

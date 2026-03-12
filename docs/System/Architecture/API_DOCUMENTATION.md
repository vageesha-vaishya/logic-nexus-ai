# API Documentation (Integration Partners)

## Authentication
- JWT with tenant/franchise claims
- Platform Admins possess global access scopes, bypassing tenant isolation for system-wide operations (e.g. data imports)
- HMAC signatures for webhooks; timestamp and nonce headers

## Ports & Locations
- GET /api/ports?query=string
- Response: UN/LOCODE entries with country, coordinates

## Carriers & Rates
- GET /api/carriers
- POST /api/rates { carrier_id, mode, origin, destination, weight_breaks }
- Webhook: POST /api/webhooks/carrier-status

## Customs
- POST /api/customs/aes/file { shipment_id, filing_data }
- GET /api/customs/aes/itn?shipment_id=...
- POST /api/customs/isf/submit { shipment_id, importer_data }

## Tracking
- POST /api/webhooks/tracking { shipment_id, events[] }
- GET /api/shipments/:id/milestones

## Documents
- POST /api/documents/generate { shipment_id, template }
- GET /api/documents/:id

## Quotations
- POST /api/quotes/delete
- Request:
  - quote_ids: string[] (UUID, required)
  - reason: string | null
  - force_hard_delete: boolean (default false)
  - atomic: boolean (default true)
- Behavior:
  - Validates `quotes.delete` permission and tenant scope before deletion
  - Applies soft delete for protected states/referenced quotes and hard delete otherwise
  - Cascades dependent cleanup (items, charges, comments, documents, approvals, access logs)
  - Writes immutable audit records and quote event entries
  - Releases inventory or serial reservations when linked to the quote
  - Recomputes tenant quote status counts and emits `quote_stats_refresh` notification
- Response:
  - ok: boolean
  - message: string
  - atomic_rolled_back: boolean
  - summary: { requested, processed, hard_deleted, soft_deleted, failed, inventory_released, approvals_cancelled, cache_cleaned }
  - results: per-quote action/error entries
  - stats: per-tenant post-delete status counts

## Localization & Language Policy
- All API responses are strictly in **English (en-US)**.
- Response Header: `Content-Language: en` is included in all Edge Function responses.
- Clients should expect English error messages and data content, regardless of the `Accept-Language` request header or input language.

## Rate Limits
- Per-tenant limits: 600 rpm; burst 1200 rpm; 429 on exceed

## Error Codes
- 400 validation_error; 401 unauthorized; 403 forbidden; 429 rate_limit; 500 server_error

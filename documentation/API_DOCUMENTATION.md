# API Documentation (Integration Partners)

## Authentication
- JWT with tenant/franchise claims
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

## Rate Limits
- Per-tenant limits: 600 rpm; burst 1200 rpm; 429 on exceed

## Error Codes
- 400 validation_error; 401 unauthorized; 403 forbidden; 429 rate_limit; 500 server_error

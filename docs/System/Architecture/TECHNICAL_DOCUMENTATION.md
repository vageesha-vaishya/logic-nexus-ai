# Technical Documentation

## System Overview
- Multi-tenant, multi-franchise logistics CRM and Operations
- Modes: Ocean, Air, Rail, Trucking, Couriers, Movers/Packers
- Core: Consolidation hierarchy (Master ↔ House), Job Costing

## Architecture
- Frontend: React + Vite; per-tenant theming
- Backend: Supabase Postgres; Edge Functions (Deno)
- Observability: Sentry/PostHog; per-tenant metrics
- Performance: read replicas; CDN; caching; queues

## Data Model Highlights
- Master Consols, Shipments (House), Shipment Containers, Shipment Items
- Financial ledger: Job Charges (Revenue/Cost)
- Logistics additions: Rail Consists/Wagons, Dispatch Orders, Parcel Pieces, Household Items

## Edge Functions
- generate-document, calculate-profit, tracking-webhook, screening-check, rate-fetch

## Security
- RLS; franchise scoping; field-level restrictions
- Platform Admin Bypass: Full access granted for critical operations (e.g., Import/Export management)
- Secrets vault; HMAC webhooks; audit logs

## Integrations
- Ports (UN/LOCODE), Carriers (SCAC/IATA), Customs (AES/ISF), Tracking (Project44/Vizion), Rates (WebCargo/Freightos)

## SLAs & SLOs
- Uptime 99.95%; RPO ≤ 5m; RTO ≤ 30m
- Search p95 < 200ms; Save p95 < 500ms; Doc gen p95 < 3s

## CRM Lead Pipeline Mapping and Conversion
- Flow: Leads → Opportunities → Quotes
- Lead Conversion:
  - On convert, lead.status transitions to converted
  - Account and Contact optionally created from lead.company and lead contact fields
  - Opportunity created via canonical mapping:
    - stage: prospecting
    - amount: from lead.estimated_value
    - close_date: from lead.expected_close_date
    - lead_source: from lead.source
    - lead_id: link back to originating lead
- Quote Integration:
  - When a quote is saved with opportunity_id:
    - status draft/sent → opportunity.stage = proposal
    - status accepted → opportunity.stage = closed_won (closed_at set)
    - status rejected → opportunity.stage = closed_lost
- Data Consistency:
  - Canonical types used across modules (e.g., shipment types)
  - Centralized converters (buildOpportunityFromLead) ensure deterministic mappings
- Performance Notes:
  - Conversion write path remains O(1) DB operations per entity; no added N+1 queries
  - Expected p95 for conversion unchanged (< 500ms under typical tenant RLS)
  - Quote stage updates add a single lightweight update per save

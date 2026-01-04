# Architecture & Design Document

## 1. System Overview
Evolve Logic Nexus AI from CRM-centric to enterprise Operational Logistics. Core shifts:
- Consolidation logic (Master ↔ House) across modes
- Job costing (Revenue/Cost ledger) with multi-currency
- Strict multi-tenant isolation with per-tenant observability and SLAs

## 2. Database Schema Redesign (Supabase/PostgreSQL)

### 2.1 Shipment Hierarchy
Instead of a single `shipments` table, we will implement a Consolidation model.

```sql
-- New Table: Master Consols (The "Trip")
CREATE TABLE master_consols (
  id UUID PRIMARY KEY,
  master_bl_number TEXT, -- MBL / MAWB
  carrier_id UUID REFERENCES carriers(id),
  vessel_flight_no TEXT,
  pol_id UUID REFERENCES ports(id),
  pod_id UUID REFERENCES ports(id),
  etd TIMESTAMPTZ,
  eta TIMESTAMPTZ,
  mode TEXT -- 'ocean', 'air', 'truck'
);

-- Modified Table: Shipments (The "Job" / House Bill)
ALTER TABLE shipments ADD COLUMN consol_id UUID REFERENCES master_consols(id);
ALTER TABLE shipments ADD COLUMN house_bl_number TEXT;
ALTER TABLE shipments ADD COLUMN incoterms TEXT; -- EXW, FOB, CIF, etc.
```

### 2.2 Cargo Details
Moving from a flat structure to relational containers and items.

```sql
-- New Table: Shipment Containers (Ocean)
CREATE TABLE shipment_containers (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id),
  container_number TEXT,
  seal_number TEXT,
  container_type TEXT, -- '20GP', '40HC'
  tare_weight_kg DECIMAL,
  gross_weight_kg DECIMAL
);

-- New Table: Shipment Items (Packages)
CREATE TABLE shipment_items (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id),
  container_id UUID REFERENCES shipment_containers(id), -- Optional link
  package_count INTEGER,
  package_type TEXT, -- 'Carton', 'Pallet'
  dimensions_cm JSONB, -- {l, w, h}
  weight_kg DECIMAL,
  hs_code TEXT
);
```

### 2.3 Financials (Job Costing)
A double-entry style ledger for operational job costing.

```sql
-- New Table: Job Charges
CREATE TABLE job_charges (
  id UUID PRIMARY KEY,
  shipment_id UUID REFERENCES shipments(id),
  charge_code TEXT, -- 'OFR', 'THC'
  charge_type TEXT, -- 'REVENUE' (Sell) or 'COST' (Buy)
  bill_to_id UUID REFERENCES accounts(id), -- Who pays us
  vendor_id UUID REFERENCES carriers(id), -- Who we pay
  currency TEXT,
  amount DECIMAL,
  exchange_rate DECIMAL,
  amount_base_currency DECIMAL -- Normalized for reporting
);
```

## 3. Application Architecture

### 3.1 Frontend Components (React)
- Workflow Wizard: Route → Cargo → Charges → Docs
- Data Grids: TanStack Table for charges, containers, items
- PDF Viewer: HBL/MBL/AWB/Invoice previews
- Per-tenant theming; franchise branding

### 3.2 Backend Services (Edge Functions)
- `generate-document`: shipment + template → PDF URL
- `calculate-profit`: on `job_charges` change → margin cache
- `tracking-webhook`: carrier updates → status/milestones
- `screening-check`: denied party screening for contacts
- `rate-fetch`: proxy to WebCargo/Freightos for spot rates

## 4. Integration Strategy
- External APIs via Edge Functions: INTTRA/Project44/Vizion/WebCargo
- Ports & Locations: UN/LOCODE dataset with periodic sync
- Carriers: SCAC/IATA master tables, status webhooks
- Customs: AES/ISF placeholders with export file generation
- Webhooks: HMAC-signed callbacks; per-tenant endpoints

## 5. Security Model (RLS)
- Tenant isolation via `tenant_id` on all tables; franchise `franchise_id` scoping
- Field-level security:
  - `job_charges` COST visible to Accounting/Management only
  - Sales restricted from margin/cost fields
- Audit trails on sensitive changes; append-only logs
- Secrets: per-tenant API keys stored in secure vault

## 6. Scalability & Performance
- Target: 10,000+ concurrent users; scale read-heavy via Postgres read replicas
- Stateless Edge Functions; horizontal autoscaling; global CDN for assets
- Caching: per-tenant cache keys; rate limits by tenant
- Queueing: background jobs for PDF gen and webhooks; retry with DLQ
- Metrics: per-tenant latency/throughput; error budgets; SLOs:
  - Search p95 < 200ms; Save p95 < 500ms; Doc gen p95 < 3s
  - Uptime 99.95%; RPO ≤ 5m; RTO ≤ 30m

## 7. API Specifications (High-Level)
- Auth: JWT with tenant/franchise claims; OAuth for email integrations
- Ports API: GET /ports?query=; returns UN/LOCODE entries
- Carriers API: GET /carriers; POST /rates; webhook /carrier/status
- Customs API: POST /aes/file; GET /aes/itn; POST /isf/submit
- Tracking API: POST /webhook/tracking; GET /shipments/:id/milestones
- Documents API: POST /documents/generate; GET /documents/:id

## 8. Data Models by Vertical (Additions)
- Rail: `rail_consists`, `rail_wagons`, `rail_segments`
- Trucking: `dispatch_orders`, `driver_profiles`, `vehicle_assets`, `pod_events`
- Couriers: `parcel_pieces`, `labels`, `express_services`
- Movers: `household_items`, `crew_schedules`, `insurance_declarations`

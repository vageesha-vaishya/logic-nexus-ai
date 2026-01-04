# Product Requirements Document (PRD) — Logistics Platform 2.0

## 1. Introduction
Upgrade Logic Nexus AI to enterprise-grade Logistics CRM and Operations across Ocean, Air, Rail, Trucking, Couriers, Movers/Packers, Freight Forwarding, and Freight Management. Align with CargoWise, Magaya, and Salesforce Logistics Cloud standards while preserving strict multi-tenant, multi-franchise isolation.

## 2. Core Logistics Modules

### 2.1 Shipment Hierarchy
- Support Master (MBL/MAWB) ↔ House (HBL/HAWB) hierarchy
- Handle Consolidation (multiple Houses to one Master) and Direct shipments
- Routing fields: Place of Receipt, POL, POD, Place of Delivery
- Transport details: Vessel/Voyage, Flight No, Call Sign, Carrier SCAC/IATA code
- Event timeline: ETD/ATD, ETA/ATA, Gate-in/out, Customs milestones

### 2.2 Ocean Freight
- Container management: multiple containers per House; seal numbers, size/type, tare/gross
- FCL/LCL workflows with consolidation manifests
- Documentation: HBL/MBL, Shipping Instructions, Arrival Notice, Delivery Order
- Dangerous goods: IMDG class, UN number, special handling
- Port standards: UN/LOCODE validation

### 2.3 Air Freight
- AWB stock management (airline blocks), Mod-7 check digit validation
- Consolidation: HAWB to MAWB
- ULD tracking: type, serial, capacity, gross weight
- Chargeable weight auto-calculation (1:6000; support 1:167 for inches)
- IATA codes: Airline prefix, Airport codes, service level codes

### 2.4 Rail Freight
- Consist management: wagons, positions, axle loads
- Route segments with rail operator and waybill references
- Hazardous cargo compliance per rail authority

### 2.5 Inland Trucking
- Dispatch board: driver, tractor, trailer assignment; HOS awareness
- LTL/FTL rating: pallet/mile/zone tables with fuel surcharge
- Mobile POD capture with geotag and timestamp

### 2.6 Couriers (Domestic/International)
- Parcel workflows: volumetric weight, multi-piece shipments
- Label generation placeholders, tracking number registry
- Express service levels (Next Day, 2-Day, Economy)

### 2.7 Movers/Packers
- Survey module: household inventory, cube calculation
- Packing materials catalog and crew scheduling
- Insurance declarations and valued inventory lists

### 2.8 Freight Forwarding & Management
- End-to-end milestones across modes
- Booking management, carrier selection, spot vs contract rates
- Exception management: delays, roll-overs, demurrage tracking

## 3. Multi-Tenancy & Franchise Requirements
- Hierarchy: Platform → Tenant → Franchise with hard isolation via tenant_id
- Branding: per-tenant/franchise themes, logo, email domains
- Roles and permissions: tenant-scoped; franchise managers see only franchise data
- Data sharing rules: optional inter-franchise visibility with explicit ACLs
- SLAs per tenant: response time, uptime, support windows
- Rate limiting: per-tenant API limits; burst policies
- Audit: immutable audit logs for security-critical fields

## 4. Financials (Job Costing)
- Accruals vs Actuals; Revenue and Cost lines per job
- Multi-currency with daily FX rates and ROE locking per voyage/flight
- Profit/Loss per House and rolled-up to Master
- Charge catalog: OFR, THC, DOC, ISF, Customs, Cartage, Storage, Demurrage
- Auto-rating: pull from quotes/tariffs; override with spot rates

## 5. Compliance & Integrations
- Customs: AES filing (ITN), ISF 10+2, AMS/ACI placeholders
- Screening: Denied Party/Export Controls checks
- Tracking: project44/Vizion/WebCargo placeholders; webhook ingestion
- Standards: SCAC, IATA, UN/LOCODE, HS codes

## 6. User Roles & Permissions
- Operator, Sales, Accounts, Management with margin protection
- Field-level security for cost visibility and sensitive compliance fields

## 7. Non-Functional Requirements (Enterprise)
- Performance: search < 200ms; shipment save < 500ms; doc generation < 3s
- Scalability: 10,000+ concurrent users; 100,000+ shipments per tenant
- Availability: 99.95% monthly uptime; RPO ≤ 5 minutes; RTO ≤ 30 minutes
- Security: SOC 2-aligned; encryption at rest/in transit; per-tenant secrets
- Observability: per-tenant metrics, tracing, error budgets

## 8. Vertical-Specific Performance Metrics & SLAs
- Ocean: container ops latency < 300ms; BL generation < 2s; tracking update propagation < 30s
- Air: chargeable weight calc < 50ms; AWB assignment < 200ms
- Rail: consist update < 200ms; route segment persistence < 150ms
- Trucking: dispatch assignment < 150ms; mobile POD upload < 1s on LTE
- Courier: label request < 1s; multi-piece rate calc < 300ms
- Movers: survey save < 200ms; crew schedule conflict detection < 200ms

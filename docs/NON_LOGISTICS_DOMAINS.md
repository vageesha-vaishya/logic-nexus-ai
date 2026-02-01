# Non-Logistics Domains Configuration

This document outlines the configuration, data structure, and seeding process for non-logistics domains (Trading, Insurance, Customs) in the Logic Nexus AI platform.

## Overview

The platform supports a domain-agnostic service architecture where "Services" are not limited to transport (logistics). We have expanded the system to support:

1.  **Trading & Procurement**: Sourcing agents, quality inspectors.
2.  **Insurance**: Cargo insurance, liability coverage.
3.  **Customs & Compliance**: Clearance agents, regulatory compliance.

## Data Structure

These domains utilize the standard `services`, `service_types`, and `service_details` tables, differentiated by `category_id` and `service_type_id`.

### Service Categories
| Code | Name | Description |
|------|------|-------------|
| `trading` | Trading & Procurement | Sourcing, inspection, and trade finance |
| `insurance` | Insurance Services | Cargo and business liability insurance |
| `customs` | Customs & Compliance | Regulatory compliance and clearance |

### Service Types & Attributes

Each service type has specific attributes defined in `service_attribute_definitions`. These attributes are stored as JSONB in `service_details.attributes`.

#### 1. Procurement Agent (`procurement_agent`)
- **Category**: Trading
- **Mode**: Digital
- **Attributes**:
  - `market_region` (Select): Asia, Europe, North America, Global.
  - `commission_rate_percent` (Number): 0-100%.
  - `specialties` (Array): e.g., Electronics, Textiles.

#### 2. Quality Inspection (`quality_inspection`)
- **Category**: Trading
- **Mode**: Digital
- **Attributes**:
  - `inspection_standard` (Select): ISO9001, AQL Level II, Custom.
  - `report_format` (Select): PDF, Video, Live Stream.

#### 3. Cargo Insurance (`cargo_insurance`)
- **Category**: Insurance
- **Mode**: Digital
- **Attributes**:
  - `coverage_type` (Select): All Risk, Total Loss Only, General Average.
  - `deductible_percent` (Number): 0-100%.
  - `max_insured_value` (Number): Max coverage amount in USD.

#### 4. Import Clearance (`import_clearance`)
- **Category**: Customs
- **Mode**: Digital
- **Attributes**:
  - `customs_regime` (Select): Home Use, Temporary Admission, Bonded Warehouse, Transit.
  - `requires_poa` (Boolean): Whether Power of Attorney is required.

## Seeding Process

We have implemented an idempotent seeding mechanism to populate these domains.

### Migration Files
1.  **`20260131050000_ensure_service_schema.sql`**: Ensures base tables (`service_categories`, `service_attribute_definitions`) exist.
2.  **`20260131100000_seed_non_logistics_domains.sql`**:
    - Inserts Service Categories.
    - Inserts Service Types with `code` identifiers.
    - Defines Attribute Definitions for each type.
    - Inserts Sample Services (only if the default tenant `9e2686ba-ef3c-42df-aea6-dcc880436b9f` exists).

### Running the Seed
To apply the schema changes and seed data, run the automated migration script:

```bash
npm run migrate:auto
```

### Verification
To verify that the domains and attributes have been correctly seeded, run the verification script:

```bash
node scripts/verify_non_logistics_seeding.js
```

This script checks for the existence of:
- All 3 Categories
- All 4 Service Types
- All 10 Attribute Definitions

## Sample Data

If the default tenant exists, the following sample service is created:

- **Service**: Global Electronics Sourcing
- **Type**: Procurement Agent
- **Attributes**:
  ```json
  {
    "market_region": "Asia",
    "commission_rate_percent": 5,
    "specialties": ["Electronics"]
  }
  ```

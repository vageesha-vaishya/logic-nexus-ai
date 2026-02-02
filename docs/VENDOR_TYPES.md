
# Vendor Type System Architecture

## Overview
The Vendor Management module has been enhanced to support granular logistics-specific vendor types. This allows for better categorization, filtering, and data management of various supply chain participants.

## Vendor Types
The `vendors` table now supports the following types via the `vendors_type_check` constraint:

### Logistics Providers
- **ocean_carrier**: Vessel operators (e.g., Maersk, MSC)
- **air_carrier**: Airlines (e.g., FedEx Express, Lufthansa Cargo)
- **trucker**: Road transport operators (e.g., JB Hunt)
- **rail_carrier**: Rail freight operators
- **freight_forwarder**: NVOCCs and forwarders (e.g., Kuehne + Nagel)
- **courier**: Express delivery services (e.g., DHL, UPS)
- **3pl**: Third-party logistics providers
- **warehouse**: Storage and distribution centers
- **customs_broker**: Customs clearance agents

### General & Support
- **carrier**: General carrier (legacy/fallback)
- **agent**: Shipping agents
- **broker**: Freight brokers
- **technology**: Tech providers (TMS, IoT)
- **manufacturing**: Suppliers/Factories
- **retail**: Retailers/Importers
- **wholesaler**: Distributors
- **consulting**: Consultants
- **other**: Miscellaneous

## Data Schema
### JSONB Columns
To support the diverse data requirements of these different types without creating many sparse columns, we use PostgreSQL `JSONB` columns:

1.  **`operational_data`**: Stores capabilities and assets.
    - *Common Fields*: `fleet_size`, `regions_served`, `certifications`, `insurance_coverage`
    - *Type-Specific*:
        - `ocean_carrier`: `vessel_count`, `teu_capacity`
        - `air_carrier`: `aircraft_count`, `iata_code`
        - `warehouse`: `warehouse_capacity_sqft`
        - `manufacturing`: `production_capacity`, `lead_time_days`

2.  **`performance_metrics`**: Stores KPI data.
    - `on_time_delivery_rate`
    - `quality_rating`
    - `claim_ratio`

## API & Validation
- **Frontend**: `src/types/vendor.ts` defines the `VendorType` union type.
- **Validation**: Zod schema in `VendorForm.tsx` enforces valid types.
- **Database**: Check constraints prevent invalid types at the database level.

## Seeding
The system includes a comprehensive seeding script (`scripts/seed_comprehensive_vendors.ts`) that:
- Populates real-world major carriers (Maersk, FedEx, etc.)
- Generates realistic random vendors with proper `operational_data` structure using Faker.js.
- Is idempotent (updates existing real-world vendors, skips duplicates).

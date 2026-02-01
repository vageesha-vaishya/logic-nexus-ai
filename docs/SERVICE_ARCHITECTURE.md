# Service Architecture & Domain Model

## Overview

The Service Architecture in Logic Nexus AI is designed to be domain-agnostic, supporting a wide range of business domains beyond logistics (e.g., Banking, Ecommerce, Telecommunications). This architecture uses a normalized hierarchy to classify services, ensuring scalability and consistency.

## Hierarchy

The service classification hierarchy is as follows:

1.  **Platform Domains** (`platform_domains`)
    *   Top-level business areas (e.g., Logistics, Banking & Finance, Ecommerce).
    *   Defined by a unique `key` (e.g., `LOGISTICS`, `BANKING`).
    *   Acts as the root for service categorization.

2.  **Service Modes** (`service_modes`)
    *   The operational mode of the service.
    *   Standard modes: `Ocean`, `Air`, `Road`, `Rail`.
    *   Digital mode: `Digital Services` (used for Banking, Insurance, etc.).

3.  **Service Categories** (`service_categories`)
    *   Functional grouping of services within a domain.
    *   Linked to a specific `platform_domain` via `domain_id`.
    *   Examples:
        *   Logistics: `Transportation`, `Warehousing`.
        *   Banking: `Account Management`, `Lending Services`.

4.  **Service Types** (`service_types`)
    *   Specific types of services offered.
    *   Linked to a `service_category` via `category_id`.
    *   Optionally linked to a `service_mode` via `mode_id`.
    *   Examples: `Ocean Freight`, `Savings Account`, `Product Listing`.

## Database Schema

### `platform_domains`
| Column | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary Key |
| `key` | TEXT | Unique identifier (uppercase) |
| `name` | TEXT | Display name |
| `status` | TEXT | Active status |

### `service_categories`
| Column | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary Key |
| `name` | TEXT | Category name |
| `domain_id` | UUID | FK to `platform_domains` |

### `service_types`
| Column | Type | Description |
| --- | --- | --- |
| `id` | UUID | Primary Key |
| `name` | TEXT | Service Type name |
| `category_id` | UUID | FK to `service_categories` |
| `mode_id` | UUID | FK to `service_modes` |

## Enterprise Service Architecture

To support end-to-end operations (Sales, Billing, VRM), the architecture includes advanced capabilities:

### Global vs. Tenant Services
*   **Global Services**: `tenant_id IS NULL`. These act as standard templates or platform-wide offerings.
*   **Tenant Services**: `tenant_id IS NOT NULL`. Specific to a tenant, can inherit from a global parent via `parent_service_id`.

### Configuration Engines (JSONB)
To support complex logic without schema bloat, `services` uses configuration objects:
*   **`billing_config`**: Tax codes, GL accounts, Invoice triggers (e.g., `shipment_departed`), Billing frequency.
*   **`pricing_config`**: Pricing model (Flat, Tiered, Zone), Currency, Override rules.
*   **`fulfillment_config`**: Provisioning type (Manual, Auto), Workflow IDs, SLAs.
*   **`compliance_config`**: Required documents, Hazmat support, Customs codes.

### Vendor Relationship Management (VRM)
*   **`vendors`**: Central repository of carriers, agents, and partners.
*   **`service_vendors`**: Many-to-Many link defining which vendors fulfill a service, including:
    *   `cost_structure` (Vendor rates).
    *   `is_preferred` (Routing logic).
    *   `sla_agreement`.

### Advanced Pricing
*   **`service_pricing_tiers`**: Relational table for high-performance tiered pricing queries (e.g., "1-10 units: $100", "11+ units: $90").

## Seeding Process

The system uses idempotent migration scripts to seed the initial domains and service types.

1.  **Script:** `supabase/migrations/20260201140000_seed_logistics_services.sql` (Comprehensive Logistics & Domains)
2.  **Script:** `supabase/migrations/20260201150000_seed_transport_services.sql` (Detailed Transportation Services)
3.  **Script:** `supabase/migrations/20260201160000_enterprise_service_architecture.sql` (Enterprise Features & Global Templates)
4.  **Process:**
    *   Ensures `platform_domains` exist (Logistics, Banking, etc.).
    *   Ensures `service_categories` are linked to domains.
    *   Seeds comprehensive hierarchy for Logistics (Transportation, Warehousing, Last Mile, etc.).
    *   Seeds detailed service variations (e.g., Ocean 20' Standard, Air NFO, Road Dry Van).
    *   Enables Global Services and seeds "Global Ocean FCL" template with VRM and Tiered Pricing.

## Supported Domains & Mappings

### Logistics & Supply Chain (`LOGISTICS`)
*   **Transportation Management**
    *   `ocean_fcl` (Ocean): 20'/40' Standard, High Cube, Reefer, Flat Rack.
    *   `ocean_lcl` (Ocean): General, Hazardous.
    *   `air_express` (Air): Next Flight Out, Priority.
    *   `air_standard` (Air): Consolidated.
    *   `road_ftl` (Road): Dry Van 53', Reefer.
    *   `road_ltl` (Road): Standard LTL.
    *   `rail_intermodal` (Rail): 53' Domestic Container.
*   **Warehousing & Storage**
    *   `bonded_warehouse`, `cold_storage`, `distribution_center` (Road/Digital)
*   **Last Mile Delivery**
    *   `same_day_delivery`, `next_day_delivery` (Road)
*   **Customs & Compliance**
    *   `import_filing`, `export_declaration` (Digital)
*   **Supply Chain Visibility**
    *   `real_time_tracking`, `temp_monitoring` (Digital)

### Other Domains (Examples)
*   **Banking:** Account Management (Savings), Lending.
*   **Ecommerce:** Order Fulfillment (Pick & Pack).
*   **Telecommunications:** Network Services.

## Management Interfaces

*   **Platform Domains:** `/dashboard/settings/domains` - Manage top-level domains.
*   **Service Types:** `/dashboard/settings/service-types` - Manage service types, linked to Categories and Modes.

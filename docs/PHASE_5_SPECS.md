# Phase 5 Specifications: Vendor Relationship Management (VRM)

**Status:** Draft
**Target Date:** 2026-02-01
**Owner:** Logic Nexus AI Development Team

## 1. Executive Summary
Phase 5 focuses on activating the **Vendor Relationship Management (VRM)** module. This phase enables the system to manage external partners (Carriers, Agents, Brokers) and link them to specific services. This is critical for the "Cost" side of the quotation equation, allowing the system to calculate margins by comparing "Vendor Buy Rates" vs. "Customer Sell Rates".

## 2. Database Schema (Existing)
The following tables were established in Phase 4 and will be the foundation for Phase 5:

*   **`vendors`**: Central registry of partners.
    *   Columns: `name`, `code`, `type` (carrier, agent, etc.), `contact_info` (JSONB), `compliance_data` (JSONB).
*   **`service_vendors`**: Linkage table.
    *   Columns: `service_id`, `vendor_id`, `is_preferred`, `cost_structure` (JSONB), `sla_agreement` (JSONB).

## 3. Functional Requirements

### 3.1 Vendor Directory
*   **UI Component:** `src/pages/dashboard/Vendors.tsx`
*   **Features:**
    *   Paginated list of vendors.
    *   Filtering by Type (Carrier, Agent, Warehouse).
    *   Search by Name or Code.
    *   Status toggle (Active/Inactive).

### 3.2 Vendor Management (CRUD)
*   **Create/Edit Dialog:**
    *   Basic Info: Name, Code, Type.
    *   Contact Details: Email, Phone, Address (stored in `contact_info` JSONB).
    *   Compliance: License numbers, Insurance expiry (stored in `compliance_data` JSONB).
*   **Validation:** Zod schema for strict typing.

### 3.3 Service-Vendor Linkage
*   **Location:** "Suppliers" tab within the **Service Details** dialog (`Services.tsx`).
*   **Features:**
    *   Add existing vendor to a service.
    *   Define `cost_structure` (e.g., Buy Rate, Currency, Validity).
    *   Set `is_preferred` flag for auto-routing logic.

## 4. Technical Implementation Plan

### 4.1 Frontend Components
1.  **`VendorList`**: Main data table using `tanstack/react-table`.
2.  **`VendorDialog`**: Form for adding/editing vendors.
3.  **`ServiceVendorManager`**: Component to handle the `service_vendors` relationship inside the Service view.

### 4.2 Data Access
*   Create `useVendors` hook for fetching/mutating vendor data.
*   Implement `get_service_vendors` RPC (optional, or use standard select) to fetch linked vendors efficiently.

### 4.3 Seeding
*   Expand seed data to include real-world examples:
    *   **Carriers:** Maersk, MSC, Delta Cargo.
    *   **Agents:** DHL Global Forwarding, Kuehne+Nagel.
    *   **Linkage:** Link "Maersk" to "Ocean FCL" with sample buy rates.

## 5. Success Criteria
*   [ ] Can create, update, and delete a Vendor.
*   [ ] Can assign a Vendor to a Service.
*   [ ] Can define a "Buy Rate" for a Service-Vendor link.
*   [ ] "Suppliers" tab in Service Details accurately reflects linked vendors.

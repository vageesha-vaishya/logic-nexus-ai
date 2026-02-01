# Enterprise Quotation Management Architecture

## 1. Executive Summary

This document outlines the architectural overhaul of the Logic Nexus AI Quotation Management System. The goal is to transition from a basic quoting tool to an enterprise-grade Price Configure Quote (CPQ) engine capable of handling complex logistics scenarios, multi-tenant requirements, and automated workflows.

## 2. Gap Analysis

| Feature | Current State | Target Enterprise State | Gap Severity |
| :--- | :--- | :--- | :--- |
| **Pricing Engine** | Simple flat rates, manual entry. | Tiered, Zone-based, and Formula-based pricing linked to Service Contracts. | Critical |
| **Service Linkage** | Loose coupling via text/type. | Strict Referential Integrity to `services` table with Versioning. | High |
| **Approvals** | None (Hardcoded status). | Configurable Rules Engine (e.g., "Margin < 10% requires Manager"). | High |
| **Versioning** | Basic `quotation_versions` table. | Full Audit Trail, Snapshot of Pricing/Billing Configs at time of quote. | Medium |
| **Billing Integration** | Disconnected. | Quote captures `billing_config` (GL Accounts, Tax Codes) for seamless invoicing. | High |
| **Vendor Management** | Manual carrier entry. | Integrated VRM with "Preferred Vendor" logic and automated cost lookup. | Medium |

## 3. Technical Architecture

### 3.1 Schema Enhancements (`20260201170000_enterprise_quote_architecture.sql`)

The database schema has been normalized and extended:

*   **`quote_options` Extensions**:
    *   `service_id`: FK to `services` (enables global templates).
    *   `*_config_snapshot`: JSONB columns to freeze business rules (Billing, Pricing, Fulfillment) at the moment of creation.
    *   `incoterms`: Standardized trade terms.
*   **`quote_approvals`**:
    *   New table to track approval requests.
    *   Linked to `quote_approval_rules` (JSONB criteria).
*   **`quote_pricing_logs`**:
    *   Audit trail for *why* a price was calculated (e.g., "Tier 2 Applied", "Manual Override").

### 3.2 Pricing Logic (RPC: `calculate_service_price`)

A new Postgres function handles the complexity of pricing:
1.  **Input**: `service_id`, `quantity`, `customer_id`.
2.  **Lookup**: Fetches `pricing_config` from the Service.
3.  **Tier Check**: Queries `service_pricing_tiers` for volume discounts.
4.  **Contract Check**: (Future) Checks specific Customer Contract overrides.
5.  **Output**: Final Unit Price, Total, and Audit Log of the rule applied.

### 3.3 Approval Workflow Engine

*   **Rules Table**: `quote_approval_rules` defines criteria (e.g., `{"min_margin_percent": 10}`).
*   **Process**:
    1.  Quote submitted -> `pending_approval`.
    2.  System checks Rules -> Creates `quote_approvals` entry if triggered.
    3.  Authorized User (Role-based) approves/rejects.
    4.  Quote moves to `approved` or `rejected`.

## 4. Implementation Roadmap

### Phase 1: Foundation (Completed)
*   Schema migration for Enterprise Architecture.
*   Service Seeding (Logistics, Global Templates).
*   Pricing Logic RPC.

### Phase 2: Backend Logic (Next Steps)
*   Update `QuotationComposer` to call `calculate_service_price`.
*   Implement `submitQuoteForApproval` Edge Function.
*   Integrate `billing_config_snapshot` into Invoice Generation.

### Phase 3: Frontend UI
*   **Smart Pricing Widget**: Shows applied Tiers/Discounts.
*   **Approval Dashboard**: For Managers to review pending quotes.
*   **Version History**: Visual diff of Quote Versions.

## 5. Testing Strategy

### 5.1 Unit Tests
*   **Pricing RPC**: Verify Tier 1 vs. Tier 2 pricing.
*   **Approval Rules**: Verify high-value quote triggers "Director" approval.

### 5.2 Integration Tests
*   **End-to-End Quote**: Create Quote -> Add Service -> Calculate Price -> Submit -> Verify Approval Request.

## 6. Performance & Scalability
*   **Indexing**: Added indices on `service_id`, `status`, and `quote_id` for fast lookups.
*   **JSONB**: Uses JSONB for flexible configuration to avoid heavy JOINs for simple rule checks.
*   **Archiving**: Old Quote Versions can be moved to cold storage (future) while keeping the Active Version hot.

## 7. Security
*   **RLS Policies**: Strict Tenant Isolation on all new tables.
*   **Role-Based Access**: Only users with specific roles (defined in `quote_approval_rules`) can approve requests.

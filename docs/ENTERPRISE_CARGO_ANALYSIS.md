# Enterprise Cargo & Commodity Architecture Analysis
## Comprehensive Research & Findings Report

**Date:** 2026-02-02
**Scope:** Cargo Type, Commodity, HTS, Logistics, Financial Integration
**Target Audience:** CTO, Lead Architect, Product Strategy

---

## 1. Executive Summary

A comprehensive audit of the platform's codebase and database schema reveals a robust **Operational Architecture** but a significant gap in **Financial Execution**. 

The **Cargo & Commodity** domain is well-modeled, featuring advanced HTS classification (`aes_hts_codes`), tenant-specific product catalogs (`master_commodities`), and detailed cargo attributes (`cargo_details`). The **Quotation** and **Shipment** modules are tightly integrated with this data, ensuring operational consistency.

However, the **Financial Accounting** integration is currently nascent. While the system can *calculate* costs and prices (via `quote_charges` and `carrier_rates`), it lacks the entities to *bill* and *recognize revenue* (Invoices, Payments, General Ledger). The system currently relies on text-based references (e.g., `shipments.invoice_number`) rather than structured financial entities.

**Critical Recommendation:** The immediate strategic priority must be bridging the gap between **Operational Execution** (Shipments) and **Financial Settlement** (Invoicing/Accounting) to compete with enterprise platforms like WiseTech CargoWise or SAP SCM.

---

## 2. Current State Architecture

### 2.1 Entity Relationship Diagram (Conceptual)

```mermaid
graph TD
    %% Master Data
    HTS[AES HTS Codes] -->|Classifies| MC[Master Commodities]
    MC -->|Defines| CD[Cargo Details]
    CT[Cargo Types] -->|Categorizes| CD
    
    %% Operational Flow
    CD -->|Embedded In| QI[Quote Items]
    QI -->|Converts To| SI[Shipment Items]
    SI -->|Belongs To| SH[Shipment]
    
    %% Financial Flow (Current)
    CR[Carrier Rates] -->|Calculates| QC[Quote Charges]
    QC -->|Linked To| Q[Quote]
    Q -->|Generates| SH
    
    %% The Gap
    SH -.->|Manual Link?| INV[Invoices (MISSING)]
    INV -.->|No Schema| GL[General Ledger (MISSING)]
```

### 2.2 Domain Analysis

| Domain | Entity Maturity | Key Tables | Status |
| :--- | :--- | :--- | :--- |
| **Commodity Master** | 🟢 **High** | `aes_hts_codes`, `master_commodities` | Enterprise-grade. Supports full HTS hierarchy (Chapter/Heading), search vectors, and tenant catalogs. |
| **Cargo Operations** | 🟢 **High** | `cargo_details`, `cargo_types` | Detailed attributes (Hazmat, Temp Control, Dimensions). Good flexibility via JSONB. |
| **Quotation** | 🟡 **Medium** | `quotes`, `quote_charges`, `quote_pricing_logs` | Strong pricing logic (audit trails, margins). Lacks direct link to "Final Invoice". |
| **Logistics** | 🟢 **High** | `shipments`, `shipment_items`, `services` | Robust tracking and service execution. `services` table includes `billing_config` JSONB (forward-looking). |
| **Financials** | 🔴 **Critical Gap** | N/A (Only `carrier_rates`) | **Missing**: `invoices`, `payments`, `credit_notes`, `general_ledger`, `journal_entries`. |

---

## 3. Data Flow & Lifecycle Analysis

### 3.1 The "Happy Path" (Current vs. Ideal)

**1. Classification (✅ Working)**
*   **User** selects HTS code from `aes_hts_codes`.
*   **System** auto-populates Duty Rates and Compliance flags.
*   **Data** stored in `master_commodities` for reuse.

**2. Quotation (✅ Working)**
*   **User** creates Quote.
*   **System** pulls `master_commodities` -> `quote_items`.
*   **System** calculates `quote_charges` based on `carrier_rates` + `cargo_details` (weight/volume).
*   **Audit**: `quote_pricing_logs` tracks *why* a price was chosen (Tier/Contract).

**3. Execution (✅ Working)**
*   **User** converts Quote -> Shipment.
*   **System** copies `quote_items` -> `shipment_items`.
*   **System** references `quote_charges` for cost baseline.

**4. Settlement (❌ Broken)**
*   **Current**: User manually types an "Invoice Number" into `shipments.invoice_number` text field.
*   **Ideal**: System generates an immutable `Invoice` record from `shipment_items` + `actual_charges`.
*   **Impact**: No revenue recognition, no aging reports, no automated reconciliation.

---

## 4. Competitor Comparative Analysis

| Feature | **Logic Nexus AI** (Current) | **WiseTech CargoWise** (Leader) | **SAP SCM** (Enterprise) |
| :--- | :--- | :--- | :--- |
| **Core Architecture** | Modern, Modular, JSONB-heavy | Monolithic, SQL-heavy, "Clunky" UI | In-Memory (HANA), Rigid, Powerful |
| **Commodity Data** | **Best-in-Class**: Search-optimized HTS, Tenant Catalogs | Standard static tables, manual updates | Deep ERP integration (Material Master) |
| **Financial Integration** | **Disconnected**: Ops isolated from Finance | **Fully Integrated**: Ops acts as sub-ledger. Billing is automatic. | **Native**: Real-time posting to SAP FI/CO. |
| **Customs/Compliance** | **Strong**: Integrated RPS/HTS RPCs | **Industry Standard**: Direct EDI with Customs (ACE/AMS) | Module-based (GTS), complex setup |
| **User Experience** | **Modern**: React/Shadcn, Fast | **Dated**: Windows Forms, "Excel-like" | **Complex**: Fiori / GUI |

**Key Insight:** Competitors win on **"One Platform"** promises. CargoWise's sticky power is that an Operator booking a shipment *automatically* creates the Accruals and WIP (Work in Progress) entries in the accounting system. Logic Nexus AI currently requires a "swivel chair" integration to an external accounting tool.

---

## 5. Strategic Recommendations

### 5.1 Phase 1: Close the Financial Gap (Immediate)
We must implement a **Logistics Invoicing Module** immediately.
*   **New Table**: `invoices` (Linked to `shipments`).
*   **New Table**: `invoice_line_items` (Linked to `quote_charges` / `actual_charges`).
*   **New Table**: `transaction_ledger` (A simplified double-entry sub-ledger for AR/AP).

### 5.2 Phase 2: Automated Revenue Recognition
*   leverage the existing `services.billing_config` JSONB.
*   Implement a **Billing Trigger**: When `shipment.status` = 'Departed', auto-generate Invoice Draft.
*   Implement **Cost Accrual**: When `carrier_booking` is confirmed, accrue estimated cost in the ledger.

### 5.3 Phase 3: ERP Integration (The "Enterprise" Connector)
*   Do *not* build a full Accounting Suite (Tax, Payroll, Asset Depr).
*   Instead, build **"Connectors"** that sync the `transaction_ledger` to:
    *   QuickBooks Online (SMB)
    *   Xero (SMB)
    *   NetSuite (Mid-Market)
    *   Dynamics 365 (Enterprise)

### 5.4 Data Model Improvements
*   **Link Quotes to Invoices**: Add `quote_charge_id` to `invoice_line_items` for "Plan vs. Actual" profit analysis.
*   **Multi-Currency Standardization**: Ensure `invoices` support `transaction_currency` vs `base_currency` with `exchange_rate` snapshots (critical for logistics).

---

## 6. Proposed Roadmap

1.  **Month 1**: Design & Deploy `invoices` and `payments` schema.
2.  **Month 2**: Build "Shipment to Invoice" conversion wizard (UI).
3.  **Month 3**: Implement "Profitability Report" (Revenue - Cost) per Shipment.
4.  **Month 4**: Build Xero/QuickBooks Integration.

## 7. Conclusion
The platform has a **World-Class Operational Core**. The commodity and cargo handling is superior to many legacy competitors due to its flexibility and search capabilities. However, without an **Integrated Financial Loop**, it remains a "Quoting & Tracking Tool" rather than an "Operating System". Closing this loop is the single highest-value engineering task available.

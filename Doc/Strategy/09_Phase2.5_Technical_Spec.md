# Phase 2.5: Taxation & Financials - Technical Specification

## 1. Executive Summary
This document defines the technical architecture for the **Taxation & Financials** module of SOS-Nexus. This module is the financial backbone, responsible for multi-jurisdiction tax calculation, full-lifecycle invoicing, and General Ledger (GL) synchronization.

## 2. Architecture Overview
The system follows a modular design integrated into the core kernel:

*   **Taxation Service:** A stateless, rules-based engine.
*   **Invoicing Service:** A stateful manager for financial documents.
*   **GL Sync Service:** An asynchronous, reliable event processor for external accounting integration.

## 3. Detailed Data Model (ERD)

### 3.1 Taxation Schema (`finance` schema recommended)

```sql
-- Jurisdiction (e.g., Country: US, State: CA, City: SF)
CREATE TABLE finance.tax_jurisdictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) NOT NULL, -- e.g., "US-CA"
  name VARCHAR(100) NOT NULL,
  parent_id UUID REFERENCES finance.tax_jurisdictions(id),
  type VARCHAR(20) NOT NULL -- 'COUNTRY', 'STATE', 'CITY', 'DISTRICT'
);

-- Tax Codes (Product Categories)
CREATE TABLE finance.tax_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL, -- e.g., "SaaS-001"
  description TEXT,
  is_active BOOLEAN DEFAULT true
);

-- Tax Rules (Versioned)
CREATE TABLE finance.tax_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id UUID REFERENCES finance.tax_jurisdictions(id),
  tax_code_id UUID REFERENCES finance.tax_codes(id), -- NULL means "Standard Rate"
  rate DECIMAL(10, 4) NOT NULL, -- 0.0825 for 8.25%
  priority INT DEFAULT 0, -- Higher priority overrides lower
  effective_from TIMESTAMP WITH TIME ZONE NOT NULL,
  effective_to TIMESTAMP WITH TIME ZONE, -- NULL = Current
  rule_type VARCHAR(20) DEFAULT 'STANDARD' -- 'STANDARD', 'REDUCED', 'EXEMPT'
);
```

### 3.2 Invoicing Schema

```sql
CREATE TABLE finance.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL, -- RLS
  customer_id UUID NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  status VARCHAR(20) DEFAULT 'DRAFT', -- DRAFT, SENT, PAID, VOID, OVERDUE
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL,
  subtotal DECIMAL(15, 2) NOT NULL,
  tax_total DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL,
  metadata JSONB
);

CREATE TABLE finance.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES finance.invoices(id),
  description TEXT NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit_price DECIMAL(15, 2) NOT NULL,
  tax_code_id UUID REFERENCES finance.tax_codes(id),
  tax_amount DECIMAL(15, 2) NOT NULL,
  total_amount DECIMAL(15, 2) NOT NULL
);
```

### 3.3 GL Sync Schema

```sql
CREATE TABLE finance.gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  code VARCHAR(50) NOT NULL, -- e.g., "4000"
  name VARCHAR(100) NOT NULL, -- e.g., "Sales Revenue"
  type VARCHAR(20) NOT NULL -- 'ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'
);

CREATE TABLE finance.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  reference_id UUID NOT NULL, -- Link to Invoice/Payment ID
  reference_type VARCHAR(50) NOT NULL, -- 'INVOICE', 'PAYMENT'
  sync_status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, SYNCED, FAILED
  external_id VARCHAR(100), -- ID in QuickBooks/Xero
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 4. API Contracts

### 4.1 Tax Calculation
**POST** `/api/v1/tax/calculate`
```json
{
  "jurisdiction_code": "US-CA-SF",
  "items": [
    { "amount": 100.00, "tax_code": "SaaS-001" }
  ]
}
```
**Response:**
```json
{
  "total_tax": 8.50,
  "breakdown": [
    { "level": "STATE", "rate": 0.06, "amount": 6.00 },
    { "level": "CITY", "rate": 0.025, "amount": 2.50 }
  ]
}
```

### 4.2 Invoice Generation
**POST** `/api/v1/invoices`
```json
{
  "customer_id": "uuid",
  "items": [...]
}
```

## 5. Sequence Diagrams (Logic Flows)

### 5.1 Invoice Creation Flow
1. **Client** submits Draft Invoice.
2. **InvoiceService** calls **TaxEngine.calculate()**.
3. **TaxEngine** resolves Jurisdictions -> Fetches Active Rules -> Computes Amounts.
4. **InvoiceService** saves Invoice + Items (Status: DRAFT).

### 5.2 GL Sync Flow (Async)
1. **InvoiceService** updates status to 'SENT' or 'PAID'.
2. **EventBus** emits `INVOICE_FINALIZED`.
3. **GLSyncService** consumes event.
4. **GLSyncService** maps Invoice Items -> Revenue Account (Credit).
5. **GLSyncService** maps Tax -> Tax Liability Account (Credit).
6. **GLSyncService** maps Total -> AR Account (Debit).
7. **GLSyncService** pushes to External ERP (Mock for Phase 2.5).
8. **GLSyncService** updates `journal_entries` status.

## 6. Testing Strategy
*   **Unit Tests:** Jest tests for Tax Logic (Input -> Output verification).
*   **Integration Tests:** Invoice creation triggers GL entry creation.
*   **Performance:** Tax calculation < 100ms.

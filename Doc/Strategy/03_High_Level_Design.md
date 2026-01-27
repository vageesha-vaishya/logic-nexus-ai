# High-Level Design (HLD) Document: Configurable Enterprise Platform

## 1. Architectural Overview
The platform follows a **Modular Monolith** or **Micro-kernel Architecture** (depending on deployment scale), transitioning towards **Microservices**. The core system acts as a host for domain-specific plugins, managing common concerns like authentication, tenant resolution, and request routing.

*   **Core Kernel:** Manages lifecycle, security, and orchestration.
*   **Domain Plugins:** Independent modules containing business logic, loaded dynamically or configured at build time.

## 2. System Context Diagram
```mermaid
graph TD
    User[Enterprise User] -->|HTTPS| API_Gateway[API Gateway / Load Balancer]
    API_Gateway -->|Route| Platform_Core[Platform Core Services]
    
    subgraph "SOS Logistics Pro Platform"
        Platform_Core -->|Load| Plugin_Logistics[Logistics Plugin]
        Platform_Core -->|Load| Plugin_Banking[Banking Plugin]
        Platform_Core -->|Load| Plugin_Telecom[Telecom Plugin]
        Platform_Core -->|Invoke| Module_Taxation[Taxation Module]
        
        Platform_Core -->|Read/Write| DB[(Multi-Tenant DB)]
        Platform_Core -->|Event| Message_Broker[Message Queue]
    end
    
    Plugin_Logistics -->|API| External_Carriers[Carrier APIs]
    Plugin_Banking -->|API| Credit_Bureau[Credit Bureau APIs]
    Module_Taxation -->|API| Tax_Authority[Govt/Avalara APIs]
```

## 3. Container Diagram
*   **Web App (React):** Single Page Application (SPA) with dynamic form rendering based on tenant configuration.
*   **API Service (Node.js/TypeScript or Go):** REST/gRPC API layer.
    *   **Auth Module:** Handles JWT and Tenant ID extraction.
    *   **Orchestrator:** Routes requests to the appropriate plugin adapter.
    *   **Taxation Service:** Dedicated module for tax calculation and compliance checks.
*   **Plugin Containers:**
    *   Can be separate microservices (for isolation) or shared libraries (for performance).
    *   *Decision:* Start with shared libraries (Strategy Pattern) within the same process for Phase 1, moving to gRPC microservices for Phase 2+.
*   **Database (PostgreSQL):** Stores core data (Users, Tenants) and domain data (JSONB or separate schemas).

## 4. Taxation Module Component Design
The Taxation Module is designed as a self-contained service with the following internal components:

*   **Request Handler:** Validates input payloads and authenticates requests.
*   **Nexus Engine:** Determines if tax is applicable based on "Origin" and "Destination" addresses and Tenant Nexus configuration.
*   **Rules Engine:** The core logic processor.
    *   *Inputs:* Transaction Date, Product Code, Jurisdiction.
    *   *Process:* Queries the `Tax Rules Repository` (cached) to find matching rates and logic.
    *   *Logic:* Handles thresholds, caps, and tiered rates.
*   **Master Data Repository:** Stores:
    *   `TaxJurisdictions` (Country, State, County, City, Special Zone).
    *   `TaxRates` (Standard, Reduced, Zero, Exempt) with Effective Dates.
    *   `ProductTaxabilityRules` (Mapping of Categories to Rates).
*   **External Connector Adapter:** Interface for third-party providers (Avalara, Vertex, Sovos) or Government APIs. Used for real-time address validation and filing.
*   **Audit Logger:** Asynchronously writes every calculation event to an immutable `TaxAuditLog` table.

## 5. API Specification (Taxation Module)

### 5.1 Public APIs

#### `POST /api/v1/tax/calculate`
Calculates tax for a potential transaction (Quote/Cart stage).
*   **Request:**
    ```json
    {
      "transaction_date": "2023-10-27T10:00:00Z",
      "customer_id": "cust_123",
      "origin_address": { ... },
      "destination_address": { ... },
      "items": [
        { "sku": "ITEM-001", "amount": 100.00, "tax_code": "P001" }
      ]
    }
    ```
*   **Response:**
    ```json
    {
      "total_tax": 15.00,
      "breakdown": [
        { "jurisdiction": "NY State", "rate": 0.04, "amount": 4.00 },
        { "jurisdiction": "NYC City", "rate": 0.045, "amount": 4.50 }
      ]
    }
    ```

#### `POST /api/v1/tax/commit`
Finalizes tax liability (Invoice stage). Persists the transaction to the Audit Log.
*   **Request:** Same as `/calculate` but with `invoice_id`.
*   **Response:** `transaction_id` (for audit).

### 5.2 Internal Configuration APIs

#### `PUT /api/v1/tax/rules/{rule_id}`
Updates a tax rule.
*   **Request:**
    ```json
    {
      "rate": 0.21,
      "effective_from": "2024-01-01",
      "description": "VAT Rate Increase 2024"
    }
    ```

#### `POST /api/v1/tax/exemptions`
Uploads a customer exemption certificate.

## 6. Technology Stack
*   **Frontend:** React, TypeScript, Tailwind CSS, Shadcn UI.
*   **Backend:** Node.js (Supabase Edge Functions) or Go for high-performance services.
*   **Database:** PostgreSQL (Supabase) with Row Level Security (RLS).
*   **Messaging:** Redis (for caching) and RabbitMQ/Kafka (for async fulfillment events).
*   **API Gateway:** Kong or Nginx.
*   **Infrastructure:** Docker, Kubernetes (K8s).

## 5. Data Flow Diagrams (DFD)

### Cross-Domain Quotation Process
1.  **Request:** User submits `POST /api/v1/quote` with `tenant_id` header.
2.  **Auth:** Gateway validates JWT and extracts `tenant_id`.
3.  **Resolution:** Core Service looks up `Tenant Configuration` to identify the active `Domain Plugin` (e.g., Logistics).
4.  **Delegation:** Core Service invokes `LogisticsPlugin.generateQuote(payload)`.
5.  **Execution:** Plugin executes business logic (e.g., distance calc * rate).
6.  **Response:** Plugin returns standardized `Quote` object.
7.  **Persist:** Core saves metadata; Plugin saves domain details (JSONB).

## 6. Key Design Decisions

### 6.1 Plugin Mechanism
*   **Choice:** **Strategy Pattern with Dependency Injection**.
*   **Justification:** Allows swapping implementations at runtime based on context. For the initial phase, simpler than OSGi and faster than separate microservices.
*   **Alternative:** **gRPC Plugins** (HashiCorp go-plugin style) - reserved for high-scale isolation needs later.

### 6.2 Communication Protocol
*   **Choice:** **REST over HTTP/2** (internal) or **gRPC**.
*   **Justification:** REST is easier for initial web integration; gRPC provides type safety and performance for inter-service communication.

### 6.3 State Management
*   **Choice:** **Stateless Services**.
*   **Justification:** Essential for horizontal scaling. All state is externalized to Redis/Postgres.

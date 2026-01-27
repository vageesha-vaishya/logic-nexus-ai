# Low-Level Design (LLD) Document

## 1. Module/Class Diagrams

### Core Interfaces
```typescript
interface IQuotationEngine {
  calculate(context: RequestContext, items: LineItem[]): Promise<QuoteResult>;
  validate(context: RequestContext): ValidationResult;
}

interface IFulfillmentOrchestrator {
  initiate(orderId: string): Promise<FulfillmentPlan>;
  cancel(orderId: string): Promise<boolean>;
}
```

### Domain Implementations
```typescript
class LogisticsQuotationAdapter implements IQuotationEngine {
  calculate(context, items) {
    // Logistics specific logic
    // 1. Calculate Volumetric Weight
    // 2. Query Carrier Rates
    // 3. Apply Fuel Surcharge
    return quote;
  }
}

class BankingQuotationAdapter implements IQuotationEngine {
  calculate(context, items) {
    // Banking specific logic
    // 1. Fetch Credit Score
    // 2. Determine Risk Tier
    // 3. Calculate Interest Rate
    return quote;
  }
}
```

## 2. Database Schema Design

### Strategy: Row-Level Tenancy (Shared Database, Shared Schema)
Using a discriminator column `tenant_id` is efficient for PaaS where many small tenants exist.

### Core Tables
*   **`tenants`**
    *   `id` (UUID, PK)
    *   `name` (String)
    *   `domain_type` (Enum: LOGISTICS, BANKING, etc.)
    *   `config` (JSONB) - Stores feature flags.

*   **`quotations`**
    *   `id` (UUID, PK)
    *   `tenant_id` (UUID, FK)
    *   `total_amount` (Decimal)
    *   `status` (Enum)
    *   `domain_data` (JSONB) - Stores domain-specific fields (e.g., `flight_number` for Airlines, `interest_rate` for Banking).

*   **`fulfillment_orders`**
    *   `id` (UUID, PK)
    *   `tenant_id` (UUID, FK)
    *   `current_stage` (String)
    *   `history` (JSONB)

## 3. API Specifications (RESTful)

### Quotation Service
*   **POST** `/api/v1/quotes`
    *   **Headers:** `X-Tenant-ID: <uuid>`
    *   **Body:**
        ```json
        {
          "items": [...],
          "attributes": { "weight": 10, "origin": "NYC" } // Dynamic based on domain
        }
        ```
    *   **Response:** `201 Created`
        ```json
        {
          "quote_id": "123",
          "amount": 100.00,
          "breakdown": {...}
        }
        ```

## 4. Sequence Diagrams

### Scenario: Generate Quote for Logistics
1.  **Client** sends request with `X-Tenant-ID`.
2.  **API Layer** resolves `Tenant` -> `Domain=LOGISTICS`.
3.  **Factory** instantiates/retrieves `LogisticsAdapter`.
4.  **Adapter** calls `CarrierService` (External).
5.  **Adapter** applies markup rules.
6.  **API Layer** returns response.

### Scenario: Initiate Fulfillment for Banking
1.  **Client** approves Loan Quote.
2.  **API Layer** resolves `Tenant` -> `Domain=BANKING`.
3.  **Orchestrator** loads `BankingWorkflow` (State Machine).
4.  **Workflow** triggers `Underwriting` step.
5.  **System** updates status to `PROCESSING`.

## 5. Configuration Management (YAML)
Example `tenant-config.yaml`:
```yaml
tenant_id: "uuid-1234"
domain: "LOGISTICS"
features:
  enable_tracking: true
  allow_partial_shipment: false
rules:
  markup_percentage: 15
  carriers: ["UPS", "FedEx"]
```

## 6. Error Handling & Logging
*   **Standard Error Format:**
    ```json
    {
      "code": "ERR_DOMAIN_VALIDATION",
      "message": "Weight exceeds maximum limit",
      "trace_id": "abc-123"
    }
    ```
*   **Logging:** Use structured logging (Winston/Pino) including `tenant_id`, `domain`, and `correlation_id` in every log entry.

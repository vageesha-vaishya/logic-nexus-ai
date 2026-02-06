# Enterprise Quotation System: Technical Specifications (v3.0)

**Related Roadmap:** `docs/Quote/ENTERPRISE_QUOTATION_SYSTEM_ANALYSIS_AND_ROADMAP.md`
**Version:** 3.0 (Global Logistics Command Center)
**Target System:** Logic Nexus AI - Quotation Module

## 1. Detailed Change Log

### 1.1. Database Schema Enhancements
| Action | Object | Details |
| :--- | :--- | :--- |
| **Create** | `public.margin_rules` | Dynamic pricing logic (`min_margin`, `customer_tier`, `service_type`, `risk_factor`). |
| **Create** | `public.compliance_checks` | Audit log for Hazmat/OFAC checks (`check_type`, `status`, `raw_response`). |
| **Create** | `public.cargo_simulations` | Stores 3D load plans (`container_id`, `utilization_percent`, `3d_model_json`). |
| **Alter** | `public.cargo_details` | Add `hazmat_details` (JSONB) to store UN#, Packing Group, Flash Point, MSDS URL. |
| **Alter** | `public.quotation_versions` | Add `approval_status`, `predicted_margin`, `co2_total_kg`. |

### 1.2. API & RPC Layer
| Function | Type | Description |
| :--- | :--- | :--- |
| `calculate_dynamic_margin` | RPC | Inputs: `cost`, `customer_id`, `lane_risk`. Outputs: `sell_price`, `applied_rule_id`. |
| `predict_rate_trend` | Edge Function | Inputs: `origin`, `destination`, `mode`. Outputs: `trend` (+/- %), `confidence`. |
| `validate_hazmat_compatibility` | Edge Function | Checks IMDG segregation rules for mixed cargo. |

### 1.3. User Interface Components
| Component | Status | Description |
| :--- | :--- | :--- |
| `SharedCargoInput.tsx` | **New** | Unified input for Quick/Detailed quotes. Supports FCL/LCL/Breakbulk + Hazmat. |
| `HazmatWizard.tsx` | **New** | Modal flow for entering Dangerous Goods details. |
| `ThreeDLoadPlanner.tsx` | **New** | WebGL canvas (react-three-fiber) visualizing box stacking. |
| `DynamicMarginWidget.tsx` | **New** | Admin UI to configure margin rules. |

---

## 2. Technical Specifications

### 2.1. Dynamic Margin Engine (DME)
**Concept**: Pricing is a function of Risk, Relationship, and Market Volatility.

**Schema Definition (`margin_rules`)**:
```sql
create table margin_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenants(id),
  name text not null,
  priority int default 0,
  condition_json jsonb, -- e.g. {"customer_tier": "gold", "lane_volatility": "high"}
  action_type text, -- 'markup_percent', 'markup_fixed', 'target_margin'
  action_value numeric,
  is_active boolean default true
);
```

### 2.2. Unified Cargo Model (The "Digital Twin")
**Problem**: Disconnect between "Sales Data" (Text) and "Operations Data" (Physics).
**Solution**: `SharedCargoInput` outputs a physics-ready JSON structure.

```typescript
interface CargoItem {
  id: string;
  type: 'loose' | 'container' | 'unit';
  quantity: number;
  dimensions: { l: number, w: number, h: number, unit: 'cm' | 'in' };
  weight: { value: number, unit: 'kg' | 'lb' };
  stackable: boolean;
  hazmat?: {
    unNumber: string; // '1263'
    class: string; // '3'
    packingGroup: 'I' | 'II' | 'III';
    flashPoint?: { value: number, unit: 'C' | 'F' };
  };
}
```

### 2.3. Predictive Rate AI
**Architecture**:
1.  **Ingest**: Historical rates + External Indices (Drewry/Freightos API) -> Vector DB.
2.  **Model**: Simple Moving Average (SMA) + Seasonality adjustment.
3.  **Output**: "Rate Trend: +5% in 7 days. Recommendation: Book Now."

## 3. Validation & Quality Assurance

### 3.1. Performance Metrics
*   **Pricing Calculation**: < 150ms (optimized RPC).
*   **3D Render Time**: < 800ms for < 1000 boxes.
*   **Compliance Check**: < 500ms (Edge Function).

### 3.2. Security Protocols
*   **RLS**: Sales Reps cannot see `margin_rules` or `base_cost` if `blind_pricing` is enabled.
*   **Audit**: Every "Override" of a predicted rate is logged in `compliance_checks`.

### 3.3. Testing Strategy
*   **Unit Tests**: Validate Hazmat segregation logic (e.g., Class 1 + Class 3 = Error).
*   **Integration Tests**: End-to-end "Draft -> Approval -> Sent" flow.

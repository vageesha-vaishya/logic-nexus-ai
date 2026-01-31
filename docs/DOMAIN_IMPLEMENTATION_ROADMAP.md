# Domain-Agnostic Architecture Implementation Roadmap

## 1. Executive Summary
This document outlines the comprehensive analysis and implementation plan for transitioning the Logic Nexus AI platform to a fully domain-agnostic architecture. The goal is to support multiple business domains (Logistics, Banking, Trading, Insurance, Telecom, Real Estate, E-commerce, Customs) with a unified core platform while allowing for domain-specific logic and user experiences.

## 2. Current State Analysis
*   **Database**: The `platform_domains` table is populated with 8 core domains. Relationships are defined via `domain_relationships`.
*   **Backend Logic**: `LogisticsPlugin` is the core. New plugins for `Banking`, `Trading`, `Insurance`, `Customs`, `Telecom`, `Real Estate`, `Ecommerce` have been scaffolded and registered.
*   **Frontend**: UI components often have hardcoded "Logistics" labels or logic. Navigation is static.
*   **API**: `DomainService` exists but needs to drive application logic.

## 3. Impact Assessment

### 3.1 Database Layer
*   **Status**: Ready.
*   **Impact**: `platform_domains` is the source of truth.
*   **Action**: Ensure all foreign keys in other tables (e.g., `quotations`, `shipments`) reference `platform_domains` where applicable.

### 3.2 API & Backend Layer
*   **Status**: In Progress.
*   **Impact**: The `PluginRegistry` is the critical integration point.
*   **Action**:
    *   Refactor `initializePlugins` to dynamic loading or structured registration. (Completed)
    *   Create base `IPlugin` implementations for new domains. (Completed)
    *   Expose domain metadata via public API for frontend consumption.

### 3.3 Frontend Layer
*   **Status**: Needs Refactoring.
*   **Impact**: The application needs to be "Domain Aware".
*   **Action**:
    *   Implement `DomainContextProvider` to hold the active domain state.
    *   Create `DomainSwitcher` component for global navigation.
    *   Refactor `DashboardLayout` to adapt sidebar/menu based on the active domain.
    *   Implement `DomainGuard` for route protection.

## 4. Industry Verticals & Enhancement Plans

### 4.1 Logistics (Core)
*   **Current State**: Fully functional quotation engine and rate mapping.
*   **Enhancements**:
    *   **Performance**: Optimize `LogisticsRateMapper` with O(1) lookup maps instead of linear searches.
    *   **Security**: Implement strict input validation for `incoterms` and `service_type` in API endpoints.
    *   **Features**: Integration with Carbon Footprint Calculator APIs and Real-time Container Tracking (IoT).

### 4.2 Telecommunications
*   **Functional Focus**: Bandwidth provisioning, 5G infrastructure, SLA management.
*   **Technical Specs**:
    *   **Fields**: `service_type` (Fiber, 5G), `bandwidth` (Mbps/Gbps), `contract_duration`.
    *   **Integrations**: Coverage Map APIs, Provisioning Gateways.
    *   **Roadmap**: Implement `TelecomQuotationEngine` with volume-based pricing logic.

### 4.3 Real Estate
*   **Functional Focus**: Property management, virtual tours, tenant services.
*   **Technical Specs**:
    *   **Fields**: `property_type` (Res/Comm), `area_sqft`, `location`, `listing_type`.
    *   **Integrations**: Virtual Tour Providers (Matterport API), MLS Data Feeds.
    *   **Roadmap**: Develop Lease Calculator and Virtual Tour embedding support.

### 4.4 E-commerce
*   **Functional Focus**: Inventory sync, order fulfillment, multi-channel support.
*   **Technical Specs**:
    *   **Fields**: `platform` (Shopify, Magento), `sku_count`, `fulfillment_model` (3PL, Dropship).
    *   **Integrations**: Shopify/WooCommerce Webhooks, Inventory Management Systems (IMS).
    *   **Roadmap**: Build Inventory Sync Engine and Profit Margin Calculator.

## 5. Implementation Roadmap

### Phase 1: Foundation (Completed)
*   ✅ Establish `platform_domains` schema.
*   ✅ Seed initial domain data (Logistics, Banking, Trading, Insurance, Customs).
*   ✅ Seed extended domain data (Telecom, Real Estate, E-commerce).
*   ✅ Implement synchronization scripts (`sync_domains.js`).

### Phase 2: Backend Enablement (Completed)
*   ✅ **Scaffold Plugins**: Created plugins for all 8 domains.
*   ✅ **Register Plugins**: Updated `src/plugins/init.ts` to register all plugins.

### Phase 3: Frontend Integration (Immediate)
*   [ ] **Domain Context**: Create `src/contexts/DomainContext.tsx`.
*   [ ] **Global Switcher**: Add domain selector to the top navigation bar.
*   [ ] **Dynamic Routing**: Update `App.tsx` to wrap domain-specific routes with `DomainGuard`.

### Phase 4: Domain-Specific Features (Ongoing)
*   [ ] **Quotation Engines**: Implement real logic for non-logistics domains.
*   [ ] **Logistics Optimization**: Refactor Rate Mapper for performance.
*   [ ] **Custom Forms**: Create domain-specific form configurations.

## 6. Technical Specifications

### 6.1 Database Schema Updates
No further schema changes required for `platform_domains`.
Future: Add `config` JSONB column to `platform_domains` to store UI preferences.

### 6.2 API Contracts
**GET /api/domains**
*   Returns list of active domains.
*   Response: `[{ code: "LOGISTICS", name: "Logistics", features: [...] }, ...]`

### 6.3 UI Component: DomainContext
```typescript
interface DomainContextType {
  currentDomain: PlatformDomain | null;
  setDomain: (code: string) => void;
  availableDomains: PlatformDomain[];
}
```

### 6.4 Integration: Plugin Architecture
Each domain must implement the `IPlugin` interface:
```typescript
export interface IPlugin {
  id: string;
  name: string;
  domainCode: string; // e.g., 'LOGISTICS', 'BANKING'
  routes: RouteObject[];
  getQuotationEngine(): IQuotationEngine | undefined;
}
```

## 7. Migration Strategy
1.  **Zero-Downtime**: The `platform_domains` table is additive.
2.  **Rollout**:
    *   Deploy DB changes (Done).
    *   Deploy Backend Plugin scaffolding (Done).
    *   Deploy UI Domain Switcher (Hidden behind feature flag or restricted to Super Admin initially).
3.  **Fallback**: If a domain plugin fails to load, the system falls back to a "Core" mode with limited functionality.

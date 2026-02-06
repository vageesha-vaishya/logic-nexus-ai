# Comprehensive Strategic Analysis & Enhancement Plan
## Logic Nexus AI: Enterprise Multi-Domain CRM Platform
## Platform Hierarchy: Super Admin → Multi-Tenant → Multi-Franchise

**Document Version:** 1.0
**Date:** February 6, 2026
**Author:** Technical Analysis Team
**Status:** In Progress
**Classification:** Internal Strategic Document

---

## Executive Summary

This comprehensive analysis provides a complete assessment of the Logic Nexus AI platform, covering architecture, business workflows, competitive positioning, technical roadmap, and production readiness. The platform operates as an enterprise-grade SaaS/PaaS solution with a strict three-tier hierarchy: **Super Admin (Platform Owner: SOS Services) → Multi-Tenant (Companies) → Multi-Franchise (Locations)**.

**Key Focus Areas:**
1. **Technical Debt Resolution**: Address code maintainability issues blocking development velocity
2. **Hierarchy Enforcement**: Ensure strict data isolation across Super Admin → Tenant → Franchise
3. **Feature Gap Analysis**: Identify missing capabilities vs. industry leaders (Cargowise, Magaya, Salesforce)
4. **End-to-End Workflow Enhancement**: Optimize complete customer lifecycle (Lead → Cash)
5. **Domain Expansion**: Prepare architecture for multi-vertical platform (Logistics, Banking, Telecom, etc.)

**Critical Findings Summary:**
- ✅ **Strengths**: Multi-domain plugin architecture, established hierarchy foundation, comprehensive workflow coverage
- ⚠️ **Technical Debt**: Quote system maintainability, data model inconsistencies, testing gaps, performance bottlenecks
- 🔴 **Critical Gaps**: Incomplete hierarchy enforcement, missing RLS policies, cross-franchise data leakage risks
- 🎯 **Priority**: Phase 1 must address code maintainability and hierarchy enforcement before expanding features

---

## Table of Contents

**Section 1: Architecture Assessment & Hierarchy Implementation** _(Pages 1-25)_
- 1.1 Platform Hierarchy Architecture
- 1.2 Current Codebase Structure
- 1.3 Database Architecture & Tenant Isolation
- 1.4 Plugin System Design Patterns
- 1.5 Multi-Tenant Access Control Analysis

**Section 2: Complete Business Workflow Analysis** _(Pages 26-100)_
- 2.A Pre-Quotation (CRM) Workflows
  - 2.A.1 Lead Management System
  - 2.A.2 Tasks & Activities Management
  - 2.A.3 Opportunities Tracking & Pipeline
  - 2.A.4 Account Management
  - 2.A.5 Contacts Management
  - 2.A.6 Email Infrastructure & Management
- 2.B Post-Quotation (Operations) Workflows
  - 2.B.1 Quotation System
  - 2.B.2 Booking System
  - 2.B.3 Shipment Management
  - 2.B.4 Fulfillment & Execution
  - 2.B.5 Invoicing System
  - 2.B.6 Billing & Revenue Recognition
  - 2.B.7 Financial Accounting Integration
  - 2.B.8 AES Filing & Compliance
  - 2.B.9 Reporting Dashboard & KANBAN

**Section 3: Logistics Domain Feature Inventory** _(Pages 101-110)_

**Section 4: Multi-Domain Capability Gap Analysis** _(Pages 111-125)_

**Section 5: Competitive Benchmarking** _(Pages 126-160)_

**Section 6: Technical Enhancement Roadmap** _(Pages 161-185)_

**Section 7: Implementation Specifications** _(Pages 186-215)_

**Section 8: Quality Assurance Framework** _(Pages 216-230)_

**Section 9: Production Readiness Checklist** _(Pages 231-245)_

**Appendices** _(Pages 246-260)_

---

# Section 1: Architecture Assessment & Hierarchy Implementation

## 1.1 Platform Hierarchy Architecture

### 1.1.1 Hierarchy Model Overview

The Logic Nexus AI platform implements a strict three-tier hierarchical architecture designed to support enterprise-scale multi-tenancy with franchise operations:

```
┌─────────────────────────────────────────────────────────────┐
│  SUPER ADMIN (Platform Owner: SOS Services)                 │
│  ─────────────────────────────────────────────────────────  │
│  Role: platform_admin                                        │
│  Capabilities:                                               │
│    • Global platform management and configuration            │
│    • Visibility across ALL tenants and franchises            │
│    • Platform-wide analytics and reporting                   │
│    • Tenant provisioning and lifecycle management            │
│    • System-wide settings and feature flags                  │
│    • Security audit and compliance oversight                 │
│  Scope Override: Can impersonate tenant/franchise context    │
└──────────────────────────┬───────────────────────────────────┘
                           │
        ┌──────────────────┴───────────────────┬─────────────┐
        ▼                                      ▼             ▼
┌────────────────────┐              ┌────────────────────┐  ┌─────────────┐
│  TENANT A          │              │  TENANT B          │  │  TENANT C   │
│  (Company/Org)     │              │  (Company/Org)     │  │  (Company)  │
│  ─────────────────  │              │  ─────────────────  │  │  ─────────  │
│  Role: tenant_admin │              │  Role: tenant_admin │  │  tenant_admin│
│  Capabilities:      │              │  Capabilities:      │  │             │
│    • Tenant-wide    │              │    • Tenant-wide    │  │             │
│      visibility     │              │      visibility     │  │             │
│    • All franchises │              │    • All franchises │  │             │
│    • Settings mgmt  │              │    • Settings mgmt  │  │             │
│    • User roles     │              │    • User roles     │  │             │
│    • Consolidated   │              │    • Consolidated   │  │             │
│      reporting      │              │      reporting      │  │             │
└────────┬────────────┘              └────────┬────────────┘  └──────┬──────┘
         │                                    │                      │
    ┌────┴────┬────┬────┐              ┌──────┴─────┐         ┌─────┴──────┐
    ▼         ▼    ▼    ▼              ▼            ▼         ▼            ▼
┌────────┐ ┌────┐ ┌────┐ ┌────┐    ┌────────┐  ┌────────┐ ┌────────┐ ┌────────┐
│FR-NYC │ │FR-LA│ │FR-CHI│ │FR-MIA│    │FR-LON  │  │FR-PAR  │ │FR-DEL  │ │FR-MUM  │
│────────│ │────│ │────│ │────│    │────────│  │────────│ │────────│ │────────│
│Role:   │ │    │ │    │ │    │    │Role:   │  │        │ │Role:   │ │        │
│franchise│ │    │ │    │ │    │    │franchise│  │        │ │franchise│ │        │
│_admin  │ │    │ │    │ │    │    │_admin  │  │        │ │_admin  │ │        │
│────────│ │────│ │────│ │────│    │────────│  │────────│ │────────│ │────────│
│Caps:   │ │    │ │    │ │    │    │Caps:   │  │        │ │Caps:   │ │        │
│• Local │ │    │ │    │ │    │    │• Local │  │        │ │• Local │ │        │
│  ops   │ │    │ │    │ │    │    │  ops   │  │        │  ops   │ │        │
│• Branch│ │    │ │    │ │    │    │• Branch│  │        │• Branch│ │        │
│  users │ │    │ │    │ │    │    │  users │  │        │  users │ │        │
│• Local │ │    │ │    │ │    │    │• Local │  │        │• Local │ │        │
│  data  │ │    │ │    │ │    │    │  data  │  │        │  data  │ │        │
└────────┘ └────┘ └────┘ └────┘    └────────┘  └────────┘ └────────┘ └────────┘
```

**Hierarchy Principles:**

1. **Strict Data Isolation**: Each level can ONLY access data within its scope
2. **Cascading Permissions**: Permissions flow top-down (Super Admin > Tenant > Franchise)
3. **Aggregated Reporting**: Analytics roll up bottom-to-top (Franchise → Tenant → Platform)
4. **No Cross-Tenant Leakage**: Tenants are completely isolated from each other
5. **Franchise Autonomy with Oversight**: Franchises operate independently but Tenant Admin has full visibility

### 1.1.2 Database Schema for Hierarchy

The platform hierarchy is implemented in the database through a normalized schema:

**Core Hierarchy Tables:**

```sql
-- 1. Tenants (Companies/Organizations using the platform)
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  logo_url TEXT,
  domain TEXT,
  settings JSONB DEFAULT '{}'::jsonb,
  subscription_tier TEXT DEFAULT 'free',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Franchises (Locations/Branches within a Tenant)
CREATE TABLE public.franchises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  address JSONB DEFAULT '{}'::jsonb,
  manager_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT fk_tenant FOREIGN KEY (tenant_id) REFERENCES public.tenants(id)
);

-- 3. User Roles (Assigns users to hierarchy levels with specific roles)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL, -- 'platform_admin' | 'tenant_admin' | 'franchise_admin' | 'user'
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  franchise_id UUID REFERENCES public.franchises(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role, tenant_id, franchise_id)
);
```

**Hierarchy Column Pattern:**

Every tenant-scoped table in the platform MUST include:
- `tenant_id UUID NOT NULL REFERENCES public.tenants(id)`
- `franchise_id UUID REFERENCES public.franchises(id)` (nullable for HQ/tenant-level data)

**Current Schema Coverage:**

✅ **Tables with Full Hierarchy Columns** (tenant_id + franchise_id):
- accounts
- contacts
- leads
- opportunities
- activities
- quotes
- shipments
- invoices
- user_roles
- vendors
- customs_documents
- tracking_events

⚠️ **Tables Missing Hierarchy Columns** (Technical Debt Identified):
- segment_members (missing tenant_id - fixed in migration 20240111)
- email_templates (missing franchise_id - global templates only)
- rate_sheets (global vs. tenant-specific unclear)
- Some audit/log tables (intentionally global)

🔴 **Critical Gap**: ~15-20 tables need audit for hierarchy column completeness

### 1.1.3 Row-Level Security (RLS) Implementation

The platform enforces hierarchy through PostgreSQL Row-Level Security (RLS) policies. All policies follow a standard pattern:

**Standard RLS Policy Pattern:**

```sql
-- Example: Accounts table RLS policy
CREATE POLICY "Users can view franchise accounts" ON public.accounts
    FOR SELECT
    USING (
        -- Step 1: User must belong to same tenant
        tenant_id = public.get_user_tenant_id(auth.uid())
        AND (
            -- Step 2: Handle HQ users (NULL franchise_id) vs. Franchise users
            (public.get_user_franchise_id(auth.uid()) IS NULL AND franchise_id IS NULL)
            OR
            franchise_id = public.get_user_franchise_id(auth.uid())
        )
    );
```

**RLS Policy Hierarchy Logic:**

| User Role | tenant_id Filter | franchise_id Filter | Result |
|-----------|------------------|---------------------|---------|
| **Platform Admin** (no override) | NONE | NONE | Sees ALL data globally |
| **Platform Admin** (override enabled) | = selected tenant | = selected franchise (if set) | Sees specific tenant/franchise |
| **Tenant Admin** | = user's tenant | = selected franchise (if set) OR NULL | Sees all franchises in tenant |
| **Franchise Admin** | = user's tenant | = user's franchise | Sees only their franchise |
| **User** | = user's tenant | = user's franchise | Sees only their franchise |

**Current RLS Policy Status:**

✅ **Tables with Correct RLS Policies** (confirmed in migrations 20260211150000, 20260211160000):
- accounts
- contacts
- leads
- opportunities
- quotes
- shipments
- invoices
- activities

⚠️ **Tables with Loose/Missing RLS Policies**:
- Some configuration tables (intentionally permissive)
- Legacy tables from pre-hierarchy implementation
- Tables relying on JOIN-based RLS (performance concern)

🔴 **Critical Issues Identified:**
1. **segment_members** table lacked direct tenant_id column, relied on join-based RLS (fixed)
2. **AdminScopeSwitcher** had race condition causing filter bypass (fixed)
3. **HQ Users** (franchise_id = NULL) unable to see HQ-level data (fixed in migration 20260211150000)

### 1.1.4 ScopedDataAccess Implementation

The frontend enforces hierarchy through the `ScopedDataAccess` class (src/lib/db/access.ts), which automatically injects tenant_id/franchise_id filters into all database queries:

**Architecture:**

```typescript
export interface DataAccessContext {
  tenantId?: string | null;
  franchiseId?: string | null;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isFranchiseAdmin: boolean;
  userId?: string;
  adminOverrideEnabled?: boolean; // Platform Admin scope override
}

export class ScopedDataAccess {
  constructor(
    private supabase: SupabaseClient<Database>,
    private context: DataAccessContext
  ) {}

  from(table: TableName, isGlobal: boolean = false) {
    // Returns a query builder that automatically applies scope filters
  }
}
```

**Scoping Logic:**

```typescript
// Platform Admin without override: See everything
if (context.isPlatformAdmin && !context.adminOverrideEnabled) {
  return query; // No filters
}

// Platform Admin with override enabled
if (context.isPlatformAdmin && context.adminOverrideEnabled) {
  if (context.tenantId) query = query.eq('tenant_id', context.tenantId);
  if (context.franchiseId) query = query.eq('franchise_id', context.franchiseId);
  return query;
}

// Tenant Admin: Scope to tenant, optionally filter by franchise
if (context.isTenantAdmin && context.tenantId) {
  query = query.eq('tenant_id', context.tenantId);
  if (context.franchiseId) {
    query = query.eq('franchise_id', context.franchiseId); // Optional drill-down
  }
}

// Franchise Admin: Strict scoping to franchise
if (context.isFranchiseAdmin) {
  if (context.tenantId) query = query.eq('tenant_id', context.tenantId);
  if (context.franchiseId) query = query.eq('franchise_id', context.franchiseId);
}
```

**Automatic Scope Injection:**

```typescript
// INSERT operations automatically inject tenant_id/franchise_id
from('leads').insert({ name: 'New Lead' })
// Becomes: { name: 'New Lead', tenant_id: 'abc...', franchise_id: 'xyz...' }
```

**Current Implementation Status:**

✅ **Strengths:**
- Centralized scoping logic
- Automatic tenant_id/franchise_id injection on INSERTs
- Support for Platform Admin scope override
- Global table exceptions (ports_locations)

⚠️ **Identified Issues:**
- Some components bypass ScopedDataAccess and call Supabase directly
- Inconsistent usage across codebase (technical debt)
- Race conditions in AdminScopeSwitcher (fixed)
- No automated testing for scope enforcement

🔴 **Critical Gaps:**
- ~30% of components don't use ScopedDataAccess
- Direct Supabase client usage in services layer
- No compile-time enforcement of scoping

### 1.1.5 Hierarchy Enforcement Gaps & Technical Debt

**Database Layer Gaps:**

| Issue | Severity | Impact | Status |
|-------|----------|---------|---------|
| Tables missing tenant_id/franchise_id columns | 🔴 HIGH | Data leakage risk | Partially Fixed |
| Inconsistent RLS policies across tables | 🟡 MEDIUM | Security gaps | In Progress |
| JOIN-based RLS (performance issue) | 🟡 MEDIUM | Query performance | Fixed (segment_members) |
| Missing foreign key constraints for hierarchy | 🟡 MEDIUM | Data integrity | Needs Audit |
| HQ Users (franchise_id = NULL) unable to access HQ data | 🔴 HIGH | Functionality broken | Fixed |

**Application Layer Gaps:**

| Issue | Severity | Impact | Status |
|-------|----------|---------|---------|
| Components bypassing ScopedDataAccess | 🔴 HIGH | Direct data leakage | Not Fixed |
| Inconsistent scope injection across services | 🟡 MEDIUM | Data isolation risks | Not Fixed |
| AdminScopeSwitcher race condition | 🔴 HIGH | Filter bypass | Fixed |
| No scope validation in API layer | 🔴 HIGH | Security vulnerability | Not Fixed |
| RPCs don't enforce hierarchy automatically | 🟡 MEDIUM | Manual scoping required | Not Fixed |

**Testing Gaps:**

| Gap | Impact | Priority |
|-----|--------|----------|
| No automated multi-tenant isolation tests | 🔴 HIGH | Can't detect regressions | P0 |
| No cross-franchise data leakage tests | 🔴 HIGH | Security risk | P0 |
| No hierarchy permission inheritance tests | 🟡 MEDIUM | Permission bugs | P1 |
| No Platform Admin override tests | 🟡 MEDIUM | Admin UX issues | P1 |

**Performance Issues:**

| Issue | Impact | Priority |
|-------|--------|----------|
| Hierarchical queries slow at scale (10K+ franchises) | 🟡 MEDIUM | User experience | P1 |
| No indexes on tenant_id/franchise_id combinations | 🟡 MEDIUM | Query performance | P1 |
| RLS policy complexity causes query planner issues | 🟡 MEDIUM | Database load | P2 |

### 1.1.6 Hierarchy Enhancement Recommendations

**Phase 1: Critical Fixes (Weeks 1-4)**

1. **Database Schema Audit**
   - Action: Audit ALL tables for tenant_id/franchise_id columns
   - Deliverable: Complete table inventory with hierarchy column status
   - Priority: P0

2. **RLS Policy Standardization**
   - Action: Create RLS policy generator script
   - Deliverable: Consistent RLS policies across all tenant-scoped tables
   - Priority: P0

3. **ScopedDataAccess Enforcement**
   - Action: Audit all components, replace direct Supabase calls
   - Deliverable: 100% ScopedDataAccess usage
   - Priority: P0

4. **Hierarchy Testing Framework**
   - Action: Build multi-tenant isolation test suite
   - Deliverable: Automated tests for data leakage prevention
   - Priority: P0

**Phase 2: Hardening (Weeks 5-12)**

5. **API Layer Scope Validation**
   - Action: Implement middleware for hierarchy validation
   - Deliverable: Centralized scope enforcement at API boundary
   - Priority: P1

6. **Performance Optimization**
   - Action: Add indexes, optimize RLS policies
   - Deliverable: Sub-100ms query times at 10K+ franchise scale
   - Priority: P1

7. **Hierarchy-Aware RPC Functions**
   - Action: Refactor RPCs to use tenant_id/franchise_id parameters
   - Deliverable: Automatic scoping for all stored procedures
   - Priority: P1

**Phase 3: Advanced Features (Weeks 13-16)**

8. **Hierarchy Analytics Dashboard**
   - Action: Build platform-wide hierarchy health monitoring
   - Deliverable: Real-time hierarchy metrics and alerts
   - Priority: P2

9. **Cross-Franchise Collaboration Features**
   - Action: Implement controlled data sharing between franchises
   - Deliverable: Franchise-to-franchise transfer workflows
   - Priority: P2

10. **Hierarchy-Aware Caching**
    - Action: Implement tenant/franchise-scoped caching layer
    - Deliverable: Improved performance without breaking isolation
    - Priority: P2

---

## 1.2 Current Codebase Structure

### 1.2.1 Technology Stack

**Frontend:**
- **Framework**: React 18.3.1 with TypeScript 5.8.3
- **Build Tool**: Vite 5.4.19
- **UI Library**: Radix UI + shadcn/ui components
- **Styling**: Tailwind CSS 3.4.17
- **State Management**: React Query (@tanstack/react-query 5.83.0)
- **Routing**: React Router DOM 6.30.1
- **Form Handling**: React Hook Form 7.61.1 + Zod 3.25.76 validation

**Backend:**
- **Database**: PostgreSQL (via Supabase)
- **BaaS**: Supabase 2.72.8 (Authentication, RLS, Storage, Edge Functions)
- **API Architecture**: RESTful + RPC (Supabase functions)
- **Edge Functions**: Deno runtime for serverless functions

**Development & Testing:**
- **Testing**: Vitest 4.0.16 + Testing Library + Playwright 1.57.0
- **Linting**: ESLint 9.32.0 + TypeScript ESLint
- **CI/CD**: (Not documented in package.json)
- **Monitoring**: Sentry (@sentry/react 10.32.1) + PostHog (posthog-js 1.313.0)

### 1.2.2 Folder Structure

```
logic-nexus-ai/
├── src/
│   ├── components/          # React components (organized by domain)
│   │   ├── finance/
│   │   ├── logistics/      # Shipment, Port, Cargo components
│   │   ├── sales/          # Quote, QuickQuote, MultiModalQuote
│   │   │   ├── common/
│   │   │   ├── composer/
│   │   │   ├── quick-quote/
│   │   │   ├── quote-form/
│   │   │   └── shared/
│   │   └── ...
│   ├── pages/               # Page-level components
│   │   └── dashboard/      # Dashboard pages
│   ├── plugins/             # Domain-specific plugins
│   │   ├── banking/
│   │   ├── customs/
│   │   ├── ecommerce/
│   │   ├── insurance/
│   │   ├── logistics/       # Core plugin (fully implemented)
│   │   ├── real_estate/
│   │   ├── telecom/
│   │   ├── trading/
│   │   └── init.ts          # Plugin registry initialization
│   ├── services/            # Business logic services
│   │   ├── plugins/
│   │   ├── pricing.service.ts
│   │   ├── quotation/       # Quotation engines
│   │   │   ├── engines/
│   │   │   └── IQuotationEngine.ts
│   │   └── ...
│   ├── lib/                 # Utility libraries
│   │   ├── db/             # ScopedDataAccess, access control
│   │   ├── schemas/        # Zod validation schemas
│   │   ├── logger.ts
│   │   └── ...
│   ├── hooks/               # React custom hooks
│   ├── integrations/        # External integrations
│   │   └── supabase/       # Supabase client, types
│   ├── config/              # Configuration
│   │   └── navigation.ts   # Menu structure
│   └── types/               # TypeScript type definitions
├── supabase/
│   ├── migrations/          # Database migrations (280+ files)
│   ├── functions/           # Edge functions (AI advisor, rate engine)
│   └── seeds/              # Seed data scripts
├── scripts/                 # Utility scripts (100+ files)
├── docs/                    # Documentation
│   ├── plans/              # Design documents
│   ├── Quote/              # Quotation system docs
│   ├── System/             # Architecture, operations docs
│   └── ...
└── tests/                   # Test files

```

### 1.2.3 Architecture Pattern Analysis

**Current Pattern: Hybrid Monolith + Plugin Architecture**

The codebase exhibits characteristics of:
1. **Frontend Monolith**: Single React application with all domains
2. **Plugin System**: Domain-specific logic encapsulated in plugins
3. **Service Layer**: Business logic in services (pricing, quotation)
4. **BaaS (Backend-as-a-Service)**: Supabase handles database, auth, storage

**Pattern Strengths:**
✅ Rapid development with Supabase
✅ Plugin system enables domain modularity
✅ TypeScript provides type safety
✅ React Query handles caching and state

**Pattern Weaknesses:**
⚠️ Monolithic frontend bundle size
⚠️ Tight coupling between components
⚠️ No clear separation of concerns in services
⚠️ Plugin architecture not fully leveraged (only Logistics implemented)

### 1.2.4 Code Maintainability Assessment

**Component Organization:**

| Area | Status | Issues |
|------|---------|---------|
| **Quote System** | 🔴 POOR | Duplicate logic across QuickQuote, QuoteForm, MultiModalComposer; tight coupling |
| **Data Fetching** | 🟡 FAIR | Inconsistent React Query usage; duplicate hooks; no standard patterns |
| **Access Control** | 🟡 FAIR | ScopedDataAccess exists but not consistently used; components bypass it |
| **Plugin System** | 🟡 FAIR | Good design but only Logistics implemented; other plugins are stubs |
| **Shared Components** | ✅ GOOD | Radix UI + shadcn/ui provides consistency |

**Technical Debt Hotspots:**

1. **Quote System (Critical)**
   - **Files Affected**: 20+ components in `src/components/sales/`
   - **Issues**:
     - `QuoteForm.tsx` (DELETED) vs. `QuoteFormRefactored.tsx` (duplication)
     - `QuickQuoteModal.tsx` has embedded business logic
     - `MultiModalQuoteComposer.tsx` duplicates rate mapping logic
     - No shared quotation state management
     - Quote-to-shipment conversion logic scattered
   - **Impact**: Every quote feature requires changes in 5+ files
   - **Estimated Effort**: 3-4 weeks to refactor

2. **Data Fetching Patterns**
   - **Issues**:
     - Duplicate hooks (`useQuoteData`, `useQuoteHydration`, `useQuoteRepository`)
     - Inconsistent error handling
     - No standard loading state patterns
     - Direct Supabase calls mixed with React Query
   - **Impact**: Hard to maintain, optimize, or test data layer
   - **Estimated Effort**: 2-3 weeks to standardize

3. **Multi-Tenant Access Control**
   - **Issues**:
     - ~30% of components bypass `ScopedDataAccess`
     - Inconsistent tenant/franchise filtering
     - No compile-time enforcement
     - Race conditions in scope switcher (fixed)
   - **Impact**: Data leakage risks, security vulnerabilities
   - **Estimated Effort**: 2-3 weeks to enforce

### 1.2.5 Dependency Analysis

**Critical Dependencies:**

| Package | Version | Purpose | Risk |
|---------|---------|---------|------|
| React | 18.3.1 | Frontend framework | ✅ Stable |
| Supabase | 2.72.8 | Backend platform | ⚠️ Major version updates |
| React Query | 5.83.0 | Data fetching | ✅ Stable |
| Zod | 3.25.76 | Validation | ✅ Stable |
| TypeScript | 5.8.3 | Type safety | ✅ Stable |

**Dependency Risks:**
- Supabase frequent breaking changes in major versions
- Large bundle size (need code splitting)
- No dependency update automation

---


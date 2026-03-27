# AMRO Integration - Quick Reference Guide
## Executive Summary for Technical Leads

**Date:** March 26, 2026
**Status:** Architecture Phase - Ready for Implementation Planning

---

## 📋 KEY DELIVERABLES

### 1. **AMRO Technical Architecture Design** (5 pages)
- **Location:** `/docs/AMRO_Technical_Architecture_Design.md`
- **Covers:** Core ATA/MSG-3 data model, applicability engine, WCF logic, enterprise constraints
- **Audience:** Architects, database engineers

### 2. **Comprehensive Architecture & Integration Guide** (40 pages)
- **Location:** `/docs/AMRO_Comprehensive_Architecture_Integration_Guide.md`
- **Covers:** Integration with existing logic-nexus-ai, gap analysis, implementation roadmap, compliance checklist
- **Audience:** Technical leads, engineering teams

---

## 🎯 INTEGRATION SUMMARY

### Current Platform Baseline
```
✓ React 18 + TypeScript + shadcn/ui (200+ components ready)
✓ Supabase PostgreSQL + Row-Level Security (multi-tenancy proven)
✓ API middleware chain (auth, rate limit, scope resolution)
✓ React Query for state management
✓ TailwindCSS for styling
✓ Audit logging + digital signatures (existing)
```

### AMRO Additions Required
```
✗ ATA Code Hierarchy (recursive table)
✗ Maintenance Tasks (3000+ task library)
✗ Task Intervals (polymorphic: hours/months/cycles)
✗ Aircraft-Task Linking (realized maintenance schedule)
✗ Work Package Management (extended from quotation)
✗ Applicability Engine (JSON rules + PostgreSQL function)
✗ Digital Signature/Sign-Off (enhanced)
✗ Compliance Reporting (FAA/EASA formats)
✗ Technician Skill Management
✗ Service Bulletin Tracking
```

---

## 📊 GAP ANALYSIS AT A GLANCE

### Top 5 International MRO Benchmark

| System | Multi-Tenancy | ATA/MSG-3 | Applicability | Work Packages | Mobile | Compliance |
|--------|---|---|---|---|---|---|
| **SAP Aviation** | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓ | ✓✓ |
| **AMOS** | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| **Trax** | ✓✓ | ✓✓ | ✓ | ✓✓ | ✓✓ | ✓✓ |
| **Ramco** | ✓✓ | ✓✓ | ✓✓ | ✓✓ | ✓ | ✓ |
| **IFS** | ✓✓ | ✓✓ | ✓ | ✓✓ | ✗ | ✓✓ |
| **Logic Pro (Current)** | ✓ (partial) | ✗ | ✗ | ✗ (partial) | ✓ (responsive) | ✗ |

---

## 💡 KEY ARCHITECTURAL DECISIONS

### 1. Multi-Tenancy Pattern (100% Reuse)
```
✓ Inherit existing tenant_id + franchise_id model
✓ Use proven RLS policies + ScopedDataAccess
✓ Master MPD (franchise_id = NULL) accessible by all franchises in tenant
✓ Fleet MPD (franchise_id = X) scoped to specific franchise
```

### 2. API Gateway (Proven Pattern)
```
✓ Use existing middleware chain: CORS → Auth → RateLimit → Scope → Business Logic
✓ Route: /api/v2/amro/* (14 new endpoints)
✓ Same error handling, response formatting, audit logging
```

### 3. Component Reuse (40% Code Savings)
```
✓ Forms: 100% reuse of React Hook Form + shadcn/ui
✓ Tables: 100% reuse of TanStack React Table
✓ Dialogs: 100% reuse of shadcn/ui Dialog
✓ Charts: 100% reuse of Recharts
✓ New components: ~5 (digital signature, offline sync indicator, timer widget)
```

### 4. Database Schema (Non-Breaking)
```
✓ Add 20 new AMRO tables (separate from existing)
✓ Extend aircraft table with 3 new columns (current_flight_hours, etc.)
✓ Enable RLS policies (no existing data affected)
✓ All tables include tenant_id + franchise_id for isolation
```

### 5. Service Layer (Service-Driven)
```
✓ Create 6 AMRO service classes (follow quotation service pattern):
  - AtaCodeService
  - MaintenanceTaskService
  - AircraftMaintenanceService
  - WorkPackageService
  - ComplianceReportingService
  - SkillCertificationService

✓ Each service validates scope before DB access (defense-in-depth)
✓ Services return typed payloads (TypeScript interfaces)
```

---

## 📈 IMPLEMENTATION ROADMAP (18 months)

### Phase 0: Groundwork (Months 1-2) - 20 PD
```
✓ Database schema migration
✓ PostgreSQL functions (is_task_applicable, calculate_next_due, etc.)
✓ API endpoints skeleton (14 endpoints)
✓ Component library setup
✓ Service classes infrastructure
```

### Phase 1: Core AMRO (Months 3-6) - 42 PD
```
✓ ATA hierarchy + master MPD import
✓ Aircraft onboarding + auto-populate
✓ Work package creation + basic execution
✓ Maintenance scheduling (calendar view)
✓ Field technician UI (mobile-responsive)
✓ Basic compliance reporting (FAA/EASA export templates)
✓ Digital signature integration
✓ Multi-tenancy enforcement + audit logging
```

### Phase 2: Enterprise Features (Months 7-12) - 40 PD
```
✓ Advanced scheduling (Gantt, conflict detection)
✓ Technician skill management + certification validation
✓ Parts/inventory integration
✓ Offline capability + sync
✓ Regulatory database integration (FAA/EASA live sync)
✓ Predictive analytics
```

### Phase 3: Integrations & Optimization (Months 13-18) - 30 PD
```
✓ ERP integration (SAP/NetSuite)
✓ Supplier portal
✓ Customer portal
✓ Mobile app (iOS/Android native)
✓ Performance optimization
✓ Machine learning for scheduling
```

---

## 🔢 EFFORT ESTIMATES

| Component | Effort (PD) | Priority | Phase |
|-----------|-------------|----------|-------|
| **Database Schema** | 3 | P0 | 0 |
| **PostgreSQL Functions** | 8 | P0 | 0 |
| **API Endpoints (14)** | 10 | P0 | 0-1 |
| **Service Classes (6)** | 8 | P0 | 0-1 |
| **Master MPD Import** | 5 | P0 | 1 |
| **Aircraft Onboarding** | 6 | P0 | 1 |
| **Work Package Management** | 10 | P0 | 1 |
| **Field Technician UI** | 12 | P0 | 1 |
| **Compliance Reporting** | 8 | P1 | 1 |
| **Mobile Offline Sync** | 10 | P1 | 2 |
| **Technician Skills** | 6 | P1 | 2 |
| **Advanced Scheduling** | 12 | P2 | 2 |
| **ERP Integration** | 8 | P2 | 3 |
| **Performance Optimization** | 10 | P2 | 3 |
| **Testing (Unit/Int/E2E)** | 35 | Ongoing | All |
| **Documentation & Training** | 10 | Ongoing | All |
| **Total (18 months)** | **132 PD** | - | - |

---

## 🏗️ REUSE STRATEGY

### Existing Components (90% Reuse)
```typescript
// From logic-nexus-ai - use directly in AMRO modules

// Authentication
import { useCRM } from '@/hooks/useCRM';  // Multi-tenant context
import { useAuth } from '@/hooks/useAuth';  // JWT + roles

// UI Components
import { Button, Dialog, Form, Table, Card, Badge } from '@/components/ui';  // 200+ available
import { LocationAutocomplete } from '@/components/common';  // Pattern reference

// Data Fetching
import { useQuery, useMutation } from '@tanstack/react-query';  // React Query
import { DataAccessContext, ScopedDataAccess } from '@/lib/db/access';  // Scope management

// Styling
import { clsx } from 'clsx';  // TailwindCSS + merge utility
```

### New Components (5 Required)
```typescript
// Digital Signature Pad (custom canvas-based)
src/components/amro/DigitalSignaturePad.tsx

// Offline Indicator (service worker status)
src/components/amro/OfflineSyncIndicator.tsx

// Work Timer Widget (elapsed hours tracking)
src/components/amro/WorkTimerWidget.tsx

// Applicability Rule Editor (JSON viewer/editor)
src/components/amro/ApplicabilityRuleEditor.tsx

// Compliance Status Timeline (Recharts wrapper)
src/components/amro/ComplianceTimeline.tsx
```

---

## 🚀 ZERO-DOWNTIME DEPLOYMENT PLAN

```
Timeline: ~45 minutes, no user impact

T+0:00  Deploy code (new endpoints, services, components)
        Old code paths still handle all requests
        New AMRO endpoints return 404 (feature flag off)

T+0:05  Run background migration: Create AMRO tables
        PostgreSQL non-blocking DDL (doesn't lock existing tables)
        audit_logs and aircraft unaffected

T+0:15  Run RLS policies, indexes, stored procedures
        Still non-blocking, no locks on existing data

T+0:20  Health check: Test new endpoints (internal only)
        If issues: Revert code, no data rollback needed

T+0:35  Enable feature flag: isAmroPhase(1) = true
        AMRO UI appears for beta tenants
        Existing quotation/CRM modules unaffected

T+1:00  Monitor error rates, performance metrics
        Automated rollback if error threshold exceeded

T+2:00  If green: Rollout to all tenants
        If issues: Revert code (data tables remain for future rollout)
```

---

## ✅ COMPLIANCE CHECKLIST

### Standards Alignment
- [x] ATA iSpec 2200 - Hierarchical task structure, applicability rules
- [x] MSG-3 Logic - Preventive maintenance, failure-driven, on-condition
- [x] FAA Part 43 - Maintenance records, audit trail
- [x] FAA Part 337 - Major repairs/alterations export format
- [x] EASA Part-M - Continuing airworthiness, 7-year retention
- [x] EASA Part-66 - Technician certifications

### Security Requirements
- [x] Multi-tenancy isolation (RLS policies)
- [x] Encryption in transit (TLS)
- [x] Encryption at rest (Supabase default)
- [x] Row-level security (PostgreSQL)
- [x] Audit logging (all mutations captured)
- [x] Emergency user blocking (admin feature)
- [x] Rate limiting (100 req/min, 40 mutations/min)
- [ ] Field-level encryption (Phase 2)
- [ ] Digital signature legal compliance (Phase 1)

### Data Retention
- [x] 7-year audit trail requirement
- [x] Immutable compliance reports (WORM storage)
- [x] Version control for task definitions (superseded_by_id)
- [x] Service bulletin embodiment tracking

---

## 📚 DOCUMENT NAVIGATION

**For Different Audiences:**

**Architects & Decision Makers:**
→ Read: Executive Summary (this page) + Section 2 (Integration) + Section 7 (Migration)

**Database Engineers:**
→ Read: Section 2.3 (Schema) + Appendix A (Complete DDL) + Section 5 (Testing)

**Frontend Developers:**
→ Read: Section 2.4 (Components) + Section 6 (Component Reuse) + API specs (Appendix B)

**Backend/API Engineers:**
→ Read: Section 2.1 (API Integration) + Section 2.5 (Services) + Appendix B (Endpoints)

**QA/Testing Team:**
→ Read: Section 5.4 (Testing Strategy) + Appendix D (Testing Guide) + Compliance Checklist

**Operations/DevOps:**
→ Read: Section 7 (Migration & Rollout) + Blue-Green Deployment Plan + Feature Flags

---

## 🎯 SUCCESS METRICS (Phase 1 Launch)

| Metric | Target | How Measured |
|--------|--------|--------------|
| **API Response Time** | <500ms for next-due calculation | New Relic APM |
| **Master MPD Import** | <5 seconds for 3000-task library | Timing logs |
| **Multi-Tenancy Isolation** | 0 cross-tenant data leaks | Integration tests |
| **Applicability Accuracy** | 99.9% match vs. manual verification | Test cases |
| **Audit Trail Completeness** | 100% of mutations logged | Audit query validation |
| **Mobile Responsiveness** | Functional on tablets (iPad, Android) | Playwright mobile tests |
| **Test Coverage** | 85%+ code coverage | Jest/Vitest reports |
| **Deployment Downtime** | <5 minutes | Blue-green monitoring |

---

## 📞 NEXT STEPS

1. **Week 1:** Architecture review + approval
2. **Week 2-3:** Database schema finalization
3. **Week 4:** Phase 1 implementation kickoff
4. **Month 4-5:** Beta testing with pilot tenants
5. **Month 6:** Production rollout

**Questions?**
- Architecture: Contact technical lead
- Database: Contact DBA
- Implementation: Contact engineering manager
- Compliance: Contact legal/compliance officer

---

**Document Version:** 1.0
**Last Updated:** March 26, 2026
**Status:** Ready for Implementation Planning
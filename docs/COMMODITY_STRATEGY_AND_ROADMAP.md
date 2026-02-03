# Commodity Strategy & Implementation Roadmap

**Date:** 2026-02-03
**Based on:** `docs/COMMODITY_COMPETITIVE_ANALYSIS.md`
**Status:** Strategic Plan

## 1. Executive Summary & Competitive Analysis

A comprehensive review of the "Commodity Competitive Analysis" document and the current Logic Nexus AI codebase reveals a platform in transition from "Basic Logistics" to "Enterprise Compliance".

### Key Insights & Market Positioning
*   **The "Compliance Moat":** Competitors like Cargowise dominate through deep compliance (30+ customs integrations). To compete, Logic Nexus cannot just be a "CRM"; it must be a "Compliance Engine".
*   **UX as a Differentiator:** Flexport wins on UX ("Smart Search"). Logic Nexus has an opportunity to beat Cargowise's legacy UI by combining Enterprise Depth with Consumer-Grade UX (Visual Browsers, AI Suggestions).
*   **The "Global" Gap:** The current architecture is heavily US-centric (AES/HTS). Enterprise clients operate globally. Transitioning to a WCO-based Global HS model is the single most critical architectural shift required.

### Competitive Advantages (Target State)
1.  **Hybrid Agility:** Unlike Cargowise (rigid, complex) or Freightos (simple, shallow), Logic Nexus targets the "Mid-Market Enterprise" sweet spot: Deep compliance features wrapped in a modern, fast UI.
2.  **Unified Data Model:** By linking `master_commodities` directly to `aes_hts_codes` and `duty_rates`, we eliminate the data redundancy plaguing legacy systems.

## 2. Gap Analysis & Current State Validation

We performed a deep-dive code audit to validate the "Gaps" identified in the strategic document.

| Feature Domain | Document Claim | Codebase Reality (Feb 2026) | Status |
| :--- | :--- | :--- | :--- |
| **Duty Calculation** | "None" (Critical) | **Implemented** (Phase 2). `calculate_duty` RPC supports MPF/HMF. `duty_rates` table exists. | ✅ **Advanced** (Ahead of Doc) |
| **Compliance** | "Basic HTS Validation" | **Partial**. `compliance_screenings` table and `perform_rps_screening` exist, but rely on local lists, not live Gov APIs. | ⚠️ **Partial** |
| **Product Catalog** | "Just Added" | **Basic**. `master_commodities` exists but lacks Enterprise Approval Workflows (Draft/Approved) and Document Attachments. | ⚠️ **Basic** |
| **Multi-Country** | "US-Centric" | **Confirmed**. System relies entirely on `aes_hts_codes` (US). No structure for EU/CN codes. | 🔴 **Critical Gap** |
| **Integration** | "None" | **Confirmed**. No ACE/EDI integration. | 🔴 **Critical Gap** |

## 3. Implementation Opportunities

Based on the audit, we have identified three high-impact implementation opportunities:

1.  **Enterprise Catalog Hardening (Immediate Win):**
    *   Upgrade `master_commodities` from a simple list to a governed "Master Data" module.
    *   **Tasks:** Add Approval Workflow (Draft -> Pending -> Approved), Audit History, and Document Storage (MSDS, Tech Specs).
    *   **Competitive Win:** Matches Cargowise's governance but with better UX.

2.  **Visual HTS Browser (UX Differentiator):**
    *   Implement the "Drill-down tree view" mentioned in the roadmap.
    *   **Tasks:** Build a UI that navigates the `chapter` -> `heading` -> `subheading` hierarchy created in Phase 2.
    *   **Competitive Win:** Beats Cargowise's "Code-only" search; matches Flexport's usability.

3.  **Global HS Architecture (Strategic Pivot):**
    *   Refactor the HTS engine to support multi-country tariffs.
    *   **Tasks:** Create `global_hs_roots` (WCO 6-digit) and link `aes_hts_codes` as a US-specific child.
    *   **Competitive Win:** Unlocks Global-to-Global shipments, essential for Enterprise clients.

## 4. Detailed Implementation Roadmap

### Phase 2.5: Enterprise Catalog & UX (Immediate)
*Focus: Polishing the existing "Basic" implementation into "Enterprise Grade".*

#### 4.1 Advanced Product Catalog
- [ ] **Schema Update:** Add `status` (Draft, Pending, Approved), `approved_by`, `approved_at` to `master_commodities`.
- [ ] **UI Implementation:** "Commodity Approval Queue" for Managers.
- [ ] **Documents:** Add "Attachments" tab to Commodity Detail (link to `storage.objects`).

#### 4.2 Visual HTS Browser
- [ ] **API:** Create `get_hts_hierarchy` RPC (Chapter -> Heading drill-down).
- [ ] **UI:** Implement `HTSTreeBrowser` component with lazy-loading branches.
- [ ] **Integration:** Embed into `SmartCargoInput` as "Browse" mode.

### Phase 3: Globalization (Q2 2026)
*Focus: Breaking the US-centric dependency.*

#### 4.3 Global HS Data Model
- [ ] **Schema:** Create `global_hs_roots` (6-digit WCO standard).
- [ ] **Migration:** Extract first 6 digits of `aes_hts_codes` to populate `global_hs_roots`.
- [ ] **Refactor:** Make `aes_hts_codes` a polymorphic child of `global_hs_roots` (US Extension).

### Phase 4: Intelligence & Integration (Q3 2026)
*Focus: Automation and External Connectivity.*

#### 4.4 Automated Compliance
- [ ] **Integration:** Connect `perform_rps_screening` to a live 3rd-party API (Descartes/Amber Road).
- [ ] **AI:** Implement "Smart Classify" using vector search on `master_commodities` descriptions.

## 5. Success Metrics

| Metric | Current Baseline | Target (Phase 2.5) | Target (Phase 3) |
| :--- | :--- | :--- | :--- |
| **Classification Speed** | 2 mins/item | < 30 sec/item (Visual Browser) | < 5 sec/item (AI) |
| **Compliance Rate** | Unknown | 100% of Commodities have `aes_hts_id` | 100% Screened against RPS |
| **Global Coverage** | US Only (100%) | US Only (100%) | US, EU, CN, DE |
| **Catalog Governance** | 0% Approved | 100% of Active SKUs Approved | - |


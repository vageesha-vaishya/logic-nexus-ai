# Phase 3 Roadmap: Vendor Performance Analytics & Contract Lifecycle Management (CLM)

## Overview
Phase 3 transitions the Vendor Management module from a "System of Record" (Phase 1 & 2) to a "System of Intelligence". The primary goals are to automate performance tracking and streamline complex contract negotiations.

## Key Objectives
1.  **Automated Performance Scoring**: Calculate vendor scores based on real operational data (Shipments, Quality Claims).
2.  **Advanced CLM**: Enable redlining, clause libraries, and digital signatures.
3.  **Vendor Portal**: Launch a secure external interface for suppliers.

## Detailed Feature Specifications

### 1. Vendor Performance Scorecard (VPS)
**Concept**: A dynamic 0-100 score updated nightly.

#### Metrics & Weighting (Configurable)
-   **On-Time Delivery (40%)**:
    -   Source: `shipments` table.
    -   Logic: `(Count(actual_delivery <= expected_delivery) / Total Shipments) * 100`.
-   **Quality Compliance (30%)**:
    -   Source: `quality_claims` table (New).
    -   Logic: `100 - (Claim Value / Total Spend * 100)`.
-   **Cost Competitiveness (20%)**:
    -   Source: `freight_quotes` vs `market_index` (Future integration).
-   **Responsiveness (10%)**:
    -   Source: `vendor_portal_activity` (Avg. time to view PO).

#### Implementation Plan
1.  Create `vendor_performance_metrics` table (daily snapshot).
2.  Develop `calculate-vendor-score` Edge Function (Nightly Cron).
3.  Visualize trend lines in `VendorDetail` > Performance Tab.

### 2. Advanced Contract Lifecycle Management (CLM)
**Concept**: End-to-end contract negotiation within the platform.

#### Features
-   **Clause Library**: Pre-approved legal text blocks stored in `contract_clauses`.
-   **Redlining**:
    -   Integration with Google Docs API or Office 365 for collaborative editing.
    -   Track changes and comments as `contract_comments`.
-   **eSignature**:
    -   Integrate DocuSign / Adobe Sign API.
    -   Map signature status to `onboarding_status`.

### 3. Vendor Portal (External App)
**Concept**: A separate lightweight React app or a sub-route protected by "Vendor" role.

#### Capabilities
-   **Dashboard**: View Open POs, Pending RFIs.
-   **Document Upload**: Self-service certificate renewal.
-   **Dispute Resolution**: Open tickets for payment issues.

## Technical Architecture Changes
-   **Database**:
    -   New tables: `quality_claims`, `contract_clauses`, `vendor_users`.
-   **Auth**:
    -   Implement "External User" role in Supabase Auth.
-   **API**:
    -   Secure RPCs for external access (strict RLS).

## Execution Timeline (Estimated 6 Weeks)
-   **Week 1-2**: Database Schema & Performance Logic (VPS).
-   **Week 3-4**: CLM Backend & Clause Library.
-   **Week 5**: eSignature Integration.
-   **Week 6**: Frontend Dashboards & Testing.

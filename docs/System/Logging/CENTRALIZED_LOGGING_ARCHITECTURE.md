---
title: Centralized Logging & Monitoring System Architecture
version: 2.0.0
date: 2026-01-31
author: Logic Nexus AI Engineering
status: Approved
compliance: GDPR, HIPAA, SOC 2
---

# Centralized Logging & Monitoring System Architecture

## 1. Executive Summary

This document defines the comprehensive architectural specifications and phase-wise implementation strategy for the Logic Nexus AI Centralized Logging and Monitoring System. It establishes a roadmap for building an enterprise-grade observability platform that ensures end-to-end visibility, regulatory compliance (GDPR, HIPAA, SOC 2), and operational excellence. The system leverages a hybrid architecture utilizing client-side buffering, Supabase for scalable storage, and Edge Functions for real-time processing, designed to scale from thousands to millions of daily log events.

## 2. Architectural Specifications

### 2.1 Technology Stack & Components

| Layer | Component | Technology | Rationale |
| :--- | :--- | :--- | :--- |
| **Capture** | Client SDK | React / TypeScript | Type-safe instrumentation, non-blocking buffering. |
| **Capture** | Edge Middleware | Deno / Node.js | Low-latency request interception and correlation. |
| **Transport** | API Gateway | Supabase Edge Functions | Secure, authenticated ingress for log data. |
| **Storage** | Primary Store | PostgreSQL (Supabase) | Relational integrity, JSONB support, Row Level Security. |
| **Storage** | Archive Store | AWS S3 / Supabase Storage | Long-term cold storage for compliance retention. |
| **Processing** | Stream Processor | PostgreSQL Triggers / Edge Functions | Real-time event handling without heavy infrastructure. |
| **Visualization** | Admin Dashboard | React / Recharts | Integrated, customizable UI within the main application. |

### 2.2 Scalability & Performance Requirements

*   **Throughput**: Support 50+ log entries/second initially, scalable to 1000+ eps.
*   **Latency**: Logging operations must add < 5ms to request latency.
*   **Storage**: Partitioning strategy to handle 100GB+ of log data annually.
*   **Concurrency**: Support 10,000+ concurrent user sessions generating telemetry.

### 2.3 Security & Compliance Standards

*   **GDPR**: Implementation of "Right to Erasure" via user_id indexing and automated purge workflows.
*   **HIPAA**: Strict PII/PHI masking (regex-based scrubbing) before data leaves the client. Encryption at rest (AES-256) and in transit (TLS 1.3).
*   **SOC 2**: Immutable audit trails for all system access and configuration changes.

---

## 3. Phase-Wise Implementation Roadmap

### Phase 1: Foundation & Core Logging (Weeks 1-4)
**Objective**: Establish the basic infrastructure for capturing and storing structured logs.

*   **Milestones**:
    1.  [x] Database Schema Design (`system_logs` table with partitioning).
        *   *Note*: Implemented via `20260131130000_fix_logging_partitioning.sql` using Native Postgres Range Partitioning.
    2.  [x] `LoggerService` Client SDK implementation (Singleton, buffering, transport).
    3.  [x] Server-side Middleware for Edge Functions (`serveWithLogger` in `_shared/logger.ts`).
    4.  [x] Basic PII Masking implementation (Regex-based scrubbing).
*   **Deliverables**: Working `LoggerService`, SQL Migrations, Basic Documentation.
*   **Success Metrics**: 100% of critical errors captured; <1% log loss during transport.

### Phase 2: Aggregation & Visualization (Weeks 5-8)
**Objective**: Enable developers and admins to view and analyze logs effectively.

*   **Milestones**:
    1.  [x] Admin Dashboard UI (`SystemLogs.tsx`) with filtering, search, and Trace ID display.
    2.  [x] Structured Metadata expansion (Geo, Device, Performance metrics) via Client SDK.
    3.  [x] Log Rotation & Archival Automation (`cleanup-logs` Edge Function wrapping `cleanup_system_logs`).
    4.  [x] Correlation ID propagation across Client -> Edge -> DB (`src/lib/functions.ts` wrapper).
*   **Deliverables**: deployed Log Viewer, Retention Policies active.
*   **Success Metrics**: Sub-second search response for queries < 24 hours old.

### Phase 3: Alerting & Intelligence (Weeks 9-12)
**Objective**: Proactive monitoring and real-time incident response.

*   **Milestones**:
    1.  [x] Real-time Alerting Engine (`alert-notifier` Edge Function).
        *   *Channels*: Slack (Webhook), Email (Resend).
        *   *Triggers*: `CRITICAL` log level.
    2.  [x] Integration with Slack/PagerDuty (Slack Webhook implemented).
    3.  [x] Anomaly Detection (Spike in error rates).
        *   `anomaly-detector` Edge Function checks for >10 errors/5min.
        *   Triggers `alert-notifier` on violation.
    4.  [ ] Automated Health Checks & Heartbeat monitoring.
*   **Deliverables**: Active Alerting System, Incident Response Runbooks.
*   **Success Metrics**: MTTD (Mean Time to Detect) < 5 minutes for critical issues.

### Phase 4: Analytics, Reporting & Enterprise Scale (Weeks 13+)
**Objective**: Visualizing trends, generating reports, and hardening for regulated industries.

*   **Milestones**:
    1.  [x] Advanced Log Analytics Visualization (Charts for Volume, Levels, Components).
        *   Implemented via `SystemLogs.tsx` Analytics Tab and `get_system_log_stats` RPC.
    2.  [x] Automated Report Generation (CSV Export).
    3.  [ ] Advanced Compliance Audits (HIPAA/SOC 2 verification).
    4.  [ ] Cold Storage Archival to S3 (7-year retention).
    5.  [ ] Distributed Tracing Visualization (Waterfall charts).
*   **Deliverables**: Analytics Dashboard, Compliance Reports, Disaster Recovery Drills.
*   **Success Metrics**: 99.99% System Availability, Zero Compliance Violations.

---

## 4. Implementation Specifications

### 4.1 Data Taxonomy & Schema

```typescript
interface LogEntry {
  level: 'TRACE' | 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  timestamp: string;        // ISO 8601
  correlation_id: string;   // Trace ID
  component: string;        // e.g., 'Auth', 'Billing'
  environment: string;      // 'prod', 'staging'
  user_id?: string;         // Masked/Hashed for privacy
  tenant_id?: string;
  metadata: {
    http?: { method: string; url: string; status: number; duration: number };
    error?: { name: string; message: string; stack: string };
    context?: Record<string, any>;
  };
}
```

### 4.2 Integration Protocols

*   **Client-Side**:
    *   Initialize `LoggerService` at app bootstrap.
    *   Wrap critical flows in `try/catch` blocks utilizing `logger.error`.
    *   Use `ErrorBoundary` components to catch React render errors.
*   **Server-Side**:
    *   Middleware must extract `X-Correlation-ID` header or generate new one.
    *   All DB queries > 1s must be logged as `WARNING`.

---

## 5. Resource Allocation & Risk Management

### 5.1 Resource Plan
*   **Personnel**:
    *   1 Lead Architect (Architecture & Security)
    *   2 Full-Stack Developers (Implementation & UI)
    *   1 DevOps Engineer (Infrastructure & Automation)
*   **Infrastructure**:
    *   Supabase Pro Plan (for Database size & Edge Functions).
    *   External Monitoring Service (e.g., UptimeRobot) for external health checks.

### 5.2 Risk Mitigation

| Risk | Probability | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Database Saturation** | Medium | High | Implement aggressive log rotation (7 days hot); Batch writes; Move to partitions. |
| **PII Leakage** | Low | Critical | Strict Regex masking in Client SDK; Code reviews for logging statements; Periodic audits. |
| **Alert Fatigue** | High | Medium | Tunable thresholds; Deduplication of alerts; "Snooze" functionality. |
| **Performance Impact** | Medium | Medium | Async/Non-blocking transport; Circuit breakers to disable logging under load. |

---

## 6. Operational Procedures & Runbooks

### 6.1 Deployment Strategy
*   **Staging**: Deploy new logging configurations to Staging first. Verify log flow and alert triggers.
*   **Production**: Rolling deployment. Enable "INFO" level initially, "DEBUG" only on demand via Feature Flag.

### 6.2 Maintenance Guidelines
*   **Daily**: Check `alert-notifier` execution logs for failures.
*   **Weekly**: Review top 10 error categories; Update masking rules if new PII types introduced.
*   **Monthly**: Verify partition creation/dropping; Audit retention policy compliance.

### 6.3 Incident Response (Runbook)
1.  **Trigger**: `CRITICAL` alert received (e.g., "DB Connection Failed").
2.  **Triage**: Check Dashboard > System Logs for recent deployment or config changes.
3.  **Analyze**: Filter by `correlation_id` to trace the transaction path.
4.  **Mitigate**: Rollback recent change or scale resources.
5.  **Post-Mortem**: Document root cause and add new automated alerts/tests.

---

## 7. Success Metrics & KPIs

*   **Coverage**: 100% of API endpoints and UI routes instrumented.
*   **Latency**: Logging overhead < 5ms p99.
*   **Reliability**: 99.9% log delivery success rate.
*   **Utility**: Time-to-resolution (TTR) for production bugs reduced by 40%.
*   **Compliance**: 100% pass rate on quarterly security audits.


# Disaster Recovery Plan (DRP)

**Effective Date:** 2026-01-04
**Version:** 1.0
**Status:** Active

## 1. Introduction
This Disaster Recovery Plan (DRP) outlines the procedures for recovering the Logic Nexus AI system in the event of a catastrophic failure, data loss, or extended outage. The goal is to minimize downtime and data loss (RTO/RPO) and ensure business continuity.

## 2. Recovery Objectives
*   **Recovery Time Objective (RTO):** 4 Hours
    *   The maximum acceptable length of time that the application can be offline.
*   **Recovery Point Objective (RPO):** 1 Hour
    *   The maximum acceptable amount of data loss measured in time.

## 3. Risk Assessment & Scenarios
| Scenario | Likelihood | Impact | Mitigation Strategy |
| :--- | :--- | :--- | :--- |
| **Database Corruption** | Low | Critical | Point-in-Time Recovery (PITR), Daily Backups. |
| **Region Outage** | Low | Critical | Multi-region replication (if enabled), Redeployment to secondary region. |
| **Accidental Data Deletion** | Medium | High | Soft-delete implementation, Restore from backup. |
| **Cyber Attack / Ransomware** | Low | Critical | Security audits, Immutable backups, Access key rotation. |
| **Deployment Failure** | Medium | Medium | Automated rollback (CI/CD), Blue/Green deployment. |

## 4. Backup Strategy
*   **Database (Supabase):**
    *   **Daily Backups:** Automated daily backups retained for 30 days.
    *   **Point-in-Time Recovery (PITR):** Enabled for granular recovery up to the last second (requires Pro plan).
*   **Codebase (GitHub):**
    *   Version controlled with distributed copies on developer machines.
*   **Configuration:**
    *   Environment variables stored securely (Vault/Supabase Secrets), documented in `env.example`.

## 5. Recovery Procedures

### 5.1. Database Restoration
**Trigger:** Data corruption or mass deletion.
**Procedure:**
1.  **Stop Traffic:** Enable "Maintenance Mode" to prevent new writes.
2.  **Verify Timestamp:** Identify the exact time of failure/corruption.
3.  **Initiate Restore:**
    *   Go to Supabase Dashboard -> Database -> Backups.
    *   Select PITR or the most recent healthy Daily Backup.
    *   Restore to a *new* project (recommended) or overwrite existing (if critical).
4.  **Verify Data:** Run integrity checks on the restored database.
5.  **Switch Over:** Update application connection strings (`SUPABASE_URL`) to point to the restored database.
6.  **Resume Traffic:** Disable Maintenance Mode.

### 5.2. Application Redeployment
**Trigger:** Bad deployment or corrupted build artifacts.
**Procedure:**
1.  **Identify Issue:** Check Sentry/Logs for error details.
2.  **Revert Commit:**
    ```bash
    git revert <bad-commit-hash>
    git push origin main
    ```
3.  **Trigger Pipeline:** GitHub Actions will automatically rebuild and deploy the previous stable version.
4.  **Verify Fix:** specific smoke tests on the staging environment.

### 5.3. Full System Recovery (Region Failure)
**Trigger:** Cloud provider region outage.
**Procedure:**
1.  **Spin up New Infrastructure:**
    *   Create new Supabase project in a different region.
    *   Run migration scripts (`supabase db reset --linked`).
    *   Seed initial data (`supabase db seed`).
2.  **Restore Data:** Import latest data dump (if available off-site).
3.  **Redeploy Edge Functions:**
    ```bash
    supabase functions deploy --no-verify-jwt
    ```
4.  **Update DNS:** Point domain to the new frontend/backend endpoints.

## 6. Communication Plan
*   **Internal:** Notify "Critical Response Team" via Slack/PagerDuty immediately.
*   **External:** Update Status Page (e.g., status.logicnexus.ai) within 15 minutes of confirmed outage.
*   **Post-Mortem:** Conduct a review meeting within 48 hours of resolution to analyze root cause and update DRP.

## 7. Testing & Drills
*   **Frequency:** Quarterly.
*   **Scope:** Simulate a database restoration and a bad deployment rollback.
*   **Documentation:** Record results of drills in the "DR Drill Log".

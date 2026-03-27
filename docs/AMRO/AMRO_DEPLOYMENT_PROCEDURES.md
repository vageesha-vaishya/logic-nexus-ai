# AMRO Deployment Procedures Guide
## Production-Ready Checklist & Runbooks

**Document ID:** DEPLOY-AMRO-001
**Version:** 1.0.0
**Date:** 2026-03-19
**Owner:** DevOps & Site Reliability Engineering
**Audience:** DevOps, SRE, Operations, Engineering Leads

---

## Table of Contents

1. [Pre-Deployment Checklist](#1-pre-deployment-checklist)
2. [Deployment Procedures](#2-deployment-procedures)
3. [Post-Deployment Validation](#3-post-deployment-validation)
4. [Rollback Procedures](#4-rollback-procedures)
5. [Monitoring & Alerting](#5-monitoring--alerting)
6. [Incident Response](#6-incident-response)
7. [Runbooks by Scenario](#7-runbooks-by-scenario)

---

## 1. Pre-Deployment Checklist

### 1.1 48 Hours Before Deployment

**[ ] Engineering Lead**
- Review all merged PRs since last release
- Verify no breaking changes to APIs
- Confirm backward compatibility with active API versions

**[ ] Product Manager**
- Confirm feature flags configured correctly
- Verify pilot tenant list for canary deployment
- Review go/no-go criteria

**[ ] Security Team**
- Run static security analysis (SonarQube, snyk)
- Verify no secrets in code or configs
- Confirm authentication bypasses patched

**[ ] DevOps**
- Prepare deployment scripts and rollback scripts
- Test rollback procedure on staging
- Verify feature flag infrastructure ready

**[ ] QA**
- Complete regression testing on staging
- Verify all smoke tests passing
- Confirm UAT sign-off

### 1.2 24 Hours Before Deployment

**[ ] Engineering Lead**
- Final code review of all changes
- Verify CI/CD pipeline green
- Check for any pending hotfixes

**[ ] DevOps**
- Verify database migrations tested on staging
- Run AMRO DB documentation compliance checks (`npm run amro:db-docs:validate` and `npm run amro:db-docs:report`)
- Validate AMRO multi-tenant master data migration 20260325000000 on staging with tenant/franchise fixtures
- Confirm backup snapshot scheduled
- Verify monitoring alerts configured
- Test feature flag toggle on staging

**[ ] Operations**
- Brief on-call team on changes
- Prepare incident response procedures
- Confirm escalation contacts
- Update runbooks if needed

**[ ] SRE**
- Review performance baselines
- Prepare performance monitoring dashboard
- Verify logging and tracing setup
- Confirm Jaeger/ELK stack operational

### 1.3 1 Hour Before Deployment

**[ ] All Teams - Final Go/No-Go**

| Team | Status | Go/No-Go | Sign-Off |
|------|--------|----------|----------|
| Engineering | Code reviewed, tests passing | Go | ☐ Lead |
| DevOps | Scripts tested, rollback ready | Go | ☐ Lead |
| Operations | Team briefed, runbooks ready | Go | ☐ Lead |
| SRE | Monitoring active, alerts configured | Go | ☐ Lead |
| QA | Regression tests passed | Go | ☐ Lead |
| Product | Features flagged, go-live criteria met | Go | ☐ PM |

**Go Criteria (ALL must be Go):**
- ✅ No critical bugs found
- ✅ All tests passing
- ✅ Rollback procedure tested
- ✅ Team briefed and ready
- ✅ Feature flags configured
- ✅ Monitoring active

**No-Go Criteria (ANY trigger halt):**
- ❌ Critical bug found
- ❌ Tests failing
- ❌ Rollback untested
- ❌ Feature flags misconfigured
- ❌ Security issues unresolved

---

## 2. Deployment Procedures

### 2.1 Blue-Green Deployment Architecture

```
┌─────────────────────────────────────────┐
│  Load Balancer (Route 53, ALB)          │
├─────────────────────────────────────────┤
│                                         │
│  BLUE (Production v2.1.5)  ←── 100%   │
│  ├─ 5 pods                             │
│  ├─ Database: Primary (active)          │
│  ├─ Cache: Redis primary                │
│  └─ Users: 15,000 active                │
│                                         │
│  GREEN (New v2.2.0) ←─── 0% (canary)  │
│  ├─ 5 pods (standby)                   │
│  ├─ Database: Replica (read-only)      │
│  ├─ Cache: Redis replica                │
│  └─ Users: 0% (testing)                 │
│                                         │
└─────────────────────────────────────────┘
```

### 2.2 Deployment Stages

#### Stage 1: Deploy GREEN Environment (0-30 min)

**Objective:** Deploy new code alongside production without affecting users

```bash
# 1. Pull code from main branch
git checkout main
git pull origin main

# 2. Run database migrations on GREEN environment (read-only replica)
npm run migrate --env=staging

# 3. Build Docker image
docker build -t amro:v2.2.0 .
docker tag amro:v2.2.0 docker.io/company/amro:v2.2.0
docker push docker.io/company/amro:v2.2.0

# 4. Deploy to GREEN Kubernetes cluster
kubectl apply -f k8s/amro-green-deployment.yaml --context=prod

# 5. Wait for all pods to be ready
kubectl wait --for=condition=Ready pods -l app=amro,env=green --timeout=10m

# 6. Run smoke tests on GREEN (against read-only replica)
npm run test:smoke --env=green
```

Ensure AMRO multi-tenant master data migration `20260325000000_amro_multi_tenant_isolation.sql` is included in the migration run.

**Exit Criteria:**
- [ ] All GREEN pods healthy
- [ ] Database migrations successful
- [ ] Smoke tests passing on GREEN
- [ ] No errors in logs
- [ ] API responses correct

#### Stage 2: Canary Deployment (30-60 min)

**Objective:** Route 1% of production traffic to GREEN, monitor for issues

```bash
# 1. Update load balancer to route 1% traffic to GREEN
kubectl patch svc amro-lb -p \
  '{"spec":{"trafficPolicy":{"canary":{"weight":1}}}}'

# 2. Monitor metrics for 30 minutes
watch -n 10 kubectl top pods -l app=amro
# Watch dashboard: amro-metrics-v2.2.0

# 3. Check error rates (target: <2% increase)
# Check latency p99 (target: <1.1s, within 10% of baseline)
# Check memory usage (target: <500MB per pod)
```

**Monitoring Points (every 5 min for 30 min):**

| Metric | Baseline | Alert Threshold | Action |
|--------|----------|---|---|
| Error Rate | 0.1% | >0.2% | ❌ ROLLBACK |
| p99 Latency | 950ms | >1s | ⚠️ INVESTIGATE |
| p95 Latency | 500ms | >600ms | ⚠️ INVESTIGATE |
| CPU per pod | 30% | >60% | ❌ ROLLBACK |
| Memory per pod | 150MB | >400MB | ❌ ROLLBACK |
| DB connections | 50 | >80 | ⚠️ INVESTIGATE |

**Exit Criteria:**
- [ ] Error rate increase <2%
- [ ] Latency increase <10%
- [ ] No memory leaks detected
- [ ] No critical errors in logs
- [ ] Feature flag working correctly

#### Stage 3: Ramp to 25% (60-90 min)

**Objective:** Gradually increase traffic to identify issues

```bash
# 1. Update traffic split
kubectl patch svc amro-lb -p \
  '{"spec":{"trafficPolicy":{"canary":{"weight":25}}}}'

# 2. Monitor for 30 minutes
watch -n 10 'kubectl top nodes && kubectl logs -l app=amro,env=green --tail=50'

# 3. Check metrics same as canary phase
```

**Exit Criteria:**
- [ ] Same as canary phase (error rate, latency, memory)
- [ ] No new errors appearing
- [ ] Database performance acceptable

#### Stage 4: Ramp to 100% (90-120 min)

**Objective:** Full traffic switch to GREEN

```bash
# 1. Update load balancer to route 100% to GREEN
kubectl patch svc amro-lb -p \
  '{"spec":{"trafficPolicy":{"canary":{"weight":100}}}}'

# 2. Monitor continuously
watch -n 5 'curl -s https://api.amro.company.com/health | jq'

# 3. Check user experience metrics
# - Login success rate >99.5%
# - API response time <1s p99
# - No data inconsistencies
```

**Exit Criteria:**
- [ ] 100% traffic on GREEN
- [ ] Error rates normal
- [ ] Latency normal
- [ ] No user-facing issues

#### Stage 5: Keep BLUE for 24 Hours

**Objective:** Maintain BLUE environment for quick rollback if needed

```bash
# 1. BLUE stays running (standby mode)
# 2. Keep database read-only snapshots
# 3. Monitor both environments for 24 hours
# 4. Verify no data inconsistencies between BLUE and GREEN

# Check for 24 hours:
while true; do
  kubectl describe pod -l app=amro,env=blue
  kubectl logs -l app=amro,env=blue --tail=20
  sleep 3600
done

# 5. If no issues after 24 hours, decommission BLUE
kubectl delete -f k8s/amro-blue-deployment.yaml
```

**Exit Criteria:**
- [ ] 24 hours with no critical issues
- [ ] Data integrity verified
- [ ] BLUE safely decommissioned

### 2.3 Database Migration Safety

**For each migration:**

```bash
# 1. Test on staging (read-only replica of prod data)
npm run migrate:test --env=staging

# 2. Verify backward compatibility
# - Old API version still works
# - New tables don't affect old queries
# - No schema locks that impact performance

# 3. Backup production database
pg_dump -h prod-db.aws.com -U admin amro_prod > backup_$(date +%s).sql

# 4. Apply migration to GREEN (before traffic switch)
npm run migrate:apply --env=green

# 5. Verify migration success
npm run migrate:verify --env=green

# 6. Monitor database after traffic switch
# - Query performance: p95 <100ms
# - Connection count: stable, <100
# - Replication lag: <1s
```

---

## 3. Post-Deployment Validation

### 3.1 Smoke Tests (Automated, ~5 min)

```bash
npm run test:smoke:production

# Tests:
✅ API health endpoint responds
✅ Authentication works (login/logout)
✅ Work package creation succeeds
✅ Work package retrieval succeeds
✅ Database queries return data
✅ Kafka events publish
✅ Feature flags can toggle
✅ Audit records created
```

### 3.2 Manual Validation (20 min)

**Test Account:** pilot-tenant@company.com

| Scenario | Steps | Expected | Status |
|---|---|---|---|
| Create WP | 1. Login 2. Create WP 3. Verify in list | WP appears | ☐ Pass |
| List Filter | 1. Open list 2. Filter by priority 3. Verify count | Correct filter applied | ☐ Pass |
| Detail Edit | 1. Open WP 2. Edit title 3. Save | Title updated | ☐ Pass |
| Offline (Mobile) | 1. Go offline 2. Create task 3. Go online 4. Sync | Task synced | ☐ Pass |
| E-Signature | 1. Open task 2. Sign 3. Verify audit | Signature in audit trail | ☐ Pass |
| Compliance Gate | 1. Try to close missing qualification 2. Verify blocked | Gate blocks closure | ☐ Pass |
| Permissions | 1. Login as technician 2. Try to approve 3. Verify denied | Action denied | ☐ Pass |

### 3.3 Performance Validation (30 min)

**Use Load Testing Tool (k6, JMeter):**

```bash
# Test 100 concurrent users for 10 minutes
./scripts/load-test.sh --users=100 --duration=10m

# Expected metrics:
# - p99 latency: <1s
# - p95 latency: <500ms
# - Error rate: <0.5%
# - Throughput: >100 req/s
```

### 3.4 Data Integrity Validation (15 min)

```sql
-- Check for data inconsistencies
SELECT COUNT(*) FROM work_packages WHERE tenant_id IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM mro_audit.records WHERE created_at > NOW() - INTERVAL '1 hour';
-- Expected: >0 (audit records being created)

-- Check for orphaned references
SELECT COUNT(*) FROM tasks WHERE work_package_id NOT IN (SELECT id FROM work_packages);
-- Expected: 0

-- Verify RLS is enforced
SELECT COUNT(DISTINCT tenant_id) FROM work_packages;
-- Expected: match number of tenants
```

### 3.5 AMRO Master Data Tenant Isolation Validation (10 min)

```sql
-- Ensure tenant scope is populated
SELECT COUNT(*) FROM manufacturers WHERE tenant_id IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM assembly_types WHERE tenant_id IS NULL;
-- Expected: 0

SELECT COUNT(*) FROM assembly_models WHERE tenant_id IS NULL;
-- Expected: 0

-- Validate assembly models reference same-tenant manufacturers and assembly types
SELECT COUNT(*)
FROM assembly_models m
LEFT JOIN manufacturers mf ON mf.id = m.manufacturer_id AND mf.tenant_id = m.tenant_id
LEFT JOIN assembly_types at ON at.id = m.assembly_type_id AND at.tenant_id = m.tenant_id
WHERE mf.id IS NULL OR at.id IS NULL;
-- Expected: 0
```

---

## 4. Rollback Procedures

### 4.1 Rollback Triggers

**Automatic Rollback (if any occur):**
- Error rate >2% for 5 minutes
- p99 latency >2s for 5 minutes
- Critical business functionality fails (work package CRUD)
- Data corruption detected
- Security vulnerability exploited

**Manual Rollback (team decision):**
- Major feature bug making system unusable
- Performance degradation affecting SLA
- Compliance or security issue discovered

### 4.2 Rollback Steps (≤5 minutes)

```bash
# ⏱️ START ROLLBACK TIMER

# 1. Alert all teams (2 min)
echo "🚨 ROLLBACK IN PROGRESS - v2.2.0 → v2.1.5" | slack --channel=#incidents
on-call-notify-all "AMRO rollback initiated"

# 2. Update load balancer (1 min)
kubectl patch svc amro-lb -p \
  '{"spec":{"trafficPolicy":{"canary":{"weight":100}}}}'  # 100% back to BLUE
# OR for single command:
aws elbv2 modify-target-group --target-group-arn ... --target-group-attributes Key=stickiness.enabled,Value=true

# 3. Verify traffic switched (30 sec)
curl -s https://api.amro.company.com/health | jq .version
# Expected: v2.1.5

# 4. Monitor for stabilization (1 min)
# Watch error rate drop below 0.5%
# Watch latency return to <950ms

# 5. Post incident review (schedule for later)
incident_id=$(date +%s)
echo "Incident $incident_id: AMRO v2.2.0 rollback" >> /logs/incidents.txt

# ⏱️ END ROLLBACK TIMER (should be <5 min)
```

### 4.3 Post-Rollback Actions

**Immediate (within 30 min):**
- [ ] Notify all stakeholders of rollback
- [ ] Stand down on-call engineers
- [ ] Collect logs from incident window
- [ ] Disable feature flag for v2.2.0

**Within 4 hours:**
- [ ] Root cause analysis meeting
- [ ] Identify what went wrong
- [ ] Create incident ticket
- [ ] Plan fix (hotfix or revert and redesign)

**Within 24 hours:**
- [ ] Post-mortem document
- [ ] Action items assigned
- [ ] Preventive controls implemented
- [ ] Communicate findings to team

---

## 5. Monitoring & Alerting

### 5.1 Metrics to Monitor (Real-Time)

**Application Metrics (SLA targets):**

| Metric | Target | Alert Threshold | Window |
|--------|--------|---|---|
| API Error Rate | <0.5% | >1% | 5 min |
| p99 Latency | <1s | >1.2s | 5 min |
| p95 Latency | <500ms | >600ms | 5 min |
| Throughput | >5000 TPS | <3000 TPS | 5 min |
| Auth Success Rate | >99.5% | <99% | 5 min |

**Infrastructure Metrics:**

| Metric | Target | Alert | Window |
|--------|--------|-------|--------|
| CPU Usage (per pod) | <60% | >80% | 5 min |
| Memory Usage (per pod) | <300MB | >400MB | 5 min |
| Disk Usage | <70% | >80% | 15 min |
| Database Connections | <100 | >120 | 5 min |
| Database CPU | <60% | >75% | 5 min |
| Network I/O | <100Mbps | >500Mbps | 5 min |

**Business Metrics:**

| Metric | Target | Alert | Window |
|--------|--------|-------|--------|
| Work Packages Created | >10/hour (prod) | <5/hour | 15 min |
| Tasks Completed | >50/hour | <25/hour | 15 min |
| Feature Flag Toggles | <5/hour | >10 toggled | 15 min |

### 5.2 Monitoring Tools Setup

**Prometheus (Metrics Collection):**
```yaml
# Scrape AMRO metrics every 15 seconds
scrape_configs:
  - job_name: 'amro-production'
    static_configs:
      - targets: ['amro-metrics:9090']
    scrape_interval: 15s
```

**Grafana (Dashboards):**
- Dashboard: "AMRO Production Deployment"
- Auto-refresh: 30 seconds
- Panels:
  - Error rate (red zone >1%)
  - Latency p99 (yellow >1s, red >1.2s)
  - Throughput (green >5000, yellow >3000)
  - Pod health (green=running, red=crashed)

**CloudWatch (AWS Logs):**
```bash
# Filter logs for errors during deployment
aws logs filter-log-events \
  --log-group-name /aws/ecs/amro-prod \
  --start-time $(date -d '30 minutes ago' +%s)000 \
  --filter-pattern "ERROR"
```

**Datadog (APM & Tracing):**
- Trace every request through all layers
- Track distributed traces for work package creation
- Alert on latency anomalies

### 5.3 Alert Routing

```
Alert Triggered
  ↓
Check Severity (Critical/Warning/Info)
  ├─ CRITICAL (Error Rate >2%, Latency >2s)
  │  ├─ Slack: #incidents (loud alert)
  │  ├─ PagerDuty: Page SRE on-call (phone call)
  │  ├─ Email: All engineers
  │  └─ Trigger auto-rollback
  │
  ├─ WARNING (Error Rate 0.5-2%, Latency 1-2s)
  │  ├─ Slack: #incidents (normal)
  │  ├─ PagerDuty: Notify (no phone call)
  │  └─ Manual decision: Wait or rollback
  │
  └─ INFO (Error Rate <0.5%, Latency <1s)
     ├─ Slack: #amro-metrics (informational)
     └─ No page, just track
```

---

## 6. Incident Response

### 6.1 Incident Response Timeline

**T+0 min (Alert triggered)**
- [ ] SRE on-call receives page
- [ ] Acknowledge alert in PagerDuty
- [ ] Join #incidents Slack channel

**T+2 min (Triage)**
- [ ] Check Grafana dashboard for metrics
- [ ] Review recent logs for errors
- [ ] Determine: Is this a deployment issue or other outage?

**T+5 min (Escalation)**
- [ ] If rollback needed: Execute rollback (≤5 min)
- [ ] If investigation needed: Gather logs and evidence
- [ ] Notify engineering lead

**T+10-30 min (Investigation)**
- [ ] Root cause analysis
- [ ] Determine if rollback needed
- [ ] Fix if simple hotfix possible

**T+30+ min (Resolution)**
- [ ] Restore service (rollback or deploy fix)
- [ ] Verify metrics normal
- [ ] Stand down on-call engineers
- [ ] Schedule post-mortem

### 6.2 Common Incident Scenarios

#### Scenario 1: Error Rate Spikes to 5%

```
Metrics show: HTTP 500 errors doubled in last 5 minutes
Logs show: "NullPointerException in work-order service"

Response:
1. Immediately initiate ROLLBACK (don't wait for full investigation)
   - Rollback v2.2.0 → v2.1.5
   - Error rate should drop within 1 minute

2. Post-incident:
   - Find code commit causing NPE
   - Add null check before deployment
   - Add test case to catch this
   - Re-deploy with fix in next iteration
```

#### Scenario 2: Latency Increases 50%

```
Metrics show: p99 latency 1.5s (baseline 950ms)
Logs show: Slow database queries

Response:
1. Check if query plan changed with migration
2. Check database CPU and connections
3. If cause unknown: ROLLBACK to be safe
4. Post-incident:
   - Review migration SQL for missing indexes
   - Add indexes before re-deploying
   - Load test with actual query patterns
```

#### Scenario 3: Data Integrity Issues

```
Logs show: "Tenant_id mismatch: query returned other tenant data"
Alert: Security - RLS enforcement failure

Response:
1. IMMEDIATELY ROLLBACK (security issue)
2. Notify security team and compliance
3. Investigate:
   - Did code change RLS policies?
   - Did migration break RLS?
   - Are other tenants' data exposed?
4. Audit trail needed:
   - Query logs for affected accounts
   - Check if data was accessed
   - Notify affected tenants

Post-incident:
- Add RLS test to CI/CD (must test each table)
- Require security review for any RLS changes
- Add data segregation tests
```

---

## 7. Runbooks by Scenario

### Runbook 1: Rollback to Previous Version

**When to use:** Error rate >2%, latency >2s, critical functionality broken

```bash
#!/bin/bash
set -e

ROLLBACK_VERSION="v2.1.5"
ALERT_CHANNEL="#incidents"
NOTIFY_EMAIL="amro-team@company.com"

echo "🚨 INITIATING ROLLBACK TO $ROLLBACK_VERSION"

# 1. Notify all teams
curl -X POST https://slack.com/api/chat.postMessage \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -d "channel=$ALERT_CHANNEL" \
  -d "text=🚨 AMRO ROLLBACK: $ROLLBACK_VERSION"

# 2. Update load balancer
kubectl patch svc amro-lb --type merge -p \
  '{"spec":{"selector":{"env":"blue"}}}'

# 3. Verify traffic switched
sleep 5
CURRENT_VERSION=$(curl -s https://api.amro.company.com/health | jq -r .version)
if [ "$CURRENT_VERSION" == "$ROLLBACK_VERSION" ]; then
  echo "✅ Rollback successful"
  exit 0
else
  echo "❌ Rollback failed: current version is $CURRENT_VERSION"
  exit 1
fi
```

### Runbook 2: Emergency Database Restore

**When to use:** Data corruption, accidental deletion, migration failure

```bash
#!/bin/bash
set -e

BACKUP_ID="${1:-latest}"
TARGET_DB="amro_prod_restored"

echo "📊 RESTORING DATABASE FROM BACKUP: $BACKUP_ID"

# 1. Create new database
psql -h prod-db.aws.com -U admin -c "CREATE DATABASE $TARGET_DB"

# 2. Restore from backup
pg_restore -h prod-db.aws.com -U admin \
  -d $TARGET_DB \
  /backups/amro_prod_$BACKUP_ID.sql

# 3. Run consistency checks
psql -h prod-db.aws.com -U admin -d $TARGET_DB << EOF
  SELECT COUNT(*) as work_packages FROM work_packages;
  SELECT COUNT(*) as audit_records FROM mro_audit.records;
  SELECT COUNT(DISTINCT tenant_id) as tenants FROM work_packages;
EOF

# 4. Switch application to restored database
kubectl set env deployment/amro \
  DATABASE_URL="postgresql://admin:pass@prod-db.aws.com/$TARGET_DB"

# 5. Verify application working
sleep 10
curl -s https://api.amro.company.com/health | jq .

echo "✅ Database restore complete"
```

### Runbook 3: Feature Flag Toggle Emergency

**When to use:** Feature causing issues, want to disable without rollback

```bash
#!/bin/bash
set -e

FEATURE="${1:-phase-2-mobile}"
ACTION="${2:-disable}"  # enable or disable

echo "🚩 ${ACTION^^}ING FEATURE FLAG: $FEATURE"

# 1. Update feature flag service
curl -X PATCH https://feature-flags.company.com/api/v1/flags/$FEATURE \
  -H "Authorization: Bearer $API_TOKEN" \
  -d "enabled=$([[ $ACTION == 'enable' ]] && echo 'true' || echo 'false')"

# 2. Verify flag state propagated (wait for eventual consistency)
for i in {1..30}; do
  FLAG_STATE=$(curl -s https://feature-flags.company.com/api/v1/flags/$FEATURE | jq -r .enabled)
  if [[ "$FLAG_STATE" == "$([[ $ACTION == 'enable' ]] && echo 'true' || echo 'false')" ]]; then
    echo "✅ Feature flag $ACTION complete"
    exit 0
  fi
  echo "⏳ Waiting for flag propagation ($i/30)..."
  sleep 1
done

echo "❌ Feature flag toggle timed out"
exit 1
```

### Runbook 4: Performance Degradation Investigation

**When to use:** Slow API responses, high latency, but no errors

```bash
#!/bin/bash
set -e

echo "🔍 INVESTIGATING PERFORMANCE DEGRADATION"

# 1. Check database performance
echo "📊 Database queries (slowest):"
psql -h prod-db.aws.com -U admin amro_prod << EOF
  SELECT query, mean_time, calls
  FROM pg_stat_statements
  ORDER BY mean_time DESC
  LIMIT 10;
EOF

# 2. Check database connections
echo "📊 Active connections:"
psql -h prod-db.aws.com -U admin -c \
  "SELECT state, COUNT(*) FROM pg_stat_activity GROUP BY state;"

# 3. Check Kubernetes pod resources
echo "📊 Pod resource usage:"
kubectl top pods -l app=amro

# 4. Check cache hit rate
echo "📊 Redis cache:"
redis-cli -h redis-prod.aws.com INFO stats | grep -E "hits|misses"

# 5. Analysis
echo "📊 Common causes:"
echo "  - Missing database index (check slow_log)"
echo "  - N+1 queries in code"
echo "  - Cache expiry too short (high miss rate)"
echo "  - Pod memory pressure (OOMKilled pods)"
echo "  - Database replication lag (use read replicas)"

# Recommendation
echo "✅ Possible fixes:"
echo "  1. Add index to slow table"
echo "  2. Enable query result caching"
echo "  3. Increase pod memory limit"
echo "  4. Scale database read replicas"
```

---

## 8. Deployment Checklist

**Print this and check boxes during deployment:**

```
=== PRE-DEPLOYMENT (48 hours before) ===
□ Engineering: Reviewed PRs, no breaking changes
□ Product: Feature flags configured, go/no-go list ready
□ Security: Security analysis passed, no secrets in code
□ DevOps: Rollback tested, scripts ready
□ QA: Regression testing complete, smoke tests passing

=== PRE-DEPLOYMENT (24 hours before) ===
□ Engineering: Final code review, CI/CD green
□ DevOps: Migrations tested, backup scheduled
□ Operations: Team briefed, escalation contacts confirmed
□ SRE: Monitoring active, alerts configured

=== PRE-DEPLOYMENT (1 hour before) ===
□ FINAL GO/NO-GO DECISION: All teams vote
   □ Engineering: GO / NO-GO
   □ DevOps: GO / NO-GO
   □ Operations: GO / NO-GO
   □ SRE: GO / NO-GO
   □ QA: GO / NO-GO
   □ Product: GO / NO-GO
   → If ANY "NO-GO": HALT DEPLOYMENT

=== DEPLOYMENT STAGE 1 (Deploy GREEN) ===
□ 1. Pull code from main
□ 2. Run database migrations on staging (test)
□ 3. Build and push Docker image
□ 4. Deploy to GREEN Kubernetes
□ 5. Wait for pods ready
□ 6. Run smoke tests on GREEN
□ ⏱️ Timeline: 0-30 minutes
□ EXIT CRITERIA: All GREEN pods healthy, tests passing

=== DEPLOYMENT STAGE 2 (Canary 1%) ===
□ 1. Route 1% traffic to GREEN
□ 2. Monitor metrics for 30 minutes (every 5 min):
   □ Error rate: <0.2% (alert at >0.2%)
   □ p99 latency: <1s (alert at >1s)
   □ Memory: <400MB/pod (alert at >400MB)
   □ CPU: <60% (alert at >80%)
□ ⏱️ Timeline: 30-60 minutes
□ EXIT CRITERIA: Metrics normal, no critical errors

=== DEPLOYMENT STAGE 3 (Ramp to 25%) ===
□ 1. Route 25% traffic to GREEN
□ 2. Monitor metrics for 30 minutes
□ ⏱️ Timeline: 60-90 minutes
□ EXIT CRITERIA: Same as canary, no new errors

=== DEPLOYMENT STAGE 4 (Ramp to 100%) ===
□ 1. Route 100% traffic to GREEN
□ 2. Monitor continuously for stability
□ ⏱️ Timeline: 90-120 minutes
□ EXIT CRITERIA: Error rate <0.5%, latency <1s

=== DEPLOYMENT STAGE 5 (Keep BLUE 24h) ===
□ 1. BLUE stays running as standby
□ 2. Monitor both environments for 24 hours
□ 3. Verify no data inconsistencies
□ ⏱️ Timeline: T+0 to T+24 hours
□ EXIT CRITERIA: No critical issues, data verified

=== POST-DEPLOYMENT VALIDATION ===
□ 1. Smoke tests: All passing
□ 2. Manual tests: Create/edit/list WP, mobile offline, E-signature
□ 3. Performance tests: <1s p99 latency, <0.5% error rate
□ 4. Data integrity: No orphaned references, RLS enforced
□ ⏱️ Timeline: T+2 to T+3 hours

=== AFTER 24 HOURS ===
□ 1. Verify no critical issues emerged
□ 2. Decommission BLUE environment
□ 3. Document any issues for post-mortem
□ 4. Release engineering team from alert status

=== DEPLOYMENT COMPLETE ===
✅ Version deployed: v2.2.0
✅ Timestamp: [START_TIME] to [END_TIME]
✅ Duration: [HOURS]
✅ Incidents: [COUNT]
✅ Rollbacks: [COUNT]
✅ Status: SUCCESS / ROLLBACK

Next deployment scheduled: [DATE]
```

---

## Appendix: Contact Information

### On-Call Escalation

```
Tier 1: SRE On-Call
  - Pager: SRE on-call rotation
  - Slack: @sre-oncall
  - Response time: ≤5 min

Tier 2: Engineering Lead
  - Name: [Engineering Lead]
  - Phone: +1-XXX-XXX-XXXX
  - Slack: @engineering-lead
  - Response time: ≤15 min

Tier 3: VP Engineering
  - Name: [VP Engineering]
  - Phone: +1-XXX-XXX-XXXX
  - Slack: @vp-engineering
  - Response time: ≤30 min

Incident Channel: #incidents
Status Page: https://status.company.com/amro
```

### Key Contacts

| Role | Name | Email | Slack |
|------|------|-------|-------|
| DevOps Lead | [Name] | [Email] | @devops-lead |
| SRE Lead | [Name] | [Email] | @sre-lead |
| Engineering Lead | [Name] | [Email] | @eng-lead |
| Product Manager | [Name] | [Email] | @pm |
| Security | [Name] | [Email] | @security |

---

**Document Status:** Ready for Implementation
**Last Updated:** 2026-03-19
**Next Review:** After each deployment phase

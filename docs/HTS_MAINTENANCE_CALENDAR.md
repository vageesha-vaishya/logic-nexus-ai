# HTS Maintenance Calendar & Procedures

## Quarterly Maintenance Calendar

| Quarter | Action Item | Responsibility | Procedure Reference |
|---|---|---|---|
| **Q1 (Jan)** | Annual HTS Update Ingestion | Lead Data Engineer | `PROC-001` |
| **Q1 (Jan)** | Federal Register History Audit | Compliance Officer | `PROC-002` |
| **Q2 (Apr)** | USITC TATA Release Sync | Data Engineer | `PROC-003` |
| **Q2 (Apr)** | Validation Report Audit (XBRL) | External Auditor | `PROC-004` |
| **Q3 (Jul)** | Mid-Year Census Supplement | Lead Data Engineer | `PROC-001` |
| **Q3 (Jul)** | Discrepancy SLA Review | Project Manager | `PROC-005` |
| **Q4 (Oct)** | Pre-Year-End Code Freeze | DevOps | `PROC-006` |
| **Q4 (Oct)** | Feature Flag Rotation | Tech Lead | `PROC-007` |

---

## Operational Procedures

### PROC-001: Annual HTS Update Ingestion
**Trigger**: Release of new `expaes.txt` by Census Bureau (typically late Dec/early Jan).
**Steps**:
1.  **Backup**: Run `pg_dump` on `master_hts`.
2.  **Dry Run**: Execute `python3 scripts/hts_etl_pipeline.py --dry-run`.
3.  **Review**: Check `discrepancy_logs` for "CRITICAL" flags.
4.  **Execute**: Run pipeline without dry-run.
5.  **Verify**: Generate report via `python3 scripts/generate_hts_report.py`.

### PROC-002: Federal Register History Audit
**Trigger**: Quarterly.
**Steps**:
1.  Query `federalregister.gov` API for "Harmonized Tariff Schedule" over the last 90 days.
2.  Cross-reference findings with `master_hts_history`.
3.  Ensure all effective dates in FR notices are reflected in `effective_date` column.

### PROC-005: Discrepancy SLA Review
**Trigger**: Monthly.
**Policy**: All "CRITICAL" discrepancies must be resolved within 5 business days.
**Steps**:
1.  Query `SELECT * FROM discrepancy_logs WHERE status='OPEN' AND created_at < NOW() - INTERVAL '5 days'`.
2.  Escalate any results to the CTO/Compliance Head.

---

## Rollback Procedures

### Automated Rollback (Script Failure)
If the ETL pipeline fails mid-execution:
1.  The script uses database transactions (implicit in some blocks, explicit in others).
2.  If a Python exception occurs, `conn.commit()` is not called for the current batch.

### Manual Rollback (Bad Data)
If bad data is committed:
1.  Identify the `history_id` or timestamp before the corruption.
2.  Restore from the nightly backup OR use `master_hts_history` to reverse changes.
    ```sql
    -- Example: Revert specific code to previous state
    UPDATE master_hts m
    SET description = h.description, hts_code = h.hts_code
    FROM master_hts_history h
    WHERE m.id = h.original_id 
      AND h.hts_code = 'TARGET_CODE'
      AND h.changed_at < '2026-01-30 10:00:00';
    ```

---

## Feature Flags

| Flag Key | Description | Default |
|---|---|---|
| `hts_auto_retire` | Automatically retire deactivated codes without manual review | `false` |
| `hts_queue_new_codes` | Queue new HTS codes for manual review before activation | `true` |

**To toggle a flag:**
```sql
UPDATE app_feature_flags SET is_enabled = true WHERE flag_key = 'hts_auto_retire';
```

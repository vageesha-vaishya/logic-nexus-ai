# Dashboards

## KPIs
- Quote→Email success rate (%)
- Data-lag SLA (< 2 s)
- Business-rule violations count

## Sources
- audit_logs (EVENT:PdfGenerated, EVENT:EmailSent, ALERT:ReconcileMismatch)
- emails (status, sent_at)
- quotes/quotation_versions (updated_at)

## Panels
- Trend of success rate over time
- Discrepancy rate from scheduled-reconcile
- Function latency percentiles (from function logs)

## Alerts
- Discrepancy rate > 0.01% triggers on-call alert

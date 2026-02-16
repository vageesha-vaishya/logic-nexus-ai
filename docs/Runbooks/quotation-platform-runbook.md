# Quotation Platform Migration Runbook

## Scope
- Migrate quotation module to resilient architecture with event sourcing, idempotency, and audit trails
- Preserve backward compatibility for UI and APIs

## Pre-Checks
- Verify environment variables for Supabase functions (URL, keys)
- Deploy functions: generate-quote-pdf, send-email, emit-event, reconcile-quote, scheduled-reconcile
- Confirm audit_logs table exists and RLS policies are correct

## Deployment Steps
- Deploy supabase functions
- Enable scheduled-reconcile via Supabase scheduler or external cron hitting scheduled-reconcile
- Roll out client changes for trace/idempotency propagation

## Validation
- Generate preview and confirm PdfGenerated event in audit_logs
- Send quote email and confirm EmailSent event in audit_logs
- Run scheduled-reconcile and check ALERT entries if mismatches are found

## Observability
- Use function logs for trace_id
- Monitor audit_logs counts and discrepancy rate

## Backward Compatibility
- Existing UI flows continue to work
- New trace/idempotency fields are additive


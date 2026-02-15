# Rollback Plan

## Triggers
- Elevated discrepancy rate (> 0.01%) from scheduled-reconcile
- Repeated failures in generate-quote-pdf or send-email

## Immediate Actions
- Disable scheduled-reconcile temporarily
- Revert client invocation to previous payload (without trace/idempotency) if needed

## Data Recovery
- Use audit_logs entries to reconstruct missing events
- Re-generate PDFs and re-send emails for affected quotes

## Verification
- Run reconcile-quote for affected quotes to confirm consistency

## Re-enable
- Restore scheduler and re-enable new flows incrementally

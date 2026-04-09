# AMRO Stock Ledger UAT Session Plan

## Session Objectives
- Validate stock ledger correctness for operational and finance use cases.
- Confirm negative stock prevention and reconciliation behaviors.
- Verify report export and usability under realistic workflows.

## Participants
- UAT Lead
- Storekeeper Representative
- Inventory Controller Representative
- Maintenance Manager Representative
- Finance Analyst Representative
- Engineering Observer

## Session Agenda (90 minutes)
1. Environment validation (10 min)
2. Guided scenario walkthrough (45 min)
3. Exploratory user testing (20 min)
4. Defect triage and signoff decision (15 min)

## Entry Criteria
- Migration `20260408224500_amro_stock_ledger_module_foundation.sql` applied.
- AMRO API and frontend deployed to UAT environment.
- Seed data available in `parts_inventory`.
- Test accounts provisioned.

## Core Scenarios
1. Receipt posting increases on-hand and logs transaction cost.
2. Issue posting decreases on-hand with correct balance_after.
3. Negative stock scenario is blocked.
4. Batch posting handles mixed valid/invalid entries.
5. Reconciliation run generates run summary and variance item rows.
6. Stock balance and valuation reports export valid CSV.
7. Search/filter responds correctly with >500 records.
8. FIFO/LIFO layer consumption behaves correctly across multi-layer outbound postings.
9. Weighted-average recalculates after multiple inbound receipts.
10. Posting in closed period is blocked unless approved workflow is used.
11. Reopen request -> approval -> reopen execution path works end-to-end.
12. Audit export includes immutable timeline events for period/approval/ledger actions.

## Acceptance Criteria
- Zero critical defects.
- No data integrity loss in stock balances.
- Reconciliation output repeatable.
- CSV exports consumed successfully by finance users.
- Stakeholders approve production rollout.

## Exit Artifacts
- UAT execution log
- Defect list with severity
- Final signoff record
- Production go/no-go decision

# AMRO Stock Ledger User Manual

## Audience
- Storekeeper
- Inventory Controller
- Maintenance Planner
- Finance Analyst

## Access
1. Open `AMRO -> Parts`.
2. Navigate to `Stock Ledger` panel under the Parts workspace.
3. Ensure your account has stock-ledger view permissions.

## Daily Operations
### 1) Search and Filter
- Use search to find records by source reference, module, or notes.
- Use movement type filter to narrow the transaction list.

### 2) Create Single Transaction
1. Click `New Transaction`.
2. Keep mode as `Single`.
3. Enter:
   - Part Inventory ID
   - Movement Type
   - Quantity Delta
   - Unit Cost (if applicable)
4. Click `Create Transaction`.
5. Verify row appears in list.

Note:
- If resulting on-hand quantity would be negative, creation is blocked.

### 3) Create Batch Transactions
1. Click `New Transaction`.
2. Switch to `Batch`.
3. Paste JSON array of entries.
4. Click `Create Batch`.
5. Check toast summary for created/rejected counts.

### 4) Reconciliation
1. Click `Reconcile`.
2. Wait for completion message.
3. Review variance item counts.

### 5) Period Close Workflow
1. Open a period by entering period code, start/end date, and valuation method.
2. Close period when postings are finalized.
3. For corrections after close:
   - submit reopen request
   - obtain approval decision
   - execute reopen with approved request

Note:
- Posting in a closed period is locked unless approved workflow is followed.

### 6) Export Reports
- `Export Balance`: current stock balance summary.
- `Export Valuation`: valuation summary.
- Use API endpoint for transaction history export if required by finance workflows.
- `Export Audit`: immutable audit timeline export.

## Troubleshooting
- `Negative stock prevented`: reduce issue quantity or post receipt first.
- `Forbidden`: contact admin for role assignment.
- `Upstream service unavailable`: confirm AMRO API process and proxy target.
- `Table not found`: run stock ledger migration and reload schema.
- `Posting locked for closed period`: create approval request or reopen period through approved flow.

## Best Practices
- Use meaningful source references (work order, PO, receiving doc).
- Avoid large mixed batches without pre-validation.
- Run reconciliation at shift end or before valuation reporting.

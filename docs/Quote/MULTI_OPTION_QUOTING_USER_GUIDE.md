## Multi-Option Quoting (Quotation Composer)

### Overview
Multi-Option Quoting lets you create and compare multiple quote options for the same shipment request. Each option can have its own routing legs, carrier selections, charges, and margin assumptions.

Multi-Option Quoting is controlled by the tenant setting:
- Settings → Quotation Engine Configuration → Multi-Option Quoting

### Creating Multi-Option Quotes
1. Open a quote (Sales → Quotes → New Quote) and click Save & Compose.
2. In the Quotation Composer, complete the shipment inputs (mode, origin, destination, cargo).
3. Use one of the following flows:
   - Smart Quote Mode enabled: Click Get Rates to generate carrier options.
   - Smart Quote Mode disabled: Click Get Rates to start Manual Quote with a first option.
4. In the Rate Options panel:
   - Browse: Select an option to edit.
   - Compare: Compare options side-by-side.
5. To add additional options:
   - Click Add Option in the Rate Options header.
6. Select an option and edit:
   - Legs: Add/edit route legs.
   - Charges: Add/edit sell and buy values with margin controls.
7. Save Quote to persist the selected option and all alternative options.

### Selecting Primary vs Alternatives
- The option you select in the Rate Options list becomes the primary option when you save.
- All other options are saved as alternatives for comparison and later selection.

### Deleting Options
Options can be deleted from the Rate Options list:
- Click the delete icon on an option.
- Confirm deletion in the dialog.

Safeguards prevent deletion when:
- The quote already has a booking.
- The option has already been selected by a customer.

### Smart Mode Configuration
Smart Mode includes configurable ranking and feature toggles:
- Open Smart Quote Mode settings from the Smart Mode header control.
- Adjust ranking priorities (Cost, Transit Time, Reliability).
- Save configuration to persist per tenant.

### Troubleshooting
- If you do not see Add Option, confirm Multi-Option Quoting is enabled for your tenant.
- If rate generation returns no options, use Manual Quote (Smart Quote Mode off) and add options manually.
- If option deletion fails, check whether the quote is already booked or a customer selection exists.

## Technical Notes (for developers)

### Persistence
- Options are persisted using the `save_quote_atomic` RPC via the composer save workflow.
- Safe deletions use the `delete_quote_option_safe` RPC.

### API / RPC
- `delete_quote_option_safe(p_option_id uuid, p_reason text)` returns:
  - ok: boolean
  - deleted_option_id: uuid
  - reselected_option_id: uuid | null

import { BillingEngineService } from '../src/services/billing/billing-engine.service';
import { InvoiceRecord } from '../src/types/crm.types';

describe('BillingEngineService', () => {
  const invoice: InvoiceRecord = {
    id: 'inv-1',
    tenant_id: 'tenant-1',
    franchise_id: 'franchise-1',
    invoice_number: 'INV-001',
    status: 'issued',
    issue_date: '2026-03-20',
    due_date: '2026-04-20',
    metadata: {
      shipment_id: 'shp-1',
      mode: 'ocean'
    },
    created_at: '2026-03-20T00:00:00.000Z',
    updated_at: '2026-03-20T00:00:00.000Z'
  };

  it('selects logistics formatter for LOGISTICS domain', () => {
    const service = new BillingEngineService();
    const billing = service.generate('LOGISTICS', invoice);

    expect(billing.format).toBe('logistics');
    expect(billing.summary.invoiceNumber).toBe('INV-001');
    expect(billing.sections[0].title).toBe('Freight Charges');
  });

  it('falls back to generic formatter for unknown domain', () => {
    const service = new BillingEngineService();
    const billing = service.generate('HEALTHCARE', invoice);

    expect(billing.format).toBe('generic');
    expect(billing.sections[0].title).toBe('General Charges');
  });
});

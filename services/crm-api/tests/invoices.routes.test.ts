jest.mock('../src/middleware/auth.middleware', () => ({
  authMiddleware: (req: any, _res: any, next: any) => {
    req.tenantId = 'tenant-1';
    req.franchiseId = 'franchise-1';
    req.userId = 'user-1';
    next();
  }
}));

import request from 'supertest';
import app from '../src/app';
import { InvoicesService } from '../src/services/invoices.service';

describe('Invoice Finalize Route', () => {
  const invoicesServiceInstance = {
    finalizeInvoice: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .spyOn(InvoicesService.prototype, 'finalizeInvoice')
      .mockImplementation(invoicesServiceInstance.finalizeInvoice);
  });

  it('finalizes invoice and forwards idempotency key', async () => {
    invoicesServiceInstance.finalizeInvoice.mockResolvedValue({
      invoice: {
        id: 'invoice-1',
        tenant_id: 'tenant-1',
        franchise_id: 'franchise-1',
        invoice_number: 'INV-001',
        status: 'issued',
        issue_date: '2026-03-20',
        due_date: null,
        metadata: null,
        created_at: '2026-03-20T00:00:00.000Z',
        updated_at: '2026-03-20T00:00:00.000Z'
      },
      statusChanged: true,
      glSync: {
        queued: true,
        mode: 'in_process',
        jobId: 'gl-sync:tenant-1:INVOICE:invoice-1'
      },
      idempotency: {
        key: 'idem-1',
        replayed: false
      }
    });

    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/finalize')
      .set('Authorization', 'Bearer test-token')
      .set('Idempotency-Key', 'idem-1');

    expect(response.status).toBe(200);
    expect(invoicesServiceInstance.finalizeInvoice).toHaveBeenCalledWith(
      'invoice-1',
      'tenant-1',
      'user-1',
      'franchise-1',
      'idem-1'
    );
    expect(response.body.idempotency).toEqual({ key: 'idem-1', replayed: false });
  });

  it('rejects invalid idempotency key length', async () => {
    const response = await request(app)
      .post('/api/v1/invoices/invoice-1/finalize')
      .set('Authorization', 'Bearer test-token')
      .set('Idempotency-Key', 'x'.repeat(129));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_IDEMPOTENCY_KEY');
    expect(invoicesServiceInstance.finalizeInvoice).not.toHaveBeenCalled();
  });

  it('returns 404 when invoice does not exist', async () => {
    invoicesServiceInstance.finalizeInvoice.mockRejectedValue(new Error('Invoice not found'));

    const response = await request(app)
      .post('/api/v1/invoices/missing/finalize')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('NOT_FOUND');
  });

  it('returns 409 when invoice is in invalid status', async () => {
    invoicesServiceInstance.finalizeInvoice.mockRejectedValue(
      new Error('Invoice cannot be finalized from status cancelled')
    );

    const response = await request(app)
      .post('/api/v1/invoices/invoice-9/finalize')
      .set('Authorization', 'Bearer test-token');

    expect(response.status).toBe(409);
    expect(response.body.code).toBe('INVALID_STATE');
  });
});

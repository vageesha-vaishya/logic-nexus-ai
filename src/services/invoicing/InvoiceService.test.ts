
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from './InvoiceService';
import { CreateInvoiceRequest } from './types';
import type { ScopedDataAccess } from '@/lib/db/access';
import { GLSyncService } from '../gl/GLSyncService';

// Mock Supabase (still needed for auth.getUser)
const mockUser = { id: 'user-123' };
const mockTenantId = 'tenant-123';
const mockFranchiseId = 'franchise-456';
const mockInvoice = { id: 'invoice-123', tenant_id: mockTenantId, status: 'draft' };

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null })
    }
  }
}));

vi.mock('../gl/GLSyncService', () => ({
  GLSyncService: {
    enqueueTransactionSync: vi.fn().mockResolvedValue({
      queued: true,
      mode: 'in_process',
      jobId: 'gl-sync:tenant-123:INVOICE:invoice-123',
    }),
  },
}));

// Create a mock ScopedDataAccess
type MockScopedDb = Pick<ScopedDataAccess, 'from' | 'rpc' | 'accessContext' | 'client'> & {
  _mocks: {
    mockFrom: ReturnType<typeof vi.fn>;
    mockSelect: ReturnType<typeof vi.fn>;
    mockInsert: ReturnType<typeof vi.fn>;
    mockUpdate: ReturnType<typeof vi.fn>;
    mockRpc: ReturnType<typeof vi.fn>;
  };
};

function createMockScopedDb(overrides: Partial<MockScopedDb> = {}): MockScopedDb {
  const mockListRange = vi.fn().mockResolvedValue({ data: [mockInvoice], error: null, count: 1 });
  const mockListOrder = vi.fn().mockReturnValue({ range: mockListRange });
  const mockSelect = vi.fn().mockReturnValue({
    order: mockListOrder,
    eq: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: mockInvoice, error: null })
    })
  });

  const mockInsert = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue({ data: { ...mockInvoice, invoice_number: 'INV-001' }, error: null })
    })
  });

  const mockUpdate = vi.fn().mockReturnValue({
    eq: vi.fn().mockResolvedValue({ error: null })
  });

  const mockDelete = vi.fn();

  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDelete,
  });

  const mockRpc = vi.fn().mockResolvedValue({ data: 'INV-001', error: null });

  return {
    from: mockFrom,
    rpc: mockRpc,
    accessContext: {
      tenantId: mockTenantId,
      franchiseId: mockFranchiseId,
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isFranchiseAdmin: false,
      userId: mockUser.id,
    },
    client: {},
    ...overrides,
    // Expose mocks for assertions
    _mocks: { mockFrom, mockSelect, mockInsert, mockUpdate, mockRpc }
  } as unknown as MockScopedDb;
}

describe('InvoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list invoices using scoped query', async () => {
    const scopedDb = createMockScopedDb();

    const result = await InvoiceService.listInvoices(scopedDb as unknown as ScopedDataAccess);

    expect(scopedDb.from).toHaveBeenCalledWith('invoices');
    expect(result).toEqual({ data: [mockInvoice], totalCount: 1 });
  });

  it('should get a single invoice by ID using scoped query', async () => {
    const scopedDb = createMockScopedDb();

    const result = await InvoiceService.getInvoice('invoice-123', scopedDb as unknown as ScopedDataAccess);

    expect(scopedDb.from).toHaveBeenCalledWith('invoices');
    expect(result).toEqual(mockInvoice);
  });

  it('should create an invoice using scoped insert', async () => {
    const mockInsert = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { id: 'invoice-123', invoice_number: 'INV-001' }, error: null })
      })
    });

    const mockUpdate = vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ error: null })
    });

    const mockSelect = vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({ data: { ...mockInvoice, subtotal: 200, total: 200 }, error: null })
      })
    });

    let callCount = 0;
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        callCount++;
        // First call = insert, second = update, third = select (getInvoice)
        if (callCount === 1) return { insert: mockInsert };
        if (callCount === 2) return { update: mockUpdate };
        if (callCount === 3) return { select: mockSelect };
      }
      if (table === 'invoice_line_items') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) };
      }
      return {};
    });

    const scopedDb = createMockScopedDb({ from: mockFrom });

    const request: CreateInvoiceRequest = {
      customer_id: 'cust-1',
      issue_date: new Date(),
      due_date: new Date(),
      currency: 'USD',
      items: [
        { description: 'Freight charges', quantity: 2, unit_price: 100 }
      ]
    };

    await InvoiceService.createInvoice(request, scopedDb as unknown as ScopedDataAccess);

    // Verify scoped insert was used (not raw supabase)
    expect(mockFrom).toHaveBeenCalledWith('invoices');
    expect(mockInsert).toHaveBeenCalled();
    // Verify tenant_id is NOT manually set — ScopedDataAccess handles injection
    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg).not.toHaveProperty('tenant_id');
    expect(insertArg).toHaveProperty('invoice_number', 'INV-001');
  });

  it('should throw if tenant ID is missing from scope context', async () => {
    const scopedDb = createMockScopedDb();
    scopedDb.accessContext.tenantId = null;

    const request: CreateInvoiceRequest = {
      customer_id: 'cust-1',
      issue_date: new Date(),
      due_date: new Date(),
      currency: 'USD',
      items: [{ description: 'Test', quantity: 1, unit_price: 50 }]
    };

    await expect(InvoiceService.createInvoice(request, scopedDb as unknown as ScopedDataAccess)).rejects.toThrow('Tenant ID not found in scope context');
  });

  it('should finalize draft invoice and enqueue GL sync', async () => {
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockUpdateEq });
    const mockSelectSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { ...mockInvoice, status: 'draft', tenant_id: mockTenantId }, error: null })
      .mockResolvedValueOnce({ data: { ...mockInvoice, status: 'issued', tenant_id: mockTenantId }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSelectSingle }) });
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    });
    const scopedDb = createMockScopedDb({ from: mockFrom });

    const result = await InvoiceService.finalizeInvoice('invoice-123', scopedDb as unknown as ScopedDataAccess);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'issued',
      })
    );
    expect(GLSyncService.enqueueTransactionSync).toHaveBeenCalledWith('tenant-123', 'invoice-123', 'INVOICE');
    expect(result.invoice.status).toBe('issued');
    expect(result.statusChanged).toBe(true);
  });

  it('should enqueue GL sync without status update when invoice already issued', async () => {
    const mockSelectSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { ...mockInvoice, status: 'issued', tenant_id: mockTenantId }, error: null })
      .mockResolvedValueOnce({ data: { ...mockInvoice, status: 'issued', tenant_id: mockTenantId }, error: null });
    const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSelectSingle }) });
    const mockUpdate = vi.fn();
    const mockFrom = vi.fn().mockImplementation((table: string) => {
      if (table === 'invoices') {
        return {
          select: mockSelect,
          update: mockUpdate,
        };
      }
      return {};
    });
    const scopedDb = createMockScopedDb({ from: mockFrom });

    const result = await InvoiceService.finalizeInvoice('invoice-123', scopedDb as unknown as ScopedDataAccess);

    expect(mockUpdate).not.toHaveBeenCalled();
    expect(GLSyncService.enqueueTransactionSync).toHaveBeenCalledWith('tenant-123', 'invoice-123', 'INVOICE');
    expect(result.statusChanged).toBe(false);
  });
});

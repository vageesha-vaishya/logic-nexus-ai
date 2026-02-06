
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from './InvoiceService';
import { CreateInvoiceRequest } from './types';

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

// Create a mock ScopedDataAccess
function createMockScopedDb(overrides: Record<string, any> = {}) {
  const mockSelect = vi.fn().mockReturnValue({
    order: vi.fn().mockResolvedValue({ data: [mockInvoice], error: null }),
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
  } as any;
}

describe('InvoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should list invoices using scoped query', async () => {
    const scopedDb = createMockScopedDb();

    const result = await InvoiceService.listInvoices(scopedDb);

    expect(scopedDb.from).toHaveBeenCalledWith('invoices');
    expect(result).toEqual([mockInvoice]);
  });

  it('should get a single invoice by ID using scoped query', async () => {
    const scopedDb = createMockScopedDb();

    const result = await InvoiceService.getInvoice('invoice-123', scopedDb);

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

    const result = await InvoiceService.createInvoice(request, scopedDb);

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

    await expect(InvoiceService.createInvoice(request, scopedDb)).rejects.toThrow('Tenant ID not found in scope context');
  });
});

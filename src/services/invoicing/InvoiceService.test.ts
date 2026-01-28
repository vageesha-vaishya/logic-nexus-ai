
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InvoiceService } from './InvoiceService';
import { TaxEngine } from '../taxation/TaxEngine';
import { CreateInvoiceRequest } from './types';

// Mock Supabase
const mockUser = { id: 'user-123' };
const mockTenantId = 'tenant-123';
const mockInvoice = { id: 'invoice-123' };

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockInsert = vi.fn();
const mockSchema = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getUser: () => mockGetUser()
    },
    from: (table: string) => mockFrom(table),
    schema: (schema: string) => mockSchema(schema)
  }
}));

// Mock TaxEngine
vi.mock('../taxation/TaxEngine', () => ({
  TaxEngine: {
    determineNexus: vi.fn(),
    calculate: vi.fn()
  }
}));

describe('InvoiceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Supabase Mocks
    mockGetUser.mockResolvedValue({ data: { user: mockUser }, error: null });
    
    // User Role Mock (for tenant_id)
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ single: mockSingle });
    mockSingle.mockResolvedValue({ data: { tenant_id: mockTenantId }, error: null });

    // Schema Mock (finance)
    mockSchema.mockReturnValue({ from: mockFrom });
    
    // Insert Mock
    mockInsert.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ single: mockSingle, ...Promise.resolve([]) }); // Handle both single and array return
    // Wait, for array return (invoice_items), select() returns a PromiseLike
    // We need to refine this mock if the code uses .select().single() vs .select()
    
    // Refined Mock Strategy for Chain
    const queryBuilder: any = {
      select: vi.fn(),
      insert: vi.fn(),
      eq: vi.fn(),
      single: vi.fn()
    };
    queryBuilder.select.mockReturnValue(queryBuilder);
    queryBuilder.insert.mockReturnValue(queryBuilder);
    queryBuilder.eq.mockReturnValue(queryBuilder);
    queryBuilder.single.mockResolvedValue({ data: mockInvoice, error: null });
    
    // Special handling for invoice_items (array return)
    // We can verify calls instead of perfect return types if we just check logic flow
    // But the service awaits the result.
    
    mockFrom.mockImplementation((table) => {
        if (table === 'user_roles') {
            return {
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: { tenant_id: mockTenantId }, error: null })
                    })
                })
            };
        }
        if (table === 'invoices') {
             return {
                insert: (data: any) => ({
                    select: () => ({
                        single: async () => ({ data: { ...data, id: 'invoice-123' }, error: null })
                    })
                })
             };
        }
        if (table === 'invoice_items') {
             return {
                insert: (data: any) => ({
                    select: async () => ({ data: data, error: null })
                })
             };
        }
        return queryBuilder;
    });
  });

  it('should create an invoice with calculated taxes', async () => {
    const request: CreateInvoiceRequest = {
      customer_id: 'cust-1',
      origin_address: { street: 'Origin', city: 'City', state: 'TX', zip: '75000', country: 'US' },
      destination_address: { street: 'Dest', city: 'LA', state: 'CA', zip: '90000', country: 'US' },
      issue_date: new Date(),
      due_date: new Date(),
      currency: 'USD',
      items: [
        { description: 'Item 1', quantity: 2, unit_price: 100, tax_code_id: 'TC1' }
      ]
    };

    // Mock Nexus: US-CA
    vi.mocked(TaxEngine.determineNexus).mockResolvedValue({
      hasNexus: true,
      jurisdictions: ['US-CA']
    });

    // Mock Calculation
    vi.mocked(TaxEngine.calculate).mockResolvedValue({
      totalTax: 16.5, // 8.25% of 200
      breakdown: [],
      lineItems: [
        { id: '0', taxAmount: 16.5, taxRate: 0.0825 }
      ]
    });

    const result = await InvoiceService.createInvoice(request);

    // Verify Tenant ID Lookup
    expect(mockFrom).toHaveBeenCalledWith('user_roles');
    
    // Verify Nexus Call
    expect(TaxEngine.determineNexus).toHaveBeenCalledWith({
      origin: request.origin_address,
      destination: request.destination_address,
      tenantId: mockTenantId
    });

    // Verify Tax Calculation
    expect(TaxEngine.calculate).toHaveBeenCalledWith(expect.objectContaining({
      jurisdictionCode: 'US-CA',
      items: expect.arrayContaining([
        expect.objectContaining({ amount: 200, taxCode: 'TC1' })
      ])
    }));

    // Verify Result
    expect(result.tax_total).toBe(16.5);
    expect(result.total_amount).toBe(216.5);
    expect(result.items).toHaveLength(1);
    expect(result.items![0].tax_amount).toBe(16.5);
    expect(result.items![0].total_amount).toBe(216.5);
  });
});

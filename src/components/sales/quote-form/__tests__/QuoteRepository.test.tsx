import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useQuoteRepositoryForm } from '../useQuoteRepository';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={createTestQueryClient()}>
        {children}
    </QueryClientProvider>
);

// Mock useCRM and useAuth
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn();
const mockGt = vi.fn();
const mockOrder = vi.fn();
const mockIs = vi.fn();
const mockRpc = vi.fn();

const mockFrom = vi.fn(() => ({
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  select: mockSelect,
}));

// Chain mocks
const mockChain: any = {
  maybeSingle: mockMaybeSingle,
  eq: mockEq,
  limit: mockLimit,
  gt: mockGt,
  order: mockOrder,
  is: mockIs,
  then: (resolve: any) => resolve({ data: [], error: null })
};

mockInsert.mockReturnValue({ select: mockSelect });
mockUpdate.mockReturnValue({ eq: mockEq });
mockDelete.mockReturnValue({ eq: mockEq });
mockSelect.mockReturnValue(mockChain);
mockEq.mockReturnValue(mockChain); // Allow chaining
mockGt.mockReturnValue(mockChain);
mockOrder.mockReturnValue(mockChain);
mockLimit.mockReturnValue(mockChain);
mockIs.mockReturnValue(mockChain);

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      from: mockFrom,
      rpc: mockRpc,
    },
    context: { tenantId: 'test-tenant' },
    supabase: { // Also mock supabase as it might be used for other things
        from: mockFrom,
    }
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    roles: [],
  }),
}));

vi.mock('../QuoteContext', () => ({
  useQuoteContext: () => ({
    resolvedTenantId: 'test-tenant',
    setResolvedTenantId: vi.fn(),
    setAccounts: vi.fn(),
    setContacts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    accounts: [],
    contacts: [],
    opportunities: [],
    serviceTypes: [],
  }),
}));

describe('useQuoteRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default success responses
    mockMaybeSingle.mockResolvedValue({ data: { id: 'new-quote-id' }, error: null });
    mockRpc.mockResolvedValue({ data: 'new-quote-id', error: null });
    mockInsert.mockReturnValue({ select: () => ({ maybeSingle: mockMaybeSingle }) });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  });

  it('should save a new quote using atomic RPC', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });
    
    const quoteData = {
      title: 'Test Quote',
      items: [
        {
          product_name: 'Item 1',
          quantity: 10,
          unit_price: 100,
          discount_percent: 5,
        },
      ],
      // ... other fields
    } as any;

    const id = await result.current.saveQuote({ data: quoteData });

    expect(mockRpc).toHaveBeenCalledWith('save_quote_atomic', expect.objectContaining({
        p_payload: expect.objectContaining({
            quote: expect.objectContaining({
                title: 'Test Quote',
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    product_name: 'Item 1',
                    quantity: 10,
                    unit_price: 100,
                    discount_percent: 5,
                })
            ])
        })
    }));
    expect(id).toBe('new-quote-id');
  });

  it('should update an existing quote using atomic RPC', async () => {
    const mockForm = { reset: vi.fn() } as any;
    const { result } = renderHook(() => useQuoteRepositoryForm({ form: mockForm }), { wrapper });
    
    const quoteData = {
      title: 'Updated Quote',
      items: [
        {
          product_name: 'Item 2',
          quantity: 5,
          unit_price: 200,
        },
      ],
    } as any;

    await result.current.saveQuote({ quoteId: 'existing-id', data: quoteData });

    expect(mockRpc).toHaveBeenCalledWith('save_quote_atomic', expect.objectContaining({
        p_payload: expect.objectContaining({
            quote: expect.objectContaining({
                id: 'existing-id',
                title: 'Updated Quote',
            }),
            items: expect.arrayContaining([
                expect.objectContaining({
                    product_name: 'Item 2',
                })
            ])
        })
    }));
  });
});

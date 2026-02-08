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
    },
    context: { tenantId: 'test-tenant' },
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
  }),
}));

describe('useQuoteRepository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default success responses
    mockMaybeSingle.mockResolvedValue({ data: { id: 'new-quote-id' }, error: null });
    mockInsert.mockReturnValue({ select: () => ({ maybeSingle: mockMaybeSingle }) });
    mockUpdate.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
    mockDelete.mockReturnValue({ eq: () => Promise.resolve({ error: null }) });
  });

  it('should save a new quote with items', async () => {
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

    expect(mockFrom).toHaveBeenCalledWith('quotes');
    expect(mockInsert).toHaveBeenCalled();
    expect(id).toBe('new-quote-id');

    // Verify items saving
    expect(mockFrom).toHaveBeenCalledWith('quote_items');
    expect(mockDelete).toHaveBeenCalled(); // Should clean up first
    expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        quote_id: 'new-quote-id',
        product_name: 'Item 1',
        quantity: 10,
        unit_price: 100,
        discount_percent: 5,
      })
    ]));
  });

  it('should update an existing quote and replace items', async () => {
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

    expect(mockFrom).toHaveBeenCalledWith('quotes');
    expect(mockUpdate).toHaveBeenCalled();
    
    // Verify items replacement
    expect(mockFrom).toHaveBeenCalledWith('quote_items');
    expect(mockDelete).toHaveBeenCalled(); // Should delete old items for existing-id
    expect(mockInsert).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({
        quote_id: 'existing-id',
        product_name: 'Item 2',
      })
    ]));
  });
});

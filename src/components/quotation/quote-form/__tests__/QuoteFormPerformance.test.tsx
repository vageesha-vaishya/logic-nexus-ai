
import { renderHook, waitFor } from '@testing-library/react';
import { useQuoteRepositoryForm } from '../useQuoteRepository';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCRM } from '@/hooks/useCRM';
import { useForm } from 'react-hook-form';

// Mock dependencies
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ roles: [] })
}));
vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({ log: vi.fn(), error: vi.fn() })
}));
vi.mock('../QuoteContext', () => ({
  useQuoteContext: () => ({
    resolvedTenantId: 'tenant-123',
    setResolvedTenantId: vi.fn(),
    setServices: vi.fn(),
    setAccounts: vi.fn(),
    setContacts: vi.fn(),
    setOpportunities: vi.fn(),
    accounts: [],
    contacts: [],
    opportunities: [],
    serviceTypes: [],
  })
}));

describe('useQuoteRepositoryForm Performance', () => {
  let queryClient: QueryClient;
  const mockScopedDb = {
    from: vi.fn(),
  };

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    (useCRM as any).mockReturnValue({
      supabase: {},
      scopedDb: mockScopedDb,
      context: { tenantId: 'tenant-123' },
    });
  });

  it('should finish hydration when core data loads, even if versions are slow', async () => {
    // Mock Core Data Query (Fast)
    mockScopedDb.from.mockImplementation((table: string) => {
      if (table === 'quotes') {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({ data: { id: 'q1', title: 'Test Quote' }, error: null })
            })
          })
        };
      }
      if (table === 'quote_items') {
        return {
          select: () => ({
            eq: () => ({
              order: () => Promise.resolve({ data: [], error: null })
            })
          })
        };
      }
      if (table === 'quote_cargo_configurations') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null })
          })
        };
      }
      if (table === 'quotation_versions') {
        return {
            select: () => ({
                eq: () => ({
                    order: () => ({
                        limit: () => ({
                            maybeSingle: async () => {
                                // Simulate slow network for versions
                                await new Promise(resolve => setTimeout(resolve, 100)); 
                                return { data: null, error: null };
                            }
                        })
                    })
                })
            })
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: () => ({ data: null }) }) }) };
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => {
      const form = useForm();
      return useQuoteRepositoryForm({ form, quoteId: 'q1' });
    }, { wrapper });

    // Initially loading
    expect(result.current.isHydrating).toBe(true);

    // Should become false quickly (when core data loads), even if versions are pending
    await waitFor(() => {
      expect(result.current.isHydrating).toBe(false);
    }, { timeout: 1000 });
    
    // Check that form was populated with core data
    // Note: We can't easily check form values here without more setup, 
    // but the isHydrating flag is the key indicator of UI blocking.
  });
});

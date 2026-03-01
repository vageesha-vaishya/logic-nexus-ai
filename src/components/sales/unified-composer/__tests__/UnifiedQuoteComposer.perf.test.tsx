
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { UnifiedQuoteComposer } from '../UnifiedQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useCRM } from '@/hooks/useCRM';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

// Mock Toast
const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast }),
}));

// Mock Router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useSearchParams: () => [new URLSearchParams({}), vi.fn()],
    useNavigate: () => vi.fn(),
  };
});

// Mock Auth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id' },
    profile: { role: 'sales_rep' },
    session: { access_token: 'fake-token' }
  }),
}));

// Mock Container Refs
vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [{ id: '20GP', code: '20GP', name: '20ft General' }],
    containerSizes: [{ id: '20', name: '20ft' }],
    loading: false
  }),
}));

// Mock Rate Fetching
vi.mock('@/hooks/useRateFetching', () => ({
  useRateFetching: () => ({
    results: [],
    loading: false,
    fetchRates: vi.fn(),
    error: null
  }),
  ContainerResolver: {},
}));

// Mock AI Advisor
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn().mockResolvedValue({ data: { compliant: true }, error: null }),
    loading: false
  }),
}));

// Mock Supabase Client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
      upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
    })),
    storage: {
        from: vi.fn(() => ({
            upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
        }))
    }
  },
}));

// Mock FinalizeSection to avoid complex rendering
vi.mock('../FinalizeSection', () => ({
  FinalizeSection: () => <div data-testid="finalize-section">Finalize Section</div>
}));

// Mock useCRM as a simple function that we can override in beforeEach
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('UnifiedQuoteComposer Performance', () => {
  let queryClient: QueryClient;
  let mockScopedDb: any;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Setup mockScopedDb
    const createChainableMock = () => {
      const chain: any = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: {}, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: {}, error: null }),
        order: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        then: vi.fn().mockImplementation((resolve: any) => resolve({ data: [], error: null })),
      };
      return chain;
    };

    mockScopedDb = {
      from: vi.fn((table?: string) => {
        const chain = createChainableMock();
        
        if (table === 'quotes') {
          chain.maybeSingle.mockResolvedValue({
            data: {
              id: 'test-quote-id',
              current_version_id: '00000000-0000-0000-0000-000000000001',
              transport_mode: 'ocean',
              origin: 'Test Origin',
              destination: 'Test Destination',
              cargo_details: {
                commodity: 'Test Commodity',
                total_weight_kg: 1000,
                total_volume_cbm: 10
              }
            },
            error: null
          });
        }
        
        return chain;
      }),
      rpc: vi.fn()
    };

    // Setup useCRM mock return value
    (useCRM as any).mockReturnValue({
      scopedDb: mockScopedDb,
      context: { tenantId: 'test-tenant', franchiseId: 'test-franchise' },
      supabase: {
          storage: {
              from: vi.fn(() => ({
                  upload: vi.fn().mockResolvedValue({ data: {}, error: null }),
                  getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test.com' } })
              }))
          }
      }
    });
  });

  it('reloads existing quote within 3 seconds', async () => {
    const startTime = performance.now();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer quoteId="test-quote-id" />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for the form to be populated
    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Commodity')).toBeInTheDocument();
    }, { timeout: 3000 });

    const endTime = performance.now();
    const duration = endTime - startTime;
    
    console.log(`Reload duration: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(3000);
  });

  it('initial render is fast (sub-second)', async () => {
    const startTime = performance.now();

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <UnifiedQuoteComposer />
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Wait for initial render (e.g. Origin field)
    await waitFor(() => {
      // Look for a label or placeholder that appears on initial load
      expect(screen.getByText('Origin')).toBeInTheDocument();
    }, { timeout: 1000 });

    const endTime = performance.now();
    const duration = endTime - startTime;

    console.log(`Initial render duration: ${duration.toFixed(2)}ms`);
    expect(duration).toBeLessThan(1000);
  });
});

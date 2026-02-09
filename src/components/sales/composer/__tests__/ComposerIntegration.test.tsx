import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';
import { QuoteStoreProvider } from '../store/QuoteStore';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

// Helper to create a chainable mock builder
const createMockBuilder = (mockData: any = []) => {
  const builder: any = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: Array.isArray(mockData) ? mockData[0] : mockData, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: Array.isArray(mockData) ? mockData[0] : mockData, error: null })),
    limit: vi.fn(() => builder),
    order: vi.fn(() => Promise.resolve({ data: mockData, error: null })),
    is: vi.fn(() => Promise.resolve({ data: mockData, error: null })),
    insert: vi.fn((data: any) => createMockBuilder([{ id: 'new-opt-1', ...data }])),
    update: vi.fn(() => builder),
    delete: vi.fn(() => builder),
    in: vi.fn(() => builder),
    then: (resolve: any) => Promise.resolve({ data: mockData, error: null }).then(resolve),
  };
  return builder;
};

// Service Mocks
vi.mock('@/services/pricing.service', () => ({
  PricingService: class {
    constructor() {}
    subscribeToUpdates(cb: any) { return { unsubscribe: () => {} }; }
  }
}));

vi.mock('@/services/QuoteOptionService', () => ({
  QuoteOptionService: class {
    constructor() {}
    addOptionToVersion() { return Promise.resolve(); }
  }
}));

// Mocks
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {
      client: {
        from: (table: string) => {
          if (table === 'charge_sides') {
             return createMockBuilder([{ id: 'buy-id', code: 'buy' }, { id: 'sell-id', code: 'sell' }]);
          }
          if (table === 'currencies') {
             return createMockBuilder([{ id: 'usd-id', code: 'USD', name: 'US Dollar', is_active: true }]);
          }
          return createMockBuilder([]);
        },
        auth: {
          getUser: () => Promise.resolve({ data: { user: { user_metadata: { tenant_id: 'test-tenant' } } } }),
        },
        channel: () => {
          const channelMock = {
            on: () => channelMock,
            subscribe: (cb: any) => {
               if(cb) cb('SUBSCRIBED');
               return { unsubscribe: () => {} };
            }
          };
          return channelMock;
        },
      },
      from: (table: string) => {
           if (table === 'charge_sides') {
              return createMockBuilder([{ id: 'buy-id', code: 'buy' }, { id: 'sell-id', code: 'sell' }]);
           }
           if (table === 'currencies') {
              return createMockBuilder([{ id: 'usd-id', code: 'USD', name: 'US Dollar', is_active: true }]);
           }
           return createMockBuilder([]);
       }
    },
    context: { tenantId: 'test-tenant' },
  }),
}));

const invokeAiAdvisorMock = vi.fn().mockResolvedValue({ 
  data: { 
    type: 'General Cargo', 
    hts: '1234.56.78', 
    compliant: true 
  } 
});

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: invokeAiAdvisorMock,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/services/quotation/LandedCostService', () => ({
  LandedCostService: {
    calculate: vi.fn().mockResolvedValue({
      summary: { total_duty: 100, estimated_mpf: 25 },
      breakdown: []
    }),
  },
}));

// Mock ResizeObserver for Tabs
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock window.print
window.print = vi.fn();

// Mock scrollIntoView
window.HTMLElement.prototype.scrollIntoView = vi.fn();

describe('Composer Integration', () => {
  const defaultProps = {
    quoteId: 'quote-123',
    versionId: 'ver-123',
    tenantId: 'test-tenant'
  };

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient.clear();
    window.history.pushState({}, '', '/');
  });

  it('handles rich text input in notes', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer {...defaultProps} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Quote Details').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    const notesInput = screen.getByLabelText('Notes');
    await user.type(notesInput, 'This is a rich text note.\nIt has multiple lines.');

    expect(notesInput).toHaveValue('This is a rich text note.\nIt has multiple lines.');
  });

  it('triggers AI compliance check', async () => {
    const user = userEvent.setup();
    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer {...defaultProps} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Quote Details').length).toBeGreaterThan(0);
    }, { timeout: 3000 });

    // 1. Open the commodity selection popover (button with role combobox)
    const comboboxes = screen.getAllByRole('combobox');
    const commodityTrigger = comboboxes.find(c => c.textContent?.includes('Search commodity'));
    if (!commodityTrigger) throw new Error('Commodity trigger not found');
    await user.click(commodityTrigger);

    // 2. Type in the search input
    const searchInput = screen.getByPlaceholderText('Type to search...');
    await user.type(searchInput, 'Test Commodity');

    // 3. Select the custom option "Use 'Test Commodity'"
    const useOption = await screen.findByText(/Use "Test Commodity"/i);
    await user.click(useOption);

    // 4. Find and click AI Check button
    const aiButton = screen.getByRole('button', { name: /Run AI Compliance Check/i });
    await user.click(aiButton);

    // 5. Verify AI advisor was called
    await waitFor(() => {
      expect(invokeAiAdvisorMock).toHaveBeenCalled();
    });
  });

  it('generates PDF preview', async () => {
    const user = userEvent.setup();
    const initialState = {
        currentStep: 4, // Review & Save step
        quoteData: {
            reference: 'TEST-REF',
            origin: 'NYC',
            destination: 'LON',
            items: []
        }
    };

    render(
      <QueryClientProvider client={queryClient}>
        <MultiModalQuoteComposer {...defaultProps} initialState={initialState} />
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('Review & Save')).toBeInTheDocument();
    });

    // Find "Generate Documents" button
    const generateButton = screen.getByRole('button', { name: /Generate Documents/i });
    await user.click(generateButton);

    // Check if dialog opens
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Document Preview')).toBeVisible();
    });
  });
});

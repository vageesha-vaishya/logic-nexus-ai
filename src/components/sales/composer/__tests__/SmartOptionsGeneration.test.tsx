import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';
import { act } from 'react';

// Mock dependencies
const mockInvokeAiAdvisor = vi.fn();
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: mockInvokeAiAdvisor
  })
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

const mockScopedDb = {
  from: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  single: vi.fn().mockReturnThis(),
  maybeSingle: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  client: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user: {
            user_metadata: {
              tenant_id: 'tenant-123'
            }
          }
        },
        error: null
      })
    }
  }
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb
  })
}));

// Mock child components to simplify testing
vi.mock('../QuoteOptionsOverview', () => ({
  QuoteOptionsOverview: ({ options, onGenerateSmartOptions }: any) => (
    <div data-testid="quote-options-overview">
      <div data-testid="options-count">Rate Options ({options.length})</div>
      <button onClick={onGenerateSmartOptions} data-testid="generate-smart-btn">
        Generate Smart Options
      </button>
      <ul>
        {options.map((opt: any) => (
          <li key={opt.id} data-testid={`option-${opt.id}`}>{opt.option_name}</li>
        ))}
      </ul>
    </div>
  )
}));

describe('MultiModalQuoteComposer - Smart Options Generation', () => {
  const mockQuoteId = 'quote-123';
  const mockVersionId = 'version-123';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock implementation for DB calls
    // 1. Load reference data (service types, etc.)
    mockScopedDb.from.mockImplementation((table: string) => {
      // Return chainable mock object
      const chain = {
        select: vi.fn().mockReturnThis(),
                eq: vi.fn().mockReturnThis(),
                is: vi.fn().mockReturnThis(),
                order: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
      };

      // Mock specific table responses
      if (table === 'quotation_version_options') {
        chain.select = vi.fn().mockReturnValue({
           eq: vi.fn().mockImplementation((field, value) => {
               if (field === 'id') {
                   return {
                       single: vi.fn().mockResolvedValue({ data: { id: value, carrier_name: 'Test Carrier' }, error: null })
                   };
               }
               return {
                   order: vi.fn().mockResolvedValue({ data: [], error: null }),
                   maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
               };
           })
        });
        // Handle insert
        chain.insert = vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { id: 'new-opt-1' }, error: null }),
                        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'new-opt-1' }, error: null })
                    })
                });
      }
      
      // Handle reference tables
      if (['service_types', 'transport_modes', 'charge_categories', 'charge_bases', 'currencies', 'trade_directions', 'container_types', 'container_sizes', 'carriers'].includes(table)) {
          chain.select = vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Test' }], error: null })
          });
      }

      return chain;
    });
  });

  it('automatically creates default option when none exist', async () => {
    await act(async () => {
      render(<MultiModalQuoteComposer quoteId={mockQuoteId} versionId={mockVersionId} />);
    });

    // Need to switch to overview mode to see the count
    const backButton = screen.getByText('Back to Overview');
    fireEvent.click(backButton);

    expect(screen.getByTestId('options-count')).toHaveTextContent('Rate Options (1)');
  });

  it('triggers AI advisor and refreshes list on "Generate Smart Options" click', async () => {
    // Setup mocks for this specific test
    
    // 1. Initial empty options
    const mockSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation((field, value) => {
            if (field === 'id') {
                return {
                    single: vi.fn().mockResolvedValue({ data: { id: value, carrier_name: 'Test Carrier' }, error: null })
                };
            }
            return {
                order: vi.fn().mockResolvedValueOnce({ data: [], error: null }) // Initial load
                      .mockResolvedValueOnce({ data: [ // After generation
                          { id: 'opt-1', option_name: 'Smart Option 1', ai_generated: true }
                      ], error: null })
            };
        })
    });

    mockScopedDb.from.mockImplementation((table) => {
        if (table === 'quotation_version_options') {
             return { 
                 select: mockSelect,
                 insert: vi.fn().mockReturnValue({
                     select: vi.fn().mockReturnValue({
                         single: vi.fn().mockResolvedValue({ data: { id: 'opt-1' }, error: null }),
                         maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'opt-1' }, error: null })
                     })
                 })
             } as any;
        }
        if (table === 'quotation_version_option_legs') {
            return {
                insert: vi.fn().mockResolvedValue({ data: { id: 'leg-1' }, error: null })
            } as any;
        }
        // Default for others
        return {
            select: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: [{ id: '1', name: 'Test' }], error: null })
            })
        } as any;
    });

    // Mock AI response
    mockInvokeAiAdvisor.mockResolvedValue({
      data: {
        options: [
          {
            carrier: 'AI Carrier',
            serviceType: 'Direct',
            transitTime: '20 days',
            price: 1000,
            co2: 500,
            reliability: 'High'
          }
        ],
        market_analysis: 'Market is stable.'
      },
      error: null
    });

    await act(async () => {
      render(<MultiModalQuoteComposer quoteId={mockQuoteId} versionId={mockVersionId} />);
    });

    // Switch to overview
    fireEvent.click(screen.getByText('Back to Overview'));

    // Find and click generate button
    const generateBtn = screen.getByTestId('generate-smart-btn');
    
    await act(async () => {
      fireEvent.click(generateBtn);
    });

    // Verify loading toast
    expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
      title: "Generating Options"
    }));

    // Verify AI call
    expect(mockInvokeAiAdvisor).toHaveBeenCalledWith(expect.objectContaining({
      action: 'generate_smart_quotes'
    }));

    // Verify Success toast
    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: "Success",
            description: expect.stringContaining("Generated 1 smart options")
        }));
    });
  });

  it('handles AI advisor errors gracefully', async () => {
    mockInvokeAiAdvisor.mockResolvedValue({
      data: null,
      error: { message: 'AI Service Unavailable' }
    });

    await act(async () => {
      render(<MultiModalQuoteComposer quoteId={mockQuoteId} versionId={mockVersionId} />);
    });

    fireEvent.click(screen.getByText('Back to Overview'));
    
    await act(async () => {
      fireEvent.click(screen.getByTestId('generate-smart-btn'));
    });

    await waitFor(() => {
        expect(mockToast).toHaveBeenCalledWith(expect.objectContaining({
            title: "Error",
            description: "AI Service Unavailable",
            variant: "destructive"
        }));
    });
  });
});


import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickQuoteModal } from '../QuickQuoteModal';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock global fetch
global.fetch = vi.fn(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ 
        unit: 'kg', 
        confidence: 0.9,
        hts: '1234.56.7890',
        type: 'General',
        options: [],
        compliant: true
    }),
    text: () => Promise.resolve(''),
  })
) as any;

// Mocks
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));

vi.mock('@/hooks/useDebug', () => ({
    useDebug: () => ({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn()
    })
}));

vi.mock('@/lib/quote-mapper', () => ({
    mapOptionToQuote: vi.fn((opt) => ({
        ...opt,
        option_name: opt.option_name || 'Simulated Service',
        total_amount: opt.total_amount || 2000,
        currency: 'USD',
        transit_time: { details: '5 days' },
        legs: [],
        charges: [],
        total_co2_kg: 20,
        source_attribution: 'Simulation Engine (Fallback)'
    }))
}));

// Mock Simulation Engine
vi.mock('@/lib/simulation-engine', () => ({
    generateSimulatedRates: vi.fn(() => [
        {
            id: 'sim_1',
            option_name: 'Fallback Simulated Rate',
            carrier_name: 'Simulated Carrier',
            total_amount: 2000,
            currency: 'USD',
            transit_time: { details: '5 days' },
            source_attribution: 'Simulation Engine (Fallback)',
            valid_to: '2025-12-31'
        }
    ])
}));

const mocks = vi.hoisted(() => {
    const chain = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        then: vi.fn((cb: any) => cb({ data: [], error: null })),
    };
    
    const from = vi.fn(() => chain);
    // Mock Invoke to FAIL
    const invoke = vi.fn().mockResolvedValue({
        data: null,
        error: { message: "Legacy Rate Engine Failed" }
    });
    const getSession = vi.fn().mockResolvedValue({ data: { session: { access_token: 'token' } } });
    const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } });

    const mockSupabase = {
        from,
        functions: { invoke },
        auth: { getSession, getUser }
    };

    return {
        supabaseChain: chain,
        from,
        invoke,
        getSession,
        getUser,
        mockSupabase // Stable object
    };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: mocks.mockSupabase,
    context: { tenantId: 'test-tenant' },
    crmData: {
        locations: [
            { id: '1', code: 'JFK', name: 'New York', type: 'airport' },
            { id: '2', code: 'LHR', name: 'London', type: 'airport' }
        ],
        commodities: [
            { id: '1', name: 'Electronics' },
            { id: '2', name: 'Textiles' }
        ]
    }
  })
}));

vi.mock('@/integrations/supabase/client', () => {
    return {
        supabase: mocks.mockSupabase,
        isSupabaseConfigured: true,
    };
});

vi.mock('../QuoteResultsList', () => ({
    QuoteResultsList: ({ results }: any) => (
        <div data-testid="quote-results-list">
            {(results || []).map((q: any) => (
                <div key={q.id} data-testid="quote-item">
                    {q.carrier_name} - {q.source_attribution}
                </div>
            ))}
        </div>
    )
}));

vi.mock('../QuoteComparisonView', () => ({
    QuoteComparisonView: () => <div data-testid="quote-comparison-view">Mocked Comparison View</div>
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ value, onChange, placeholder, "data-testid": testId, ...props }: any) => (
    <input 
        data-testid={testId || `location-${placeholder}`} 
        value={value || ''} 
        onChange={e => onChange(e.target.value, { code: e.target.value, name: e.target.value, location_code: e.target.value, location_name: e.target.value, city: 'City', country: 'Country' })} 
        placeholder={placeholder}
        {...props}
    />
  )
}));

vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
    SharedCargoInput: ({ value, onChange }: any) => (
        <div data-testid="shared-cargo-input">
            <input 
                data-testid="cargo-description"
                placeholder="Description"
                value={value?.description || ''}
                onChange={e => onChange({ ...value, description: e.target.value })}
            />
             <input 
                data-testid="cargo-weight"
                placeholder="Weight"
                value={value?.weight?.value || ''}
                onChange={e => onChange({ ...value, weight: { value: e.target.value, unit: 'kg' } })}
            />
        </div>
    )
}));

describe('QuickQuoteModal Fallback', () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    });

    const renderComponent = () => {
        return render(
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <QuickQuoteModal>
                        <button>Open Quote</button>
                    </QuickQuoteModal>
                </BrowserRouter>
            </QueryClientProvider>
        );
    };

    it('uses simulation fallback when legacy rate engine fails', async () => {
        renderComponent();

        // Open modal
        fireEvent.click(screen.getByText('Open Quote'));
        
        await waitFor(() => {
            expect(screen.getByTestId('location-origin')).toBeInTheDocument();
        });

        // Fill form
        const originInput = screen.getByTestId('location-origin');
        const destInput = screen.getByTestId('location-destination');
        fireEvent.change(originInput, { target: { value: 'JFK' } });
        fireEvent.change(destInput, { target: { value: 'LHR' } });

        const cargoDesc = screen.getByTestId('cargo-description');
        const cargoWeight = screen.getByTestId('cargo-weight');
        fireEvent.change(cargoDesc, { target: { value: 'Test Cargo' } });
        fireEvent.change(cargoWeight, { target: { value: '100' } });

        // Generate Quote
        const generateButton = screen.getByTestId('generate-quote-btn');
        fireEvent.click(generateButton);

        // Expect results list to appear
        await waitFor(() => {
            expect(screen.getByTestId('quote-results-list')).toBeInTheDocument();
        });

        // Verify fallback content is present
        // The QuoteResultsList mock renders the carrier name and source attribution
        expect(screen.getByText(/Simulated Carrier/)).toBeInTheDocument();
        expect(screen.getByText(/Simulation Engine \(Fallback\)/)).toBeInTheDocument();
    });
});

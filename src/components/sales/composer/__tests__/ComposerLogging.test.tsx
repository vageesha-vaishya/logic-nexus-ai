import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MultiModalQuoteComposer } from '../../MultiModalQuoteComposer';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: any) => <div>{children}</div>,
  CardHeader: ({ children }: any) => <div>{children}</div>,
  CardTitle: ({ children }: any) => <div>{children}</div>,
  CardDescription: ({ children }: any) => <div>{children}</div>,
  CardContent: ({ children }: any) => <div>{children}</div>
}));
vi.mock('@/components/ui/button', () => ({
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>
}));
vi.mock('@/components/ui/badge', () => ({
  Badge: ({ children }: any) => <span>{children}</span>
}));
vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div />
}));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children, open }: any) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogHeader: ({ children }: any) => <div>{children}</div>,
  DialogFooter: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <div>{children}</div>,
  DialogDescription: ({ children }: any) => <div>{children}</div>
}));
vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: any) => <label>{children}</label>
}));

// Mock hooks
const mockDebug = {
  info: vi.fn(),
  log: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
};

vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => mockDebug
}));

const mockToast = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: mockToast })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'token' }
  })
}));

// Mock Scoped DB with chaining and table-specific data support
const createMockBuilder = (dataMap: Record<string, any>) => {
  const getBuilder = (data: any) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? data[0] : data, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: Array.isArray(data) ? (data[0] || null) : data, error: null }),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      then: vi.fn((resolve: any) => {
          return resolve({ data, error: null });
      })
    };
    return builder;
  };

  const defaultBuilder = getBuilder([]);

  // The root object behaves like a client with .from()
  return {
    ...defaultBuilder,
    from: vi.fn((table: string) => {
              const data = dataMap[table] || [];
              return getBuilder(data);
            }),
    client: {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { user_metadata: { tenant_id: 'tenant-1' } } } })
      }
    }
  };
};

const mockScopedDb = createMockBuilder({
  quotes: [{ 
    id: 'quote-1', 
    tenant_id: 'tenant-1', 
    quote_number: 'Q123', 
    status: 'draft',
    total_weight: 500,
    total_volume: 2,
    cargo_details: { commodity: 'Electronics' }
  }],
  quotation_versions: [{ id: 'ver-1', tenant_id: 'tenant-1' }],
  quotation_version_options: [{ 
    id: 'opt-1', 
    option_name: 'Option 1',
    carrier_name: 'Test Carrier',
    quotation_version_id: 'ver-1',
    tenant_id: 'tenant-1',
    quote_currency_id: 'curr-1'
  }, { 
    id: 'opt-2', 
    option_name: 'Option 2',
    carrier_name: 'Test Carrier 2',
    quotation_version_id: 'ver-1',
    tenant_id: 'tenant-1',
    quote_currency_id: 'curr-1'
  }],
  quotation_version_option_legs: [
    { 
      id: 'leg-1', 
      quotation_version_option_id: 'opt-1',
      mode: 'air', 
      origin_location: 'NYC',
      destination_location: 'LON',
      leg_type: 'transport',
      service_type_id: 'st-1',
      sort_order: 0,
      quote_charges: [
        {
          id: 'chg-1',
          category_id: 'cat-1',
          basis_id: 'basis-1',
          currency_id: 'curr-1',
          charge_sides: { code: 'buy' },
          charge_categories: { name: 'Freight', code: 'freight' },
          charge_bases: { name: 'Per Kg', code: 'kg' },
          currencies: { code: 'USD', symbol: '$' },
          quantity: 100,
          rate: 1.5,
          amount: 150
        },
        {
          id: 'chg-2',
          category_id: 'cat-1',
          basis_id: 'basis-1',
          currency_id: 'curr-1',
          charge_sides: { code: 'sell' },
          charge_categories: { name: 'Freight', code: 'freight' },
          charge_bases: { name: 'Per Kg', code: 'kg' },
          currencies: { code: 'USD', symbol: '$' },
          quantity: 100,
          rate: 2.0,
          amount: 200
        }
      ]
    }
  ],
  quote_charges: [], // Global charges
  transport_modes: [{ id: 'tm-1', code: 'air', name: 'Air' }],
  service_types: [{ id: 'st-1', name: 'Standard Air', transport_modes: { code: 'air' } }],
  charge_categories: [{ id: 'cat-1', name: 'Freight', code: 'freight' }],
  charge_bases: [{ id: 'basis-1', name: 'Per Kg', code: 'kg' }],
  currencies: [{ id: 'curr-1', code: 'USD', symbol: '$' }],
  trade_directions: [],
  container_types: [],
  container_sizes: [],
  providers: [],
  charge_sides: [{ id: 'side-buy', code: 'buy' }, { id: 'side-sell', code: 'sell' }]
});


// Mock PricingService
vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: class {
      subscribeToUpdates = vi.fn().mockReturnValue({ unsubscribe: vi.fn() });
      calculatePrice = vi.fn().mockResolvedValue({ total: 100, currency: 'USD' });
    }
  };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    supabase: {
      from: () => mockScopedDb
    },
    context: { tenant_id: 'tenant-1' }
  })
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({ id: 'quote-1' }),
    useNavigate: () => vi.fn(),
    useLocation: () => ({ search: '' })
  };
});

// Mock child components to simplify rendering
vi.mock('../QuoteDetailsStep', () => ({
  QuoteDetailsStep: () => <div data-testid="quote-details-step">Quote Details Step</div>
}));
vi.mock('../LegsConfigurationStep', () => ({
  LegsConfigurationStep: ({ onRemoveLeg, legs }: any) => (
    <div data-testid="legs-step">
      {legs.map((leg: any) => (
        <button key={leg.id} onClick={() => onRemoveLeg(leg.id)}>
          Remove Leg {leg.id}
        </button>
      ))}
    </div>
  )
}));
vi.mock('../ChargesManagementStep', () => ({
  ChargesManagementStep: ({ onRemoveCharge, legs }: any) => (
    <div data-testid="charges-step">
      {legs.map((leg: any) => 
        leg.charges.map((c: any, idx: number) => (
          <button key={`${leg.id}-${idx}`} onClick={() => onRemoveCharge(leg.id, idx)}>
            Remove Charge {leg.id} {idx}
          </button>
        ))
      )}
    </div>
  )
}));
vi.mock('../ReviewAndSaveStep', () => ({
  ReviewAndSaveStep: () => <div data-testid="review-step">Review Step</div>
}));
vi.mock('../BasisConfigModal', () => ({
  BasisConfigModal: () => <div data-testid="basis-modal">Basis Modal</div>
}));
vi.mock('../DeleteConfirmDialog', () => ({
  DeleteConfirmDialog: ({ open, onConfirm }: any) => (
    open ? <div data-testid="delete-dialog"><button onClick={onConfirm}>Confirm Delete</button></div> : null
  )
}));
vi.mock('../QuotationWorkflowStepper', () => ({
  QuotationWorkflowStepper: ({ currentStep }: any) => (
    <div data-testid="stepper">Current Step: {currentStep}</div>
  )
}));
vi.mock('../SaveProgress', () => ({
  SaveProgress: () => <div data-testid="save-progress">Save Progress</div>
}));
vi.mock('../ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <div>{children}</div>
}));
vi.mock('../ValidationFeedback', () => ({
  ValidationFeedback: () => <div data-testid="validation-feedback">Validation Feedback</div>
}));
vi.mock('../QuoteOptionsOverview', () => ({
  QuoteOptionsOverview: ({ onSelect }: any) => (
    <div data-testid="options-overview">
      <button data-testid="select-option-opt-1" onClick={() => onSelect('opt-1')}>Select Option 1</button>
    </div>
  )
}));

describe('MultiModalQuoteComposer Logging', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
    // vi.useFakeTimers();
    // Mock performance.now
    vi.spyOn(performance, 'now').mockReturnValue(1000);
  });

  afterEach(() => {
    // vi.useRealTimers();
  });

  const renderComponent = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <MultiModalQuoteComposer quoteId="quote-1" versionId="ver-1" optionId="opt-1" />
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it('logs performance metrics when saving quotation', async () => {
    renderComponent();
    
    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByText('Quote Options:')).toBeInTheDocument();
    }, { timeout: 3000 });

    const nextButton = await screen.findByText('Next');
    
    // Ensure Step 1 is valid
    await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(nextButton); // To Step 2
    
    // Wait for Step 2
    await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
    }, { timeout: 2000 });
    
    fireEvent.click(nextButton); // To Step 3

    // Wait for Step 3
    await waitFor(() => {
        expect(nextButton).not.toBeDisabled();
    });

    fireEvent.click(nextButton); // To Step 4
    
    const saveButton = await screen.findByText('Save Quotation');
    expect(saveButton).toBeDefined();

    // Mock performance.now to advance time
    let time = 1000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
        const t = time;
        time += 500;
        return t;
    });

    await act(async () => {
      fireEvent.click(saveButton);
    });

    await waitFor(() => {
      // Check if start log was called
      expect(mockDebug.info).toHaveBeenCalledWith(
        'Starting quotation save...',
        expect.any(Object)
      );

      // Check if success log was called with duration
      expect(mockDebug.log).toHaveBeenCalledWith(
        'Quotation saved successfully',
        expect.objectContaining({
          duration: expect.stringMatching(/^\d+\.\d+ms$/)
        })
      );
    });
  });

  it('logs performance metrics when removing a leg', async () => {
    renderComponent();

    // Wait for load
    await waitFor(() => expect(screen.getByText('Quote Options:')).toBeInTheDocument());

    const nextButton = screen.getByText('Next');
    
    await waitFor(() => expect(nextButton).not.toBeDisabled());
    fireEvent.click(nextButton); // Go to Step 2

    // Wait for Step 2 (LegsConfigurationStep mocked)
    await waitFor(() => expect(screen.getByTestId('legs-step')).toBeInTheDocument());

    // Find Remove Leg button (mock renders "Remove Leg {id}")
    const removeLegButtons = await screen.findAllByText(/Remove Leg/i);
    const removeLegButton = removeLegButtons[0];
    
    // Mock performance for this action
    let time = 2000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
        const t = time;
        time += 250;
        return t;
    });

    // Click Remove Leg (triggers dialog)
    fireEvent.click(removeLegButton);

    // Confirm dialog
    const confirmButton = await screen.findByText('Confirm Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(mockDebug.info).toHaveBeenCalledWith('Removing leg', expect.any(Object));
      expect(mockDebug.log).toHaveBeenCalledWith(
        expect.stringContaining('Leg removed'),
        expect.objectContaining({
            duration: expect.stringMatching(/^\d+\.\d+ms$/)
        })
      );
    });
  });

  it('logs performance metrics when removing a charge', async () => {
    renderComponent();

    // Wait for load
    await waitFor(() => expect(screen.getByText('Quote Options:')).toBeInTheDocument());

    const nextButton = screen.getByText('Next');
    
    await waitFor(() => expect(nextButton).not.toBeDisabled());
    fireEvent.click(nextButton); // Step 2
    
    await waitFor(() => expect(nextButton).not.toBeDisabled());
    fireEvent.click(nextButton); // Step 3

    // Wait for Step 3 (ChargesManagementStep mocked)
    await waitFor(() => expect(screen.getByTestId('charges-step')).toBeInTheDocument());

    // Find Remove Charge button
    const removeChargeButtons = await screen.findAllByText(/Remove Charge/i);
    const removeChargeBtn = removeChargeButtons[0];

    // Mock performance
    let time = 3000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
        const t = time;
        time += 150;
        return t;
    });

    fireEvent.click(removeChargeBtn);

    // Confirm dialog
    const confirmButton = await screen.findByText('Confirm Delete');
    fireEvent.click(confirmButton);

    await waitFor(() => {
        expect(mockDebug.info).toHaveBeenCalledWith('Removing charge', expect.any(Object));
        expect(mockDebug.log).toHaveBeenCalledWith(
            expect.stringContaining('Charge removed'),
            expect.objectContaining({
                duration: expect.stringMatching(/^\d+\.\d+ms$/)
            })
        );
    });
  });

  it('logs performance metrics when deleting an option', async () => {
        // Mock window.confirm
        vi.spyOn(window, 'confirm').mockReturnValue(true);

        renderComponent();
        
        // Wait for load
        await waitFor(() => {
            const inComposer = screen.queryByText('Quote Options:');
            const inOverview = screen.queryByTestId('options-overview');
            expect(inComposer || inOverview).toBeInTheDocument();
        });

        // If in overview, switch to composer
        if (screen.queryByTestId('options-overview')) {
            fireEvent.click(screen.getByTestId('select-option-opt-1'));
        }
        
        // Wait for option to be rendered
        await waitFor(() => {
            expect(screen.getByText('Option 1')).toBeInTheDocument();
        });

    // Find delete button for opt-1
    const deleteButton = await screen.findByTestId('delete-option-btn-opt-1');
    
    // Mock performance with robust implementation
    let time = 4000;
    vi.spyOn(performance, 'now').mockImplementation(() => {
        const t = time;
        time += 100;
        return t;
    });

    fireEvent.click(deleteButton);

    await waitFor(() => {
         expect(mockDebug.info).toHaveBeenCalledWith('Deleting quote option', expect.any(Object));
         expect(mockDebug.log).toHaveBeenCalledWith(
             'Option deleted successfully',
             expect.objectContaining({
                 duration: expect.stringMatching(/^\d+\.\d+ms$/)
             })
         );
    });
  });
});

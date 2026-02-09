
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QuoteFormRefactored } from '../QuoteFormRefactored';
import { vi, describe, it, expect, beforeAll } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'fs';
import path from 'path';

// Mock UI Select component
vi.mock('@/components/ui/select', async () => {
  const React = await vi.importActual('react');
  const SelectContext = (React as any).createContext(null);

  return {
    Select: ({ onValueChange, value, children }: any) => (
      <SelectContext.Provider value={{ onValueChange, value }}>
        <div data-testid="mock-select-root">{children}</div>
      </SelectContext.Provider>
    ),
    SelectTrigger: ({ children, ...props }: any) => (
       <div {...props} role="button">
         {children}
       </div>
    ),
    SelectValue: ({ placeholder }: any) => <span>{placeholder}</span>,
    SelectContent: ({ children }: any) => (
       <div data-testid="mock-select-content">{children}</div>
    ),
    SelectItem: ({ value, children }: any) => {
      const context = (React as any).useContext(SelectContext);
      return (
        <div 
           role="option" 
           onClick={() => context?.onValueChange(value)}
           data-value={value}
        >
          {children}
        </div>
      );
    },
    SelectGroup: ({ children }: any) => <div>{children}</div>,
    SelectLabel: ({ children }: any) => <div>{children}</div>,
  };
});

// Mock ResizeObserver
beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    message: vi.fn(),
  }
}));

// Mock VisualHTSBrowser
vi.mock('@/components/hts/VisualHTSBrowser', () => ({
  VisualHTSBrowser: () => <div>Mocked VisualHTSBrowser</div>
}));

// Mock SharedCargoInput
vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: ({ onChange }: any) => (
    <input 
      data-testid="mock-cargo-input"
      onChange={(e) => onChange({ 
        commodity: { description: e.target.value, id: '123' }, 
        dimensions: { l:1, w:1, h:1, unit:'cm' }, 
        weight: { value:1, unit:'kg' } 
      })} 
    />
  )
}));

// Mock MultiModalQuoteComposer
vi.mock('@/components/sales/MultiModalQuoteComposer', () => ({
  MultiModalQuoteComposer: () => <div>Mocked Composer</div>
}));

// Mock useFormDebug
vi.mock('@/hooks/useFormDebug', () => ({
  useFormDebug: () => ({
    logValidationErrors: vi.fn(),
    logSubmit: vi.fn(),
    logResponse: vi.fn(),
    logError: vi.fn()
  })
}));

// Mock useAuth
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'test-user', email: 'test@example.com' },
    session: { access_token: 'test-token' }
  })
}));

// Mock useQuoteRepository
const saveQuoteMock = vi.fn().mockResolvedValue('test-quote-id');
vi.mock('../useQuoteRepository', () => ({
  useQuoteRepositoryForm: () => ({
    saveQuote: saveQuoteMock,
    isHydrating: false
  })
}));

// Mock QuoteContext
vi.mock('../QuoteContext', () => ({
  QuoteDataProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useQuoteContext: () => ({
    serviceTypes: [
        { id: 'st-1', name: 'Ocean FCL', code: 'OCEAN_FCL' },
        { id: 'st-2', name: 'Air Freight', code: 'AIR' }
    ],
    services: [
        { id: 's-1', service_name: 'Standard Ocean', service_type_id: 'st-1' },
        { id: 's-2', service_name: 'Express Air', service_type_id: 'st-2' }
    ],
    carriers: [
        { id: 'c-1', carrier_name: 'Maersk', carrier_type: 'ocean' },
        { id: 'c-2', carrier_name: 'Emirates', carrier_type: 'air_cargo' }
    ],
    ports: [
        { id: 'p-1', name: 'Shanghai', code: 'CNSHA', country_code: 'CN' },
        { id: 'p-2', name: 'Los Angeles', code: 'USLAX', country_code: 'US' }
    ],
    accounts: [],
    contacts: [],
    opportunities: [],
    isLoadingOpportunities: false,
    setResolvedTenantId: vi.fn(),
    resolvedTenantId: 'test-tenant',
    setAccounts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    setContacts: vi.fn(),
    setResolvedServiceLabels: vi.fn()
  })
}));

// Mock useQuoteData
vi.mock('../useQuoteData', () => ({
  useQuoteData: () => ({
    serviceTypes: [],
    services: [],
    carriers: [],
    ports: [],
    accounts: [],
    contacts: [],
    opportunities: [],
    isLoadingOpportunities: false,
    setResolvedTenantId: vi.fn(),
    resolvedTenantId: 'test-tenant',
    setAccounts: vi.fn(),
    setOpportunities: vi.fn(),
    setServices: vi.fn(),
    setContacts: vi.fn(),
    setResolvedServiceLabels: vi.fn()
  })
}));

// Mock useCRM with proper thenable/builder pattern and STABLE object reference
const mockSupabase = {
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
};

vi.mock('@/hooks/useCRM', () => {
  // Create a stable builder factory
  const createMockBuilder = (data: any = []) => {
    const builder: any = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      then: (resolve: any) => resolve({ data, error: null }),
    };
    return builder;
  };

  // Configure the stable mockSupabase
  // We need to use the one defined above, but vi.mock runs in a separate scope/hoisted.
  // So we must define it inside or use vi.hoisted.
  // However, simple variable capture doesn't work well with vitest hoisting unless strictly handled.
  // EASIEST FIX: Define the object inside the mock factory but memoize/reuse it if possible?
  // No, easiest is to use a stable object structure that doesn't change reference? 
  // OR just remove [supabase] dependency in the component code (I can't change component code easily).
  // So I must ensure useCRM returns the SAME supabase object.
  
  const stableSupabase = {
    from: () => createMockBuilder([]),
    rpc: () => Promise.resolve({ data: [], error: null }),
  };

  return {
    useCRM: () => ({
      supabase: stableSupabase,
      context: { tenantId: 'test-tenant' },
      scopedDb: {
          from: () => createMockBuilder([]),
      }
    })
  };
});

// Mock PluginRegistry
vi.mock('@/services/plugins/PluginRegistry', () => ({
  PluginRegistry: {
    getPlugin: () => ({
      getQuotationEngine: () => ({
        calculate: () => Promise.resolve({
          totalAmount: 1000,
          breakdown: { freight: 1000 }
        })
      })
    })
  }
}));

// Mock PricingService
vi.mock('@/services/pricing.service', () => ({
  PricingService: class {
    calculatePriceWithRules = vi.fn().mockResolvedValue({
      sellPrice: 1200,
      buyPrice: 1000,
      marginAmount: 200,
      appliedRules: []
    });
  }
}));

const createTestQueryClient = () => new QueryClient({
    defaultOptions: {
        queries: {
            retry: false,
        },
    },
});

describe('QuoteFormRefactored', () => {
  const renderComponent = (props = {}) => {
    const queryClient = createTestQueryClient();
    return render(
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <QuoteFormRefactored {...props} />
        </BrowserRouter>
      </QueryClientProvider>
    );
  };

  it('renders all main sections', async () => {
    renderComponent();
    
    // Check for section headers (numbered steps)
    expect(screen.getByText('General Information')).toBeInTheDocument();
    expect(screen.getByText('Logistics & Routing')).toBeInTheDocument();
    expect(screen.getAllByText(/Cargo .*Details/i).length).toBeGreaterThan(0);
    expect(screen.getByText('Financials')).toBeInTheDocument();
  });

  it('allows adding line items with discount field', async () => {
    renderComponent();

    // Find "Add Item" button - prefer the one in empty state if visible, or header
    // The empty state button text is "Add First Item"
    const addFirstItemButton = screen.queryByText('Add First Item');
    
    if (addFirstItemButton) {
        fireEvent.click(addFirstItemButton);
    } else {
        const addItemButton = screen.getByText('Add Item');
        fireEvent.click(addItemButton);
    }

    // Check if item fields appear
    await waitFor(() => {
        // Updated to match actual UI labels
        // Use queryAllByText because "Commodity" might appear multiple times (label, placeholder, etc.)
        const commodityLabels = screen.queryAllByText(/Commodity/i);
        expect(commodityLabels.length).toBeGreaterThan(0);
        
        // Look for Discount % label
        expect(screen.getByText('Discount %')).toBeInTheDocument();
    }, { timeout: 3000 });

    // Check inputs exist
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs.length).toBeGreaterThanOrEqual(1);
  });

  it('shows calculate estimate button in financials', async () => {
    renderComponent();
    expect(screen.getByText('Calculate Estimate')).toBeInTheDocument();
  });

  it('validates required fields on submit', async () => {
    renderComponent();
    
    // Find submit button (usually "Save Quote" or similar)
    // Assuming there is a save button. If not, we might need to look for it.
    // QuoteHeader usually has the save button.
    const saveButton = screen.getByText(/Save Quote/i);
    fireEvent.click(saveButton);

    // Expect validation errors
    // Title is required
    await waitFor(() => {
        expect(screen.getByText(/Title is required/i)).toBeInTheDocument();
    });
  });

  it('submits form with valid data', async () => {
    renderComponent();

    // Fill Title
    const titleInput = screen.getByLabelText(/Title/i);
    fireEvent.change(titleInput, { target: { value: 'Test Quote' } });

    // Add Item
    const addFirstItemButton = screen.queryByText('Add First Item');
    if (addFirstItemButton) {
        fireEvent.click(addFirstItemButton);
    } else {
        const addItemButton = screen.getByText('Add Item');
        fireEvent.click(addItemButton);
    }

    // Fill Item Details (using mocked SharedCargoInput)
    await waitFor(() => {
        expect(screen.getByTestId('mock-cargo-input')).toBeInTheDocument();
    });
    
    const cargoInput = screen.getByTestId('mock-cargo-input');
    fireEvent.change(cargoInput, { target: { value: 'Test Commodity' } });

    // Fill other item fields if necessary (Quantity defaults to 1, Price defaults to 0)
    // But schema says price min 0.
    
    // Submit
    const saveButton = screen.getByText(/Save Quote/i);
    fireEvent.click(saveButton);

    // Check if saveQuote was called
    await waitFor(() => {
        expect(saveQuoteMock).toHaveBeenCalled();
    });
  });

  it('updates logistics fields correctly', async () => {
    const user = require('@testing-library/user-event').default.setup();
    renderComponent();
    
    // 1. Select Service Type
    const serviceTypeTrigger = screen.getByTestId('service-type-select-trigger');
    await user.click(serviceTypeTrigger);
    
    const oceanOption = await screen.findByText('Ocean FCL');
    await user.click(oceanOption);
    
    expect(screen.getByText('Ocean FCL')).toBeInTheDocument();

    // 2. Select Service Level (filtered by type)
    const serviceLevelTrigger = screen.getByTestId('service-level-select-trigger');
    await user.click(serviceLevelTrigger);
    
    const standardOption = await screen.findByText('Standard Ocean');
    await user.click(standardOption);
    
    expect(screen.getByText('Standard Ocean')).toBeInTheDocument();

    // 3. Select Origin Port
    const originTrigger = screen.getByTestId('origin-select-trigger');
    await user.click(originTrigger);
    
    const shanghaiOptions = await screen.findAllByText(/Shanghai/i);
    await user.click(shanghaiOptions[0]);
    
    expect(screen.getAllByText(/Shanghai/i).length).toBeGreaterThan(0);

    // 4. Select Destination Port
    const destinationTrigger = screen.getByTestId('destination-select-trigger');
    await user.click(destinationTrigger);
    
    const laOptions = await screen.findAllByText(/Los Angeles/i);
    await user.click(laOptions[1]);
    
    expect(screen.getAllByText(/Los Angeles/i).length).toBeGreaterThan(0);
  });

  it('Save & Compose should NOT switch view if save fails', async () => {
    saveQuoteMock.mockRejectedValueOnce(new Error('Save failed'));
    
    // Render with quoteId to show "Save & Compose" button
    renderComponent({ quoteId: 'quote-123', initialData: { title: 'Test Quote' } });
    
    const saveAndComposeBtn = screen.getByText('Save & Compose');
    fireEvent.click(saveAndComposeBtn);
    
    await waitFor(() => {
      expect(saveQuoteMock).toHaveBeenCalled();
    });
    
    // Should stay in form view (Edit Quote title should still be visible)
    // Composer view mock renders "Mocked Composer"
    expect(screen.queryByText('Mocked Composer')).not.toBeInTheDocument();
    expect(screen.getByText('Edit Quote')).toBeInTheDocument();
  });
});

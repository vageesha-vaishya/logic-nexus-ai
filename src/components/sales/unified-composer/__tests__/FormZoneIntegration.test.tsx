
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormZone } from '../FormZone';
import { useForm, FormProvider } from 'react-hook-form';
import { QuoteStoreProvider } from '@/components/sales/composer/store/QuoteStore';
import * as React from 'react';

// Use hoisted mocks for stability
const { mockSupabase, mockUser } = vi.hoisted(() => {
    const mockRpc = vi.fn();
    const mockFrom = vi.fn();

    const mockDb = {
        rpc: mockRpc,
        from: mockFrom
    };

    const mockUser = { id: 'test-user-id' };
    return { mockSupabase: mockDb, mockUser };
});

// Mock dependencies
const mockPorts = [
    { id: '1', location_name: 'Delhi Air Cargo', location_code: 'DEL', city: 'Delhi', country: 'India', location_type: 'Airport' },
    { id: '2', location_name: 'Mumbai Port', location_code: 'BOM', city: 'Mumbai', country: 'India', location_type: 'Port' }
];

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockSupabase,
    context: { tenantId: 'test-tenant' },
    user: mockUser,
    supabase: mockSupabase
  })
}));

// Setup mock chain
beforeEach(() => {
    const createMockChain = () => {
        const range = vi.fn().mockResolvedValue({ data: [], error: null });
        const order = vi.fn().mockReturnValue({ range });
        
        const limit = vi.fn().mockResolvedValue({ data: [], error: null });
        const or = vi.fn().mockReturnValue({ limit });
        
        const single = vi.fn().mockResolvedValue({ data: null, error: null });
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const inFn = vi.fn().mockReturnValue({ single, maybeSingle });

        const select = vi.fn().mockReturnValue({
            order,
            or,
            in: inFn,
            eq: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({ data: [] })
            })
        });

        return {
            select
        };
    };
    
    mockSupabase.from.mockImplementation(() => createMockChain());
});


vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn()
  })
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: []
  })
}));

vi.mock('@/hooks/useIncoterms', () => ({
  useIncoterms: () => ({
    incoterms: []
  })
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn()
  })
}));

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock QuoteStore
const mockState = {
  referenceData: {
    ports: mockPorts,
    accounts: [],
    contacts: []
  },
  quoteData: {},
  validationErrors: []
};

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  useQuoteStore: () => ({
    state: mockState,
    dispatch: vi.fn()
  }),
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>
}));

// Mock complex components to simplify testing, BUT keep LocationAutocomplete REAL (or close to it)
// Actually, we want to test the integration, so let's try to use the real LocationAutocomplete if possible.
// However, LocationAutocomplete imports useCRM, which we mocked.
// It also imports UI components.
// If we don't mock LocationAutocomplete, it will use the real one.
// We mocked useCRM, so it should be fine.

vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: () => <div data-testid="shared-cargo-input" />
}));

vi.mock('@/components/logistics/SmartCargoInput', () => ({
  CommoditySelection: () => <div data-testid="commodity-selection" />
}));

vi.mock('@/components/ui/file-upload', () => ({
  FileUpload: () => <div data-testid="file-upload" />
}));

// Wrapper component
const TestWrapper = () => {
  const methods = useForm({
    defaultValues: {
      mode: 'air',
      origin: '',
      destination: ''
    }
  });

  return (
    <FormProvider {...methods}>
      <QuoteStoreProvider>
        <FormZone 
           onGetRates={vi.fn()} 
           onSaveDraft={vi.fn()} 
           crmLoading={false}
        />
      </QuoteStoreProvider>
    </FormProvider>
  );
};

describe('FormZone Integration', () => {
  it('updates input value when location is selected', async () => {
    render(<TestWrapper />);
    
    // Find the trigger button for Origin by its placeholder text
    // We use getByText to find the span, then closest button
    const placeholder = screen.getByText('Search origin...');
    const trigger = placeholder.closest('button');
    expect(trigger).toBeInTheDocument();
    
    // Click to open
    fireEvent.click(trigger!);
    
    // Type to search (optional, since preloaded should show up)
    const input = screen.getByPlaceholderText('Search port, airport, city...');
    fireEvent.change(input, { target: { value: 'Del' } });
    
    // Wait for "Delhi Air Cargo" to appear in the command list
    await waitFor(() => {
        expect(screen.getByText('Delhi Air Cargo')).toBeInTheDocument();
    });
    
    // Click the item
    fireEvent.click(screen.getByText('Delhi Air Cargo'));
    
    // Expect trigger to now show the selected value
    // It should show "Delhi Air Cargo (DEL)"
    await waitFor(() => {
        // We look for the text inside the button
        expect(trigger).toHaveTextContent(/Delhi Air Cargo/);
    });
  });

  it('updates input value when form value is set programmatically (e.g. loading draft)', async () => {
      const TestExternalUpdate = () => {
          const form = useForm({
              defaultValues: {
                  origin: '',
                  originId: '',
                  destination: '',
                  destinationId: '',
                  mode: 'ocean',
                  incoterms: 'FOB',
                  commodities: [],
                  containers: [],
                  attachments: [],
                  standalone: false,
                  opportunityId: '',
                  accountId: '',
                  contactId: '',
                  commodity: '',
                  htsCode: '',
                  unit: '',
                  weight: '',
                  volume: '',
                  containerQty: ''
              }
          });

          React.useEffect(() => {
              // Simulate loading data
              setTimeout(() => {
                  form.setValue('origin', 'Delhi Air Cargo');
                  form.setValue('originId', '1');
              }, 50);
          }, [form]);

          return (
               <QuoteStoreProvider>
                   <FormProvider {...form}>
                       <FormZone onGetRates={() => {}} />
                   </FormProvider>
               </QuoteStoreProvider>
           );
      };

      render(<TestExternalUpdate />);

      // Initially it should be empty (placeholder)
      const placeholder = screen.getByText('Search origin...');
      const trigger = placeholder.closest('button');
      expect(trigger).toBeInTheDocument();

      // Wait for the update
      await waitFor(() => {
          expect(trigger).toHaveTextContent(/Delhi Air Cargo/);
      }, { timeout: 1000 });
  });

});

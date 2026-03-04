
import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { FormZone } from '../FormZone';
import { useForm, FormProvider } from 'react-hook-form';
import { QuoteStoreProvider } from '@/components/sales/composer/store/QuoteStore';

// Mock dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: {},
    context: { tenantId: 'test-tenant' },
    supabase: {
        from: () => ({
            select: () => ({
                eq: () => ({
                    order: () => Promise.resolve({ data: [] })
                }),
                order: () => Promise.resolve({ data: [] })
            })
        })
    }
  })
}));

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

// Mock LocationAutocomplete to verify props
vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: vi.fn(({ preloadedLocations, placeholder, 'data-testid': testId }) => (
    <div data-testid={testId} data-preloaded-count={preloadedLocations?.length}>
      {placeholder} - Preloaded: {preloadedLocations?.length}
    </div>
  ))
}));

// Mock other complex components
vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: () => <div data-testid="shared-cargo-input" />
}));

vi.mock('@/components/logistics/SmartCargoInput', () => ({
  CommoditySelection: () => <div data-testid="commodity-selection" />
}));

vi.mock('@/components/ui/file-upload', () => ({
  FileUpload: () => <div data-testid="file-upload" />
}));

// Mock QuoteStore
const mockPorts = [
  { id: '1', location_name: 'Delhi Air Cargo', location_code: 'DEL', city: 'Delhi', country: 'India' },
  { id: '2', location_name: 'Mumbai Port', location_code: 'BOM', city: 'Mumbai', country: 'India' }
];

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

// Wrapper component to provide form context
const TestWrapper = () => {
  const methods = useForm({
    defaultValues: {
      transportMode: 'air', // Ensure we show transport mode fields
      origin: null,
      destination: null
    }
  });

  return (
    <FormProvider {...methods}>
      <FormZone 
        onGetRates={vi.fn()}
        onSaveDraft={vi.fn()}
      />
    </FormProvider>
  );
};

describe('FormZone', () => {
  it('passes preloaded ports from QuoteStore to LocationAutocomplete', async () => {
    render(<TestWrapper />);

    // Check Origin LocationAutocomplete
    const originInput = screen.getByTestId('location-origin');
    expect(originInput).toBeInTheDocument();
    expect(originInput).toHaveAttribute('data-preloaded-count', '2');
    expect(originInput).toHaveTextContent('Search origin... - Preloaded: 2');

    // Check Destination LocationAutocomplete
    const destinationInput = screen.getByTestId('location-destination');
    expect(destinationInput).toBeInTheDocument();
    expect(destinationInput).toHaveAttribute('data-preloaded-count', '2');
    expect(destinationInput).toHaveTextContent('Search destination... - Preloaded: 2');
  });
});

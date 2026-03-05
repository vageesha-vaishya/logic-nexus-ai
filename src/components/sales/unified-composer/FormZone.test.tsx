import { render, screen, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { FormZone } from './FormZone';
import { useForm, FormProvider } from 'react-hook-form';
import { QuoteComposerValues } from './schema';

// Mock other dependencies
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(() => ({
    supabase: { from: vi.fn(() => ({ select: vi.fn(() => ({ eq: vi.fn(() => ({ order: vi.fn(() => ({ data: [] })) })) })) })) },
    scopedDb: {},
    context: { tenantId: 'test-tenant' },
  })),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  useQuoteStore: vi.fn(() => ({
    state: { referenceData: { ports: [] } },
  })),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: vi.fn(() => ({ containerTypes: [], containerSizes: [] })),
}));

vi.mock('@/hooks/useIncoterms', () => ({
  useIncoterms: vi.fn(() => ({ incoterms: [], loading: false })),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: vi.fn(() => ({ invokeAiAdvisor: vi.fn() })),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

// Mock Child Components
vi.mock('@/components/sales/shared/SharedCargoInput', () => ({
  SharedCargoInput: ({ value }: any) => (
    <div data-testid="cargo-input" data-value={JSON.stringify(value)}>
      Mocked Cargo Input
    </div>
  ),
}));

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: () => <div>Location Autocomplete</div>,
}));

// Wrapper to provide FormContext
const TestWrapper = ({ children, defaultValues }: { children: React.ReactNode, defaultValues?: any }) => {
  const methods = useForm<QuoteComposerValues>({
    defaultValues: defaultValues || {
      mode: 'ocean',
      quoteNumber: 'Q123',
    }
  });
  return <FormProvider {...methods}>{children}</FormProvider>;
};

describe('FormZone Initialization', () => {
  it('initializes cargoItem from props correctly', async () => {
    const initialValues = {
      commodity: 'Test Commodity',
      weight: '100',
      volume: '10',
      mode: 'ocean',
    };
    
    const initialExtended = {
      containerType: '20GP',
      containerSize: '20',
      containerQty: '5',
      htsCode: '1234.56',
    };

    render(
      <TestWrapper defaultValues={initialValues}>
        <FormZone
          onGetRates={vi.fn()}
          initialValues={initialValues}
          initialExtended={initialExtended}
        />
      </TestWrapper>
    );

    // Wait for effect to run
    await waitFor(() => {
      const cargoInput = screen.getByTestId('cargo-input');
      const value = JSON.parse(cargoInput.getAttribute('data-value') || '{}');
      
      expect(value.commodity?.description).toBe('Test Commodity');
      expect(value.commodity?.hts_code).toBe('1234.56');
      expect(value.quantity).toBe(5);
      expect(value.weight.value).toBe(100);
      expect(value.volume).toBe(10);
      expect(value.type).toBe('container');
    });
  });
});

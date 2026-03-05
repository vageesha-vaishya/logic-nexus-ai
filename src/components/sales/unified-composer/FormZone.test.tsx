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

  it('rehydrates cargoItem from initialExtended snapshot when provided', async () => {
    const initialValues = {
      commodity: 'Fallback Commodity',
      weight: '10',
      volume: '1',
      mode: 'ocean',
    };

    const initialExtended = {
      htsCode: '9999.00',
      cargoItem: {
        id: 'main',
        type: 'container',
        quantity: 3,
        dimensions: { l: 10, w: 20, h: 30, unit: 'cm' as const },
        weight: { value: 321, unit: 'lb' as const },
        volume: 12,
        stackable: true,
        commodity: { description: 'Reloaded Commodity', hts_code: '8501.00' },
        hazmat: { class: '3', unNumber: '1263', packingGroup: 'II' as const },
        containerCombos: [{ typeId: 'reefer', sizeId: '40hc', quantity: 3 }],
        containerDetails: { typeId: 'reefer', sizeId: '40hc' },
      },
    };

    render(
      <TestWrapper defaultValues={initialValues}>
        <FormZone
          onGetRates={vi.fn()}
          initialValues={initialValues}
          initialExtended={initialExtended as any}
        />
      </TestWrapper>
    );

    await waitFor(() => {
      const cargoInput = screen.getByTestId('cargo-input');
      const value = JSON.parse(cargoInput.getAttribute('data-value') || '{}');

      expect(value.commodity?.description).toBe('Reloaded Commodity');
      expect(value.commodity?.hts_code).toBe('8501.00');
      expect(value.weight.value).toBe(321);
      expect(value.weight.unit).toBe('lb');
      expect(value.stackable).toBe(true);
      expect(value.hazmat?.unNumber).toBe('1263');
      expect(value.containerCombos?.[0]?.typeId).toBe('reefer');
      expect(value.containerCombos?.[0]?.sizeId).toBe('40hc');
      expect(value.quantity).toBe(3);
    });
  });
});

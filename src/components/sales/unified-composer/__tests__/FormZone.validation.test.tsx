import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi, describe, it, expect } from 'vitest';
import { FormZone } from '../FormZone';
import { FormProvider, useForm } from 'react-hook-form';
import { QuoteComposerValues } from '../schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/components/common/LocationAutocomplete', () => ({
  LocationAutocomplete: ({ error, value, onChange, preloadedLocations, ...props }: any) => (
    <input
      {...props}
      data-testid={props['data-testid'] || 'location-autocomplete'}
      aria-invalid={error}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

vi.mock('@/components/ui/collapsible', () => ({
  Collapsible: ({ children, open }: any) => (
    <div data-testid="collapsible" data-state={open ? 'open' : 'closed'}>
      {children}
    </div>
  ),
  CollapsibleTrigger: ({ children }: any) => <>{children}</>,
  CollapsibleContent: ({ children }: any) => (
    <div data-testid="collapsible-content">{children}</div>
  ),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {
      from: () => ({
        select: () => ({
          eq: () => ({
            order: () => Promise.resolve({ data: [] }),
          }),
        }),
      }),
    },
    scopedDb: {},
    context: { tenantId: 'test-tenant' },
  }),
}));

vi.mock('@/components/sales/composer/store/QuoteStore', () => ({
  useQuoteStore: () => ({
    state: {
      referenceData: { ports: [] },
    },
  }),
}));

vi.mock('@/hooks/useContainerRefs', () => ({
  useContainerRefs: () => ({
    containerTypes: [],
    containerSizes: [],
  }),
}));

vi.mock('@/hooks/useIncoterms', () => ({
  useIncoterms: () => ({
    incoterms: [],
    loading: false,
  }),
}));

vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({
    invokeAiAdvisor: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

vi.mock('@/services/quotation/QuotationNumberService', () => ({
  QuotationNumberService: {
    isUnique: vi.fn().mockResolvedValue(true),
  },
}));

const baseProps = {
  onGetRates: vi.fn(),
  onSaveDraft: vi.fn(),
  onValidationFailed: vi.fn(),
};

function TestProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

function renderWithForm(
  initializer?: (methods: any) => void,
  formZoneProps: Record<string, any> = {},
) {
  const TestComponent = () => {
    const methods = useForm<QuoteComposerValues>({
      defaultValues: {
        mode: 'ocean',
        origin: '',
        destination: '',
        commodity: '',
      },
      mode: 'onChange',
    });

    React.useEffect(() => {
      initializer?.(methods);
    }, [methods]);

    return (
      <TestProvider>
        <FormProvider {...methods}>
          <FormZone {...baseProps} {...formZoneProps} />
        </FormProvider>
      </TestProvider>
    );
  };

  return render(<TestComponent />);
}

describe('FormZone Validation', () => {
  it('highlights origin field container and message when origin validation fails', async () => {
    renderWithForm((methods) => {
      methods.setError('origin', { type: 'manual', message: 'Origin is required' });
    });

    const originContainer = await screen.findByTestId('location-origin');
    const wrapper = originContainer.closest('[data-field-name="origin"]');

    expect(wrapper).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Origin is required')).toBeInTheDocument();
  });

  it('applies error styling and inline message for pickup date', async () => {
    renderWithForm(
      (methods) => {
        methods.setError('pickupDate' as any, { type: 'manual', message: 'Pickup date is invalid' });
      },
      { initialExtended: { pickupDate: '2024-01-01' } },
    );

    const wrapper = await screen.findByTestId('collapsible-content');
    const pickupFieldWrapper = wrapper.querySelector('[data-field-name="pickupDate"]');
    const pickupInput = pickupFieldWrapper?.querySelector('input[type="date"]') as HTMLInputElement | null;

    expect(pickupInput).toBeTruthy();
    expect(pickupInput).toHaveAttribute('aria-invalid', 'true');
    expect(pickupFieldWrapper).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Pickup date is invalid')).toBeInTheDocument();
  });

  it('shows HTS code error styling and helper text when invalid', async () => {
    renderWithForm((methods) => {
      methods.setError('htsCode' as any, { type: 'manual', message: 'Invalid HTS code' });
    });

    const htsWrapper = screen.getByText('HTS Code').closest('[data-field-name="htsCode"]');
    const htsInput = screen.getByPlaceholderText('AI Suggested');

    expect(htsWrapper).toHaveAttribute('aria-invalid', 'true');
    expect(htsInput).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Invalid HTS code')).toBeInTheDocument();
  });
});

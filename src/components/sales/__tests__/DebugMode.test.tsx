import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MultiModalQuoteComposer } from '../MultiModalQuoteComposer';
import { useAuth } from '@/hooks/useAuth';
import { useCRM } from '@/hooks/useCRM';
import { useQuoteStore } from '../composer/store/QuoteStore';

// Mock hooks
vi.mock('@/hooks/useAuth');
vi.mock('@/hooks/useCRM');
vi.mock('../composer/store/QuoteStore', () => ({
  useQuoteStore: vi.fn(),
  QuoteStoreProvider: ({ children }: any) => <div>{children}</div>
}));
vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    log: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));
vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() })
}));
vi.mock('@/hooks/useAiAdvisor', () => ({
  useAiAdvisor: () => ({ invokeAiAdvisor: vi.fn() })
}));
vi.mock('@/components/debug/pipeline/usePipelineInterceptor', () => ({
  usePipelineInterceptor: vi.fn()
}));
vi.mock('@/services/pricing.service', () => {
  return {
    PricingService: class {
      subscribeToUpdates = vi.fn(() => ({ unsubscribe: vi.fn() }));
      calculateRate = vi.fn();
      getRates = vi.fn();
    }
  };
});

vi.mock('@/services/QuoteOptionService', () => {
  return {
    QuoteOptionService: class {
      getOption = vi.fn();
      updateOption = vi.fn();
      createOption = vi.fn();
    }
  };
});

// Mock Child Components to avoid deep rendering issues
vi.mock('../composer/QuotationWorkflowStepper', () => ({
  QuotationWorkflowStepper: () => <div data-testid="stepper">Stepper</div>
}));
vi.mock('../composer/QuoteDetailsStep', () => ({
  QuoteDetailsStep: () => <div>Details</div>
}));
vi.mock('../composer/LegsConfigurationStep', () => ({
  LegsConfigurationStep: () => <div>Legs</div>
}));
vi.mock('../composer/ChargesManagementStep', () => ({
  ChargesManagementStep: () => <div>Charges</div>
}));
vi.mock('../composer/ReviewAndSaveStep', () => ({
  ReviewAndSaveStep: () => <div>Review</div>
}));
vi.mock('../composer/BasisConfigModal', () => ({
  BasisConfigModal: () => <div>Basis</div>
}));
vi.mock('../composer/DeleteConfirmDialog', () => ({
  DeleteConfirmDialog: () => <div>Delete</div>
}));
vi.mock('../composer/SaveProgress', () => ({
  SaveProgress: () => <div>Save</div>
}));
vi.mock('../composer/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: any) => <div>{children}</div>
}));
vi.mock('../composer/ValidationFeedback', () => ({
  ValidationFeedback: () => <div>Validation</div>
}));
vi.mock('../composer/QuoteOptionsOverview', () => ({
  QuoteOptionsOverview: () => <div>Overview</div>
}));

// Mock DataInspector to easily find it
vi.mock('@/components/debug/DataInspector', () => ({
  DataInspector: ({ title }: any) => <div data-testid="data-inspector">{title}</div>
}));

describe('Debug Mode in MultiModalQuoteComposer', () => {
  const mockStoreState = {
    legs: [],
    charges: [],
    options: [],
    isLoading: false,
    activeStep: 1,
    validationErrors: [],
    validationWarnings: [],
    referenceData: {
      serviceTypes: [],
      transportModes: [],
      chargeCategories: [],
      currencies: [],
      containerTypes: [],
      carriers: [],
      locations: [],
      shippingTerms: []
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (useCRM as any).mockReturnValue({
      scopedDb: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
               single: vi.fn(() => ({ data: {}, error: null })),
               maybeSingle: vi.fn(() => ({ data: {}, error: null })),
               data: [],
               error: null
             })),
            data: [],
            error: null
          }))
        })),
        client: {}
      },
      context: { tenantId: 'tenant-123' }
    });
    
    (useQuoteStore as any).mockReturnValue({
      state: mockStoreState,
      dispatch: vi.fn()
    });
  });

  it('should NOT render DataInspector for normal user', () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'user-1', user_metadata: { debug_mode_enabled: true } },
      isPlatformAdmin: () => false
    });

    render(
      <MultiModalQuoteComposer 
        quoteId="q-1" 
        versionId="v-1" 
      />
    );

    expect(screen.queryByTestId('data-inspector')).toBeNull();
  });

  it('should NOT render DataInspector for platform admin when debug mode is disabled', () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'admin-1', user_metadata: { debug_mode_enabled: false } },
      isPlatformAdmin: () => true
    });

    render(
      <MultiModalQuoteComposer 
        quoteId="q-1" 
        versionId="v-1" 
      />
    );

    expect(screen.queryByTestId('data-inspector')).toBeNull();
  });

  it('should render DataInspector for platform admin when debug mode is enabled', () => {
    (useAuth as any).mockReturnValue({
      user: { id: 'admin-1', user_metadata: { debug_mode_enabled: true } },
      isPlatformAdmin: () => true
    });

    render(
      <MultiModalQuoteComposer 
        quoteId="q-1" 
        versionId="v-1" 
      />
    );

    expect(screen.getByTestId('data-inspector')).toBeInTheDocument();
    expect(screen.getByText('Composer Debug')).toBeInTheDocument();
  });
});


import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  ChargesManagementStep,
  applyChargeFieldUpdate,
  buildCargoUnitWarnings,
  normalizeCargoChargeQuantities
} from '../ChargesManagementStep';
import { useQuoteStore } from '../store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';

const { mockLoggerWarn } = vi.hoisted(() => ({ mockLoggerWarn: vi.fn() }));

// Mock dependencies
vi.mock('../store/QuoteStore');
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useAiAdvisor');
vi.mock('@/hooks/use-toast');
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }
}));
vi.mock('@/services/pricing.service');
vi.mock('@/lib/mode-utils', () => ({
  normalizeModeCode: vi.fn((mode) => mode?.toLowerCase() === 'ocean' ? 'sea' : mode?.toLowerCase()),
}));
vi.mock('../LegChargesTabContent', () => ({
  LegChargesTabContent: ({ onFetchRates, leg }: any) => (
    <div data-testid={`leg-content-${leg.id}`}>
      <button onClick={() => onFetchRates(leg.id)}>Fetch Rates</button>
    </div>
  )
}));
vi.mock('../VirtualChargesList', () => ({
  VirtualChargesList: () => <div data-testid="virtual-charges-list">VirtualChargesList</div>
}));

describe('ChargesManagementStep', () => {
  const mockDispatch = vi.fn();
  const mockInvokeAiAdvisor = vi.fn();
  const mockToast = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLoggerWarn.mockClear();
    (useQuoteStore as any).mockReturnValue({
      state: {
        legs: [
          { id: 'leg-1', mode: 'Ocean', origin: 'A', destination: 'B', charges: [] }
        ],
        charges: [], // combined charges
        quoteData: { commodity: 'Goods' },
        validationErrors: [],
        isLoading: false,
        referenceData: {
          chargeCategories: [{ id: 'cat-1', code: 'FRT' }],
          chargeBases: [{ id: 'base-1', code: 'shipment' }],
          currencies: [{ id: 'curr-1', code: 'USD' }],
          serviceTypes: []
        }
      },
      dispatch: mockDispatch
    });
    (useCRM as any).mockReturnValue({ scopedDb: { client: {} } });
    (useAiAdvisor as any).mockReturnValue({ invokeAiAdvisor: mockInvokeAiAdvisor });
    (useToast as any).mockReturnValue({ toast: mockToast });
  });

  it('renders correctly with legs', () => {
    render(<ChargesManagementStep />);
    expect(screen.getByText('Manage Charges')).toBeInTheDocument();
    expect(screen.getByTestId('leg-content-leg-1')).toBeInTheDocument();
  });

  it('calls invokeAiAdvisor with normalized mode when fetching rates', async () => {
    mockInvokeAiAdvisor.mockResolvedValue({ data: { options: [] } }); // Mock empty response or error to stop execution
    
    render(<ChargesManagementStep />);
    
    const fetchButton = screen.getByText('Fetch Rates');
    fireEvent.click(fetchButton);

    await waitFor(() => {
      expect(mockInvokeAiAdvisor).toHaveBeenCalled();
    });

    const callArgs = mockInvokeAiAdvisor.mock.calls[0][0];
    expect(callArgs.payload.mode).toBe('sea'); // Normalized from 'Ocean'
  });

  it('dispatches ADD_COMBINED_CHARGE with correct structure', () => {
    render(<ChargesManagementStep />);
    
    const addButton = screen.getByText('Add Combined Charge');
    fireEvent.click(addButton);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_COMBINED_CHARGE',
      payload: expect.objectContaining({
        category_id: 'cat-1',
        basis_id: 'base-1',
        currency_id: 'curr-1'
      })
    });
  });

  it('keeps buy and sell quantities synchronized for cargo bases', () => {
    const chargeBases = [{ id: 'base-container', code: 'container' }];
    const initial = {
      basis_id: 'base-container',
      buy: { quantity: 1, rate: 100 },
      sell: { quantity: 3, rate: 120 }
    };

    const updated = applyChargeFieldUpdate(initial, 'buy.quantity', 5, chargeBases);

    expect(updated.buy.quantity).toBe(5);
    expect(updated.sell.quantity).toBe(5);
  });

  it('normalizes container quantities to expected cargo units', () => {
    const chargeBases = [{ id: 'base-container', code: 'container' }];
    const initial = {
      basis_id: 'base-container',
      buy: { quantity: 1, rate: 100 },
      sell: { quantity: 1, rate: 120 }
    };

    const normalized = normalizeCargoChargeQuantities(initial, chargeBases, 3);

    expect(normalized.buy.quantity).toBe(3);
    expect(normalized.sell.quantity).toBe(3);
  });

  it('does not force non-container cargo basis to container quantity', () => {
    const chargeBases = [{ id: 'base-kg', code: 'kg' }];
    const initial = {
      basis_id: 'base-kg',
      buy: { quantity: 1200, rate: 2.5 },
      sell: { quantity: 1100, rate: 3 }
    };

    const normalized = normalizeCargoChargeQuantities(initial, chargeBases, 3);

    expect(normalized.buy.quantity).toBe(1200);
    expect(normalized.sell.quantity).toBe(1200);
  });

  it('builds warnings for mismatched cargo units', () => {
    const chargeBases = [{ id: 'base-container', code: 'container' }];
    const legs = [
      {
        id: 'leg-1',
        charges: [
          {
            basis_id: 'base-container',
            buy: { quantity: 1 },
            sell: { quantity: 3 }
          }
        ]
      }
    ];

    const warnings = buildCargoUnitWarnings(legs, [], { cargo_details: { quantity: 3 } }, chargeBases);

    expect(warnings.some((w) => w.includes('buy/sell cargo units differ'))).toBe(true);
    expect(warnings.some((w) => w.includes('do not match quote cargo units'))).toBe(true);
  });

  it('builds warnings using quote-level container combos', () => {
    const chargeBases = [{ id: 'base-container', code: 'container' }];
    const legs = [
      {
        id: 'leg-1',
        charges: [
          {
            basis_id: 'base-container',
            buy: { quantity: 1 },
            sell: { quantity: 1 }
          }
        ]
      }
    ];

    const warnings = buildCargoUnitWarnings(
      legs,
      [],
      { containerCombos: [{ qty: 2 }, { quantity: 1 }] },
      chargeBases
    );

    expect(warnings.some((w) => w.includes('do not match quote cargo units (3)'))).toBe(true);
  });

  it('logs cargo unit mismatches for monitoring', async () => {
    (useQuoteStore as any).mockReturnValue({
      state: {
        legs: [
          {
            id: 'leg-1',
            mode: 'Ocean',
            origin: 'A',
            destination: 'B',
            charges: [
              {
                basis_id: 'base-container',
                buy: { quantity: 1 },
                sell: { quantity: 1 }
              }
            ]
          }
        ],
        charges: [],
        quoteData: {
          quote_number: 'QUO-260309-00001',
          containerCombos: [{ qty: 3 }]
        },
        validationErrors: [],
        isLoading: false,
        referenceData: {
          chargeCategories: [{ id: 'cat-1', code: 'FRT' }],
          chargeBases: [{ id: 'base-container', code: 'container' }],
          currencies: [{ id: 'curr-1', code: 'USD' }],
          serviceTypes: []
        }
      },
      dispatch: mockDispatch
    });

    render(<ChargesManagementStep />);

    await waitFor(() => {
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        '[ChargesManagement] Cargo unit mismatch warnings detected',
        expect.objectContaining({
          quoteNumber: 'QUO-260309-00001',
          warningCount: 1,
        })
      );
    });
  });
});

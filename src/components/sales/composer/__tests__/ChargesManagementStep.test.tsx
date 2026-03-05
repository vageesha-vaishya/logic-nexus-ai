
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChargesManagementStep } from '../ChargesManagementStep';
import { useQuoteStore } from '../store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { useAiAdvisor } from '@/hooks/useAiAdvisor';
import { useToast } from '@/hooks/use-toast';

// Mock dependencies
vi.mock('../store/QuoteStore');
vi.mock('@/hooks/useCRM');
vi.mock('@/hooks/useAiAdvisor');
vi.mock('@/hooks/use-toast');
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
});

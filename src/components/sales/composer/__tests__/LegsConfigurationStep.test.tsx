import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LegsConfigurationStep } from '../LegsConfigurationStep';
import { useQuoteStore } from '../store/QuoteStore';
import { useCRM } from '@/hooks/useCRM';
import { useAppFeatureFlag } from '@/lib/feature-flags';

// Mock dependencies
vi.mock('../store/QuoteStore');
vi.mock('@/hooks/useCRM');
vi.mock('@/lib/feature-flags');
vi.mock('../TransportModeSelector', () => ({
  TransportModeSelector: ({ onSelect }: { onSelect: (mode: string) => void }) => (
    <button onClick={() => onSelect('ocean')}>Add Ocean Leg</button>
  ),
}));
vi.mock('../LegCard', () => ({
  LegCard: ({ leg, onRemoveLeg }: { leg: any; onRemoveLeg: (id: string) => void }) => (
    <div data-testid="leg-card">
      Leg {leg.mode}
      <button onClick={() => onRemoveLeg(leg.id)}>Remove</button>
    </div>
  ),
}));
vi.mock('@/components/ui/card', () => ({
  Card: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  CardContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <label>{children}</label>,
}));
vi.mock('./HelpTooltip', () => ({
  HelpTooltip: () => <span>Help</span>,
}));

describe('LegsConfigurationStep', () => {
  const mockDispatch = vi.fn();
  const mockState = {
    legs: [],
    validationErrors: [],
    referenceData: {
      serviceTypes: [{ id: 'st1', transport_modes: { code: 'ocean' } }],
      carriers: [],
      serviceLegCategories: [],
      ports: [],
    },
    quoteData: { origin: 'Shanghai', destination: 'LA' },
    options: [],
    optionId: 'opt1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (useQuoteStore as any).mockReturnValue({
      state: mockState,
      dispatch: mockDispatch,
    });
    (useCRM as any).mockReturnValue({ scopedDb: {} });
    (useAppFeatureFlag as any).mockReturnValue({ enabled: false });
  });

  it('renders initial state correctly', () => {
    render(<LegsConfigurationStep />);
    expect(screen.getByText('Configure Legs & Services')).toBeInTheDocument();
    expect(screen.getByText('Add Transport Mode')).toBeInTheDocument();
    expect(screen.getByText('No legs added yet. Select a transport mode above to begin.')).toBeInTheDocument();
  });

  it('calls dispatch when adding a leg', () => {
    render(<LegsConfigurationStep />);
    fireEvent.click(screen.getByText('Add Ocean Leg'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_LEG',
      payload: expect.objectContaining({
        mode: 'ocean',
        origin: 'Shanghai', // Should default to quote origin
        destination: 'LA', // Should default to quote destination for first leg
      }),
    });
  });

  it('renders legs when they exist', () => {
    const legsState = {
      ...mockState,
      legs: [
        { id: 'leg1', mode: 'ocean', legType: 'transport' },
        { id: 'leg2', mode: 'air', legType: 'transport' },
      ],
    };
    (useQuoteStore as any).mockReturnValue({
      state: legsState,
      dispatch: mockDispatch,
    });

    render(<LegsConfigurationStep />);
    const legCards = screen.getAllByTestId('leg-card');
    expect(legCards).toHaveLength(2);
    expect(screen.getByText('Leg ocean')).toBeInTheDocument();
    expect(screen.getByText('Leg air')).toBeInTheDocument();
  });

  it('calls dispatch when removing a leg', () => {
    const legsState = {
      ...mockState,
      legs: [{ id: 'leg1', mode: 'ocean', legType: 'transport' }],
    };
    (useQuoteStore as any).mockReturnValue({
      state: legsState,
      dispatch: mockDispatch,
    });

    render(<LegsConfigurationStep />);
    fireEvent.click(screen.getByText('Remove'));
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'REMOVE_LEG',
      payload: 'leg1',
    });
  });

  it('auto-fills destination when multi-leg autofill enabled', () => {
    (useAppFeatureFlag as any).mockReturnValue({ enabled: true });
    // Assume one leg exists
    const legsState = {
      ...mockState,
      legs: [{ id: 'leg1', mode: 'ocean', destination: 'Singapore', legType: 'transport' }],
    };
    (useQuoteStore as any).mockReturnValue({
      state: legsState,
      dispatch: mockDispatch,
    });

    render(<LegsConfigurationStep />);
    fireEvent.click(screen.getByText('Add Ocean Leg'));

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'ADD_LEG',
      payload: expect.objectContaining({
        origin: 'Singapore', // Should be previous leg destination
        destination: 'LA', // Should be quote destination (autofill enabled)
      }),
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LegChargesTabContent } from '../LegChargesTabContent';
import { Leg } from '../store/types';

// Mock VirtualChargesList since it uses virtualization which might be tricky in tests
vi.mock('../VirtualChargesList', () => ({
  VirtualChargesList: ({ charges, onUpdate, onRemove }: any) => (
    <div data-testid="virtual-charges-list">
      {charges.map((c: any, i: number) => (
        <div key={i} data-testid={`charge-${i}`}>
          <span>{c.description}</span>
          <button onClick={() => onUpdate(i, 'description', 'updated')}>Update</button>
          <button onClick={() => onRemove(i)}>Remove</button>
        </div>
      ))}
    </div>
  ),
}));

describe('LegChargesTabContent', () => {
  const mockLeg: Leg = {
    id: 'leg-1',
    mode: 'ocean',
    origin: 'Shanghai',
    destination: 'Los Angeles',
    serviceTypeId: 'st-1',
    charges: [],
    legType: 'transport',
  };

  const defaultProps = {
    leg: mockLeg,
    legIndex: 0,
    serviceType: { name: 'FCL' },
    chargeCategories: [],
    chargeBases: [],
    currencies: [],
    isFetching: false,
    onFetchRates: vi.fn(),
    onAddCharge: vi.fn(),
    onUpdateCharge: vi.fn(),
    onRemoveCharge: vi.fn(),
    onOpenBasisModal: vi.fn(),
    calculateTotals: vi.fn().mockReturnValue({ buy: 100, sell: 120 }),
    renderTotals: vi.fn().mockReturnValue(<div data-testid="totals">Totals Rendered</div>),
    getSafeName: (name: any) => name || '',
  };

  it('renders correctly with empty charges', () => {
    render(<LegChargesTabContent {...defaultProps} />);
    
    expect(screen.getByText('Leg 1: FCL')).toBeInTheDocument();
    expect(screen.getByText('Shanghai → Los Angeles')).toBeInTheDocument();
    expect(screen.getByText('No charges added yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add Charge/i })).toBeInTheDocument();
  });

  it('renders with charges', () => {
    const props = {
      ...defaultProps,
      leg: {
        ...mockLeg,
        charges: [{ description: 'Freight' }, { description: 'THC' }],
      },
    };
    render(<LegChargesTabContent {...props} />);
    
    expect(screen.getByTestId('virtual-charges-list')).toBeInTheDocument();
    expect(screen.getByTestId('charge-0')).toHaveTextContent('Freight');
    expect(screen.getByTestId('charge-1')).toHaveTextContent('THC');
    expect(screen.getByTestId('totals')).toBeInTheDocument();
  });

  it('calls onFetchRates when button is clicked', () => {
    render(<LegChargesTabContent {...defaultProps} />);
    
    const fetchButton = screen.getByRole('button', { name: /Fetch Rates/i });
    fireEvent.click(fetchButton);
    
    expect(defaultProps.onFetchRates).toHaveBeenCalledWith('leg-1');
  });

  it('shows loading state for fetch rates', () => {
    render(<LegChargesTabContent {...defaultProps} isFetching={true} />);
    
    const fetchButton = screen.getByRole('button', { name: /Fetching.../i });
    expect(fetchButton).toBeDisabled();
  });

  it('calls onAddCharge when button is clicked', () => {
    render(<LegChargesTabContent {...defaultProps} />);
    
    const addButton = screen.getByRole('button', { name: /Add Charge/i });
    fireEvent.click(addButton);
    
    expect(defaultProps.onAddCharge).toHaveBeenCalledWith('leg-1');
  });

  it('calls onUpdateCharge when charge is updated', () => {
    const props = {
      ...defaultProps,
      leg: {
        ...mockLeg,
        charges: [{ description: 'Freight' }],
      },
    };
    render(<LegChargesTabContent {...props} />);
    
    const updateButton = screen.getByText('Update');
    fireEvent.click(updateButton);
    
    expect(defaultProps.onUpdateCharge).toHaveBeenCalledWith('leg-1', 0, 'description', 'updated');
  });

  it('calls onRemoveCharge when charge is removed', () => {
    const props = {
      ...defaultProps,
      leg: {
        ...mockLeg,
        charges: [{ description: 'Freight' }],
      },
    };
    render(<LegChargesTabContent {...props} />);
    
    const removeButton = screen.getByText('Remove');
    fireEvent.click(removeButton);
    
    expect(defaultProps.onRemoveCharge).toHaveBeenCalledWith('leg-1', 0);
  });

  it('calculates totals and passes to renderTotals', () => {
    const props = {
        ...defaultProps,
        leg: {
          ...mockLeg,
          charges: [{ description: 'Freight', buy_rate: 100, sell_rate: 120 }],
        },
    };
    render(<LegChargesTabContent {...props} />);

    expect(defaultProps.calculateTotals).toHaveBeenCalledWith(props.leg.charges);
    // totals is { buy: 100, sell: 120 } from mock
    // margin = 20
    // marginPercent = (20/120)*100 = 16.67
    expect(defaultProps.renderTotals).toHaveBeenCalledWith(
        { buy: 100, sell: 120 },
        20,
        '16.67'
    );
  });
});

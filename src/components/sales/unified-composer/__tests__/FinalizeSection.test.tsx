import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FinalizeSection } from '../FinalizeSection';

// Mock formatCurrency from @/lib/utils
vi.mock('@/lib/utils', () => ({
  formatCurrency: (amount: number, currency: string) =>
    `${currency} ${amount.toFixed(2)}`,
  cn: (...args: any[]) => args.filter(Boolean).join(' '),
}));

// Mock visualization components
vi.mock('@/components/sales/common/ChargesAnalysisGraph', () => ({
  ChargesAnalysisGraph: (props: any) => (
    <div data-testid="charges-analysis-graph" data-currency={props.currency}>
      ChargesAnalysisGraph
      <button data-testid="pie-segment" onClick={() => props.onSegmentClick?.('category', 'Freight')}>Segment</button>
    </div>
  ),
}));

vi.mock('@/components/sales/common/ChargeBreakdown', () => ({
  ChargeBreakdown: (props: any) => (
    <div
      data-testid="charge-breakdown"
      data-filter={props.activeFilter ? JSON.stringify(props.activeFilter) : ''}
    >
      ChargeBreakdown
      {props.activeFilter && <button data-testid="clear-filter" onClick={props.onClearFilter}>Clear</button>}
    </div>
  ),
}));

// Mock ChargeRow to avoid complex Select/UI dependencies
vi.mock('@/components/sales/composer/ChargeRow', () => ({
  ChargeRow: ({ charge, onUpdate, onRemove }: any) => (
    <>
      <tr data-testid={`charge-row-${charge.id}`}>
        <td>{charge.categoryName || 'N/A'}</td>
        <td>{charge.basisName || 'N/A'}</td>
        <td>{charge.unit || ''}</td>
        <td>{charge.currencyCode || ''}</td>
        <td>{charge.buy?.quantity}</td>
        <td>{charge.buy?.rate}</td>
        <td>{charge.buy?.amount?.toFixed(2)}</td>
        <td>
          <button data-testid={`remove-${charge.id}`} onClick={onRemove}>Remove</button>
        </td>
      </tr>
      <tr>
        <td colSpan={4}>{charge.note}</td>
        <td>{charge.sell?.quantity}</td>
        <td>{charge.sell?.rate}</td>
        <td>{charge.sell?.amount?.toFixed(2)}</td>
        <td />
      </tr>
    </>
  ),
}));

const mockOption: any = {
  id: 'opt-1',
  carrier: 'Test Carrier',
  name: 'Test Option',
  price: 1000,
  currency: 'USD',
  transitTime: '14 days',
  transport_mode: 'ocean',
  tier: 'standard',
};

const mockOptionWithLegs: any = {
  ...mockOption,
  price: 0,
  legs: [
    {
      id: 'leg-1',
      mode: 'ocean',
      leg_type: 'main',
      origin: 'Shanghai',
      destination: 'Los Angeles',
      sequence: 1,
      charges: [
        { category: 'Freight', name: 'Ocean Freight', amount: 800, currency: 'USD', rate: 800, quantity: 1 },
        { category: 'Handling', name: 'THC', amount: 200, currency: 'USD', rate: 200, quantity: 1 },
      ],
    },
  ],
  charges: [
    { category: 'Fee', name: 'Doc Fee', amount: 50, currency: 'USD', rate: 50, quantity: 1 },
  ],
};

describe('FinalizeSection', () => {
  it('renders finalize section with carrier name', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    expect(screen.getByTestId('finalize-section')).toBeInTheDocument();
    const matches = screen.getAllByText(/Test Carrier/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('creates a charge from price when no legs/charges provided', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    // useChargesManager creates a fallback charge from price
    // The mocked ChargeRow renders category name in td
    expect(screen.getByText('Freight')).toBeInTheDocument();
  });

  it('renders leg tabs when option has legs', () => {
    render(
      <FinalizeSection selectedOption={mockOptionWithLegs} onSaveQuote={vi.fn()} />
    );

    // Should show leg tab: "Shanghai → Los Angeles" (appears in tab + content)
    const legMatches = screen.getAllByText(/Shanghai → Los Angeles/);
    expect(legMatches.length).toBeGreaterThanOrEqual(1);
    // Should show Combined tab
    expect(screen.getAllByText('Combined').length).toBeGreaterThanOrEqual(1);
  });

  it('renders charges grouped by leg', () => {
    render(
      <FinalizeSection selectedOption={mockOptionWithLegs} onSaveQuote={vi.fn()} />
    );

    // Leg-1 should have 2 charges (Ocean Freight + THC)
    // Combined should have 1 charge (Doc Fee)
    // Total charge rows rendered: at least the active tab's charges
    const chargeRows = screen.getAllByTestId(/^charge-row-/);
    expect(chargeRows.length).toBeGreaterThanOrEqual(2);
  });

  it('adds new charge when Add Charge button clicked', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    const chargeRowsBefore = screen.getAllByTestId(/^charge-row-/);
    const beforeCount = chargeRowsBefore.length;

    const addButton = screen.getByText('Add Charge');
    fireEvent.click(addButton);

    const chargeRowsAfter = screen.getAllByTestId(/^charge-row-/);
    expect(chargeRowsAfter.length).toBe(beforeCount + 1);
  });

  it('calls onSaveQuote with charges and margin when Save clicked', () => {
    const onSaveQuote = vi.fn();

    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={onSaveQuote} />
    );

    const saveButton = screen.getByTestId('save-quote-btn');
    fireEvent.click(saveButton);

    expect(onSaveQuote).toHaveBeenCalledTimes(1);
    const [charges, marginPercent, notes] = onSaveQuote.mock.calls[0];
    expect(charges).toHaveLength(1);
    expect(marginPercent).toBe(15);
    expect(notes).toBe('');
  });

  it('shows saving state when saving prop is true', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} saving={true} />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByTestId('save-quote-btn')).toBeDisabled();
  });

  it('displays sell/buy/margin totals', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    // With auto-margin at 15%, sell = 1000, buy = 1000/1.15 ≈ 869.57
    // Sell price should appear
    const sellElements = screen.getAllByText(/USD 1000\.00/);
    expect(sellElements.length).toBeGreaterThanOrEqual(1);
    // Buy and Margin labels should appear (Margin appears in header badge + section)
    expect(screen.getByText('Buy Price')).toBeInTheDocument();
    expect(screen.getAllByText('Margin').length).toBeGreaterThanOrEqual(1);
  });

  it('renders Generate PDF button when onGeneratePdf provided', () => {
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
        onGeneratePdf={vi.fn()}
      />
    );

    expect(screen.getByText('Generate PDF')).toBeInTheDocument();
  });

  it('displays option summary with carrier, transit, mode, tier', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    expect(screen.getByText('14 days')).toBeInTheDocument();
    expect(screen.getByText('ocean')).toBeInTheDocument();
    expect(screen.getByText('standard')).toBeInTheDocument();
  });

  it('renders Show Charge Analysis toggle button', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    expect(screen.getByTestId('toggle-analysis')).toBeInTheDocument();
    expect(screen.getByText('Show Charge Analysis')).toBeInTheDocument();
  });

  it('shows visualization components when Charge Analysis is toggled open', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    // Initially hidden
    expect(screen.queryByTestId('charges-analysis-graph')).not.toBeInTheDocument();

    // Toggle open
    fireEvent.click(screen.getByTestId('toggle-analysis'));

    // Now visible
    expect(screen.getByTestId('charges-analysis-graph')).toBeInTheDocument();
    expect(screen.getByTestId('charge-breakdown')).toBeInTheDocument();
  });

  it('pie segment click sets active filter on charge breakdown', () => {
    render(
      <FinalizeSection selectedOption={mockOption} onSaveQuote={vi.fn()} />
    );

    // Open analysis
    fireEvent.click(screen.getByTestId('toggle-analysis'));

    // Click pie segment
    fireEvent.click(screen.getByTestId('pie-segment'));

    // ChargeBreakdown should receive the filter
    const breakdown = screen.getByTestId('charge-breakdown');
    expect(breakdown.getAttribute('data-filter')).toContain('Freight');
    expect(breakdown.getAttribute('data-filter')).toContain('category');
  });

  it('accepts referenceData prop for master table dropdowns', () => {
    const customRefData = {
      chargeCategories: [{ id: 'custom-cat', code: 'custom', name: 'Custom Category' }],
      chargeBases: [{ id: 'custom-basis', code: 'custom', name: 'Custom Basis' }],
      currencies: [{ id: 'custom-cur', code: 'GBP', name: 'GBP' }],
      chargeSides: [{ id: 'custom-side', code: 'buy', name: 'Buy' }],
    };

    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
        referenceData={customRefData}
      />
    );

    // Should render without error
    expect(screen.getByTestId('finalize-section')).toBeInTheDocument();
  });
});

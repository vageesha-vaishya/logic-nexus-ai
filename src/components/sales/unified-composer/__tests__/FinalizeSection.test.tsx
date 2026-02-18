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

const mockOption: any = {
  id: 'opt-1',
  carrier: 'Test Carrier',
  price: 1000,
  currency: 'USD',
  transitTime: '14 days',
  transport_mode: 'ocean',
  tier: 'standard',
};

describe('FinalizeSection', () => {
  it('renders finalize section with carrier name', () => {
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
      />
    );

    expect(screen.getByTestId('finalize-section')).toBeInTheDocument();
    // Carrier appears in header and summary; verify at least one is present
    const matches = screen.getAllByText(/Test Carrier/);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('creates base freight charge from price when no charges provided', () => {
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
      />
    );

    // When no legs/charges exist but price > 0, a "Base Freight" charge is created
    expect(screen.getByDisplayValue('Base Freight')).toBeInTheDocument();
  });

  it('renders charges from selected option legs', () => {
    const optionWithLegs: any = {
      ...mockOption,
      price: 0,
      legs: [
        {
          id: 'leg-1',
          mode: 'Ocean',
          origin: 'Shanghai',
          destination: 'LA',
          sequence: 1,
          charges: [
            { category: 'Freight', name: 'Ocean Freight', amount: 800, currency: 'USD' },
            { category: 'Origin', name: 'THC Origin', amount: 200, currency: 'USD' },
          ],
        },
      ],
    };

    render(
      <FinalizeSection
        selectedOption={optionWithLegs}
        onSaveQuote={vi.fn()}
      />
    );

    expect(screen.getByDisplayValue('Ocean Freight')).toBeInTheDocument();
    expect(screen.getByDisplayValue('THC Origin')).toBeInTheDocument();
  });

  it('adds new charge when Add Charge button clicked', () => {
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
      />
    );

    // Initially there is 1 charge (Base Freight)
    const categoryInputsBefore = screen.getAllByPlaceholderText('Category');
    expect(categoryInputsBefore).toHaveLength(1);

    // Click the Add Charge button
    const addButton = screen.getByText('Add Charge');
    fireEvent.click(addButton);

    // Now there should be 2 charge rows
    const categoryInputsAfter = screen.getAllByPlaceholderText('Category');
    expect(categoryInputsAfter).toHaveLength(2);
  });

  it('calls onSaveQuote with charges and margin when Save clicked', () => {
    const onSaveQuote = vi.fn();

    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={onSaveQuote}
      />
    );

    const saveButton = screen.getByTestId('save-quote-btn');
    fireEvent.click(saveButton);

    expect(onSaveQuote).toHaveBeenCalledTimes(1);
    // Called with (charges, marginPercent, notes)
    const [charges, marginPercent, notes] = onSaveQuote.mock.calls[0];
    expect(charges).toHaveLength(1);
    expect(charges[0].name).toBe('Base Freight');
    expect(charges[0].amount).toBe(1000);
    expect(marginPercent).toBe(15); // default margin
    expect(notes).toBe(''); // default empty notes
  });

  it('shows saving state when saving prop is true', () => {
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
        saving={true}
      />
    );

    expect(screen.getByText('Saving...')).toBeInTheDocument();
    expect(screen.getByTestId('save-quote-btn')).toBeDisabled();
  });

  it('calculates margin correctly', () => {
    // With price 1000 and default 15% margin:
    // totalSell = 1000, buyPrice = 1000 * (1 - 15/100) = 850, marginAmount = 150
    render(
      <FinalizeSection
        selectedOption={mockOption}
        onSaveQuote={vi.fn()}
      />
    );

    // Sell Price appears in both the badge and the summary, so use getAllByText
    const sellPriceElements = screen.getAllByText('USD 1000.00');
    expect(sellPriceElements.length).toBeGreaterThanOrEqual(1);
    // Buy Price should show 850.00
    expect(screen.getByText('USD 850.00')).toBeInTheDocument();
    // Margin should show 150.00
    expect(screen.getByText('USD 150.00')).toBeInTheDocument();
  });
});

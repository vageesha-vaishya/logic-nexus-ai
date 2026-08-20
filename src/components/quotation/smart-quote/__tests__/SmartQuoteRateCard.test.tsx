import '@testing-library/jest-dom';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { SmartQuoteRateCard } from '../SmartQuoteRateCard';
import { RateOption } from '@/types/quote-breakdown';

const FULL_OPTION: RateOption = {
  id: 'opt-1',
  carrier: 'Pacific Crown Line',
  name: '2x 40HC FCL',
  price: 4180,
  currency: 'USD',
  transitTime: '27 days',
  tier: 'best_value',
  transport_mode: 'ocean',
  source_attribution: 'AI Smart Engine',
  verified: true,
  verificationTimestamp: '2026-08-20T10:00:00.000Z',
  reliability: { score: 9, on_time_performance: '96%' },
  co2_kg: 820,
  ai_explanation: 'Best balance of cost and transit time for this lane.',
  markupPercent: 15,
  marginAmount: 540,
  legs: [
    { id: 'l1', mode: 'ocean', carrier: 'Pacific Crown Line', origin: 'CNSHA', destination: 'KRPUS' },
    { id: 'l2', mode: 'ocean', carrier: 'Pacific Crown Line', origin: 'KRPUS', destination: 'USLAX' },
  ],
};

// Mirrors the real hand-off fixture (SmartQuoteWorkspace.handoff.test.tsx's OPTION_WITH_LEG_CHARGES) —
// only id/carrier/price/currency/legs are set, exercising the "typed as required but absent at
// runtime" case for name/transitTime/tier called out in this plan's Global Constraints.
const MINIMAL_OPTION = {
  id: 'opt-2',
  carrier: 'Maersk',
  price: 1200,
  currency: 'USD',
  legs: [{ id: 'l1', mode: 'ocean', carrier: 'Maersk', origin: 'CNSHA', destination: 'USLAX' }],
} as unknown as RateOption;

function renderCard(option: RateOption, overrides: Partial<Parameters<typeof SmartQuoteRateCard>[0]> = {}) {
  const props = {
    option,
    isSelected: false,
    onToggleSelection: vi.fn(),
    onSelect: vi.fn(),
    onViewDetails: vi.fn(),
    ...overrides,
  };
  render(<SmartQuoteRateCard {...props} />);
  return props;
}

describe('SmartQuoteRateCard', () => {
  it('renders carrier, tier badge, source badge, and formatted price', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByText('Pacific Crown Line')).toBeInTheDocument();
    expect(screen.getByText('Best Value')).toBeInTheDocument();
    expect(screen.getByText('AI Generated')).toBeInTheDocument();
    expect(screen.getByText(/4,180/)).toBeInTheDocument();
  });

  it('renders verified indicator, reliability, CO2, markup, margin, and AI explanation when present', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByText(/Verified/)).toBeInTheDocument();
    expect(screen.getByText(/Reliability 9\/10/)).toBeInTheDocument();
    expect(screen.getByText(/820 kg/)).toBeInTheDocument();
    expect(screen.getByText(/15% mkp/)).toBeInTheDocument();
    expect(screen.getByText(/540/)).toBeInTheDocument();
    expect(screen.getByText(/Best balance of cost/)).toBeInTheDocument();
  });

  it('renders one route-leg dot per leg', () => {
    renderCard(FULL_OPTION);
    expect(screen.getByLabelText('Route').children).toHaveLength(2);
  });

  it('calls onToggleSelection when the checkbox is toggled', () => {
    const props = renderCard(FULL_OPTION);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(props.onToggleSelection).toHaveBeenCalledTimes(1);
  });

  it('calls onSelect when Select is clicked, and onViewDetails when Details is clicked', () => {
    const props = renderCard(FULL_OPTION);
    fireEvent.click(screen.getByRole('button', { name: /select/i }));
    expect(props.onSelect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(props.onViewDetails).toHaveBeenCalledTimes(1);
  });

  it('does not throw and omits tier/verified/reliability/CO2/AI-note when a minimal option is given', () => {
    renderCard(MINIMAL_OPTION);
    expect(screen.getByText('Maersk')).toBeInTheDocument();
    expect(screen.queryByText(/Verified/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Reliability/)).not.toBeInTheDocument();
    expect(screen.getByLabelText('Route').children).toHaveLength(1);
  });

  it('marks the card selected via a data attribute when isSelected is true', () => {
    renderCard(FULL_OPTION, { isSelected: true });
    expect(screen.getByTestId('smart-quote-rate-card-opt-1')).toHaveAttribute('data-selected', 'true');
  });
});

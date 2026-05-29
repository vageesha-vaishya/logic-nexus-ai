import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QuotationComparisonDashboard } from './QuotationComparisonDashboard';

describe('QuotationComparisonDashboard', () => {
  it('highlights differentiators and shows normalized reliability', () => {
    render(
      <QuotationComparisonDashboard
        options={[
          {
            id: 'opt-1',
            carrier_name: 'Carrier A',
            option_name: 'Economy Plan',
            total_amount: 1000,
            currency: 'USD',
            transit_time_days: 12,
            reliability_score: 88,
            rank_score: 80,
            average_rate: 42.5,
            charges_total: 1000,
            charges: [
              { id: 'c1', name: 'Freight', amount: 900, rate: 40, currency: 'USD' },
              { id: 'c2', name: 'Fuel', amount: 100, rate: 45, currency: 'USD' },
            ],
            data_completeness: {
              is_complete: true,
              missing_fields: [],
            },
          },
          {
            id: 'opt-2',
            carrier_name: 'Carrier B',
            option_name: 'Priority Plan',
            total_amount: 1300,
            currency: 'USD',
            transit_time_days: 10,
            reliability_score: 0.93,
            rank_score: 90,
            is_recommended: true,
            average_rate: 50,
            charges_total: 1300,
            charges: [
              { id: 'c3', name: 'Freight', amount: 1150, rate: 50, currency: 'USD' },
              { id: 'c4', name: 'Fuel', amount: 150, rate: 50, currency: 'USD' },
            ],
            data_completeness: {
              is_complete: true,
              missing_fields: [],
            },
          },
        ]}
        selectedOptionId="opt-2"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByText('Best Price')).toBeTruthy();
    expect(screen.getByText('Fastest')).toBeTruthy();
    expect(screen.getByText('Most Reliable')).toBeTruthy();
    expect(screen.getByText('88%')).toBeTruthy();
    expect(screen.getByTestId('price-delta-opt-1').textContent).toContain('-300.0 USD');
    expect(screen.getByText('Priority Plan')).toBeTruthy();
    expect(screen.getByTestId('average-rate-opt-2')).toHaveTextContent('50.00');
    expect(screen.getByTestId('charges-count-opt-2')).toHaveTextContent('2');
    expect(screen.getByTestId('comparison-detailed-analysis')).toBeInTheDocument();
  });

  it('triggers selection workflow from card and button', () => {
    const onSelect = vi.fn();
    render(
      <QuotationComparisonDashboard
        options={[
          {
            id: 'opt-1',
            carrier_name: 'Carrier A',
            option_name: 'Option A',
            total_amount: 1000,
            currency: 'USD',
            transit_time_days: 12,
            reliability_score: 0.8,
            rank_score: 80,
          },
          {
            id: 'opt-2',
            carrier_name: 'Carrier B',
            option_name: 'Option B',
            total_amount: 1100,
            currency: 'USD',
            transit_time_days: 11,
            reliability_score: 0.9,
            rank_score: 85,
          },
        ]}
        selectedOptionId="opt-1"
        onSelect={onSelect}
      />
    );

    fireEvent.click(screen.getByTestId('comparison-card-opt-2'));
    fireEvent.click(screen.getByText('Select Option'));
    expect(onSelect).toHaveBeenCalledWith('opt-2');
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('shows incomplete data indicators for invalid comparison options', () => {
    render(
      <QuotationComparisonDashboard
        options={[
          {
            id: 'opt-1',
            carrier_name: 'Carrier A',
            option_name: 'Option A',
            total_amount: 1000,
            currency: 'USD',
            transit_time_days: 12,
            reliability_score: 0.8,
            rank_score: 80,
            charges: [{ id: 'c1', name: 'Freight', amount: 1000, rate: 40, currency: 'USD' }],
            data_completeness: {
              is_complete: true,
              missing_fields: [],
            },
          },
          {
            id: 'opt-2',
            carrier_name: 'Carrier B',
            option_name: 'Option B',
            total_amount: 1100,
            currency: 'USD',
            transit_time_days: 11,
            reliability_score: 0.9,
            rank_score: 85,
            charges: [],
            data_completeness: {
              is_complete: false,
              missing_fields: ['charges', 'interest_rates'],
            },
          },
        ]}
        selectedOptionId="opt-1"
        onSelect={vi.fn()}
      />
    );

    expect(screen.getByTestId('comparison-data-quality-alert')).toBeInTheDocument();
    expect(screen.getByTestId('missing-fields-opt-2')).toHaveTextContent('Charges missing');
    expect(screen.getByTestId('missing-fields-opt-2')).toHaveTextContent('Rates missing');
  });
});

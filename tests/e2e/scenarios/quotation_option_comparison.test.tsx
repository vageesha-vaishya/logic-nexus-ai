/** @vitest-environment jsdom */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuotationRankingService } from '../../../src/services/quotation/QuotationRankingService';
import type { RankableOption } from '../../../src/services/quotation/QuotationRankingService';
import { QuotationComparisonDashboard } from '../../../src/components/sales/quotation-versions/QuotationComparisonDashboard';

describe('Quotation Option Comparison End-to-End Journey', () => {
  it('ranks, differentiates, and selects an option through the dashboard', () => {
    const sourceOptions: RankableOption[] = [
      { id: 'o1', total_amount: 1500, transit_time_days: 8, reliability_score: 0.95 },
      { id: 'o2', total_amount: 1200, transit_time_days: 12, reliability_score: 0.85 },
      { id: 'o3', total_amount: 1800, transit_time_days: 7, reliability_score: 98 },
    ];
    const ranked = QuotationRankingService.rankOptions(sourceOptions, { cost: 0.45, transit_time: 0.25, reliability: 0.3 });
    const onSelect = vi.fn();
    const dashboardOptions = ranked.map((option) => ({
      ...option,
      carrier_name: `Carrier ${option.id}`,
      currency: 'USD',
      rank_details: {
        cost_score: option.rank_details?.cost_score ?? 0,
        time_score: option.rank_details?.time_score ?? 0,
        reliability_score: option.rank_details?.reliability_score ?? 0,
      },
    }));

    render(
      <QuotationComparisonDashboard
        options={dashboardOptions}
        selectedOptionId={ranked[0].id}
        onSelect={onSelect}
      />
    );

    expect(screen.getByText('Option Comparison')).toBeTruthy();
    expect(screen.getByText('3 Options Available')).toBeTruthy();
    expect(screen.getByText('Best Price')).toBeTruthy();
    expect(screen.getByText('Fastest')).toBeTruthy();

    fireEvent.click(screen.getByTestId('comparison-card-o2'));
    expect(onSelect).toHaveBeenCalledWith('o2');
  });
});

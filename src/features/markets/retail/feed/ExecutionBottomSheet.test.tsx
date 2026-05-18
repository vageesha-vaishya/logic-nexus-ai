import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

// useActiveConnection lives at src/features/markets/hooks; the ExecutionBottomSheet
// sits in src/features/markets/retail/feed, so the relative path is two levels up.
vi.mock('../../hooks/useActiveConnection', () => ({
  useActiveConnection: () => ({
    connection: {
      id: 'conn-1',
      display_name: 'Zerodha',
      broker: 'zerodha',
      can_trade: true,
      status: 'active',
    },
    hasTradeableConnection: true,
    isLoading: false,
  }),
}));

vi.mock('../../components/OrderFormSheet', () => ({
  OrderFormSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="order-form">OrderForm</div> : null,
}));

import { ExecutionBottomSheet } from './ExecutionBottomSheet';
import type { RetailSignal } from '../types';

const mockSignal = {
  id: 's1',
  ts: '2026-05-18T10:00:00Z',
  instrument_id: 'i1',
  strategy_id: null,
  portfolio_id: null,
  signal_type: 'buy',
  direction: 'long',
  confidence: 0.73,
  score: 73,
  rationale: 'momentum',
  price_at_signal: 2890,
  generated_by: 'gen',
  expires_at: null,
  metadata: {},
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
} as unknown as RetailSignal;

const wrap = (ui: React.ReactNode) => <MemoryRouter>{ui}</MemoryRouter>;

describe('ExecutionBottomSheet', () => {
  it('shows the signal summary and SEBI disclaimer', () => {
    render(
      wrap(<ExecutionBottomSheet signal={mockSignal} open onOpenChange={vi.fn()} />),
    );
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText(/past performance/i)).toBeInTheDocument();
  });

  it('renders the price and confidence for the signal', () => {
    render(
      wrap(<ExecutionBottomSheet signal={mockSignal} open onOpenChange={vi.fn()} />),
    );
    expect(screen.getByText(/2,890/)).toBeInTheDocument();
    expect(screen.getByText(/73%/)).toBeInTheDocument();
  });

  it('hands off to OrderFormSheet when Proceed is clicked', async () => {
    const onOpenChange = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      wrap(<ExecutionBottomSheet signal={mockSignal} open onOpenChange={onOpenChange} />),
    );
    await user.click(screen.getByRole('button', { name: /proceed to buy/i }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.getByTestId('order-form')).toBeInTheDocument();
  });

  it('renders nothing when signal is null', () => {
    const { container } = render(
      wrap(<ExecutionBottomSheet signal={null} open onOpenChange={vi.fn()} />),
    );
    expect(container.firstChild).toBeNull();
  });
});

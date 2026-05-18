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

// CoolingOffScreen calls useLogBehavioralEvent (TanStack mutation); stub it out
// so the sheet test doesn't need a QueryClient wrapper.
vi.mock('../behavioral/useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: vi.fn() }),
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

  it('skips cooling-off and goes straight to OrderFormSheet for a BUY', async () => {
    const onOpenChange = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(
      wrap(
        <ExecutionBottomSheet
          signal={mockSignal}
          open
          onOpenChange={onOpenChange}
          coreDrawdownTier="red"
          coreDrawdownPct={23}
          corePortfolioId="p1"
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /proceed to buy/i }));

    expect(screen.getByTestId('order-form')).toBeInTheDocument();
    // CoolingOffScreen mustn't have appeared — its hallmark button is "Proceed anyway".
    expect(screen.queryByRole('button', { name: /proceed anyway/i })).not.toBeInTheDocument();
  });

  it('interposes the CoolingOffScreen for a SELL during a red-tier drawdown', async () => {
    const onOpenChange = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    const sellSignal = { ...mockSignal, signal_type: 'sell' } as unknown as RetailSignal;

    render(
      wrap(
        <ExecutionBottomSheet
          signal={sellSignal}
          open
          onOpenChange={onOpenChange}
          coreDrawdownTier="red"
          coreDrawdownPct={23}
          corePortfolioId="p1"
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /proceed to sell/i }));

    // The OrderFormSheet should NOT be open yet; cooling-off intervened.
    expect(screen.queryByTestId('order-form')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed anyway/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wait 24 hours/i })).toBeInTheDocument();
  });

  it('does NOT interpose cooling-off for a SELL when drawdown is below red', async () => {
    const onOpenChange = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    const sellSignal = { ...mockSignal, signal_type: 'sell' } as unknown as RetailSignal;

    render(
      wrap(
        <ExecutionBottomSheet
          signal={sellSignal}
          open
          onOpenChange={onOpenChange}
          coreDrawdownTier="orange"
          coreDrawdownPct={12}
          corePortfolioId="p1"
        />,
      ),
    );
    await user.click(screen.getByRole('button', { name: /proceed to sell/i }));

    expect(screen.getByTestId('order-form')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /proceed anyway/i })).not.toBeInTheDocument();
  });
});

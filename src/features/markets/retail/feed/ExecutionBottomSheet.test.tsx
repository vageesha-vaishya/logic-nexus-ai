import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/markets/hooks/useActiveConnection', () => ({
  useActiveConnection: () => ({
    connection: { id: 'conn-1', display_name: 'Zerodha', broker: 'zerodha' },
    hasTradeableConnection: true,
    isLoading: false,
  }),
}));

vi.mock('@/features/markets/components/OrderFormSheet', () => ({
  OrderFormSheet: ({ open }: { open: boolean }) =>
    open ? <div data-testid="order-form">OrderForm</div> : null,
}));

const mockSignal = {
  id: 's1',
  signal_type: 'buy' as const,
  confidence: 0.73,
  price_at_signal: 2890,
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
  metadata: {},
  ts: '2026-05-18T10:00:00Z',
  instrument_id: 'instr-1',
  direction: 'long' as const,
  score: 73, rationale: '', expires_at: null,
  strategy_id: null, portfolio_id: null, generated_by: null,
  risk_params: {},
};

describe('ExecutionBottomSheet', () => {
  it('shows signal summary when open', async () => {
    const { ExecutionBottomSheet } = await import('./ExecutionBottomSheet');
    render(
      <MemoryRouter>
        <ExecutionBottomSheet
          signal={mockSignal as any}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText(/BUY/)).toBeInTheDocument();
  });

  it('shows SEBI disclaimer text', async () => {
    const { ExecutionBottomSheet } = await import('./ExecutionBottomSheet');
    render(
      <MemoryRouter>
        <ExecutionBottomSheet
          signal={mockSignal as any}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText(/past performance/i)).toBeInTheDocument();
  });

  it('opens OrderFormSheet when proceed button clicked', async () => {
    const { ExecutionBottomSheet } = await import('./ExecutionBottomSheet');
    render(
      <MemoryRouter>
        <ExecutionBottomSheet
          signal={mockSignal as any}
          open={true}
          onOpenChange={vi.fn()}
        />
      </MemoryRouter>,
    );
    const proceedBtn = screen.getByRole('button', { name: /proceed/i });
    fireEvent.click(proceedBtn);
    expect(screen.getByTestId('order-form')).toBeInTheDocument();
  });
});

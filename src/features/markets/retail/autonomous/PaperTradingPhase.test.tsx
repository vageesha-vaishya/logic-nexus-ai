// src/features/markets/retail/autonomous/PaperTradingPhase.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockAdvance = vi.fn();
vi.mock('./hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({
    data: { current_phase: 'paper', paper_trades_done: 7, micro_trades_done: 0, kill_switch_level: 'none' },
    isLoading: false,
  }),
  useAdvancePhase: () => ({ mutate: mockAdvance, isPending: false }),
}));

describe('PaperTradingPhase', () => {
  it('shows paper trades progress (7 of 10)', async () => {
    const { PaperTradingPhase } = await import('./PaperTradingPhase');
    render(<PaperTradingPhase />);
    expect(screen.getByText(/7.*10|7 of 10|7\/10/i)).toBeInTheDocument();
  });

  it('advance button disabled when not enough trades', async () => {
    const { PaperTradingPhase } = await import('./PaperTradingPhase');
    render(<PaperTradingPhase />);
    expect(screen.getByRole('button', { name: /advance|next phase|micro/i })).toBeDisabled();
  });
});

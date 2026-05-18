// src/features/markets/retail/community/StrategyMarketplace.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

const mockDeploy = vi.fn();
vi.mock('./hooks/useCommunity', () => ({
  useStrategies: () => ({
    data: [
      { id: 's1', name: 'RSI Reversal', description: 'Reversal on RSI', asset_class: 'equity',
        live_users: 34, rating: 4.2, paper_required_days: 14, backtest_summary: {}, creator_id: 'c1', created_at: '' },
    ],
    isLoading: false,
  }),
  useDeployStrategy: () => ({ mutate: mockDeploy, isPending: false }),
}));
vi.mock('../autonomous/hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({
    data: { current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' },
  }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('StrategyMarketplace', () => {
  it('shows strategies list', async () => {
    const { StrategyMarketplace } = await import('./StrategyMarketplace');
    render(<StrategyMarketplace />);
    expect(screen.getByText('RSI Reversal')).toBeInTheDocument();
  });

  it('deploy button is disabled in paper phase', async () => {
    const { StrategyMarketplace } = await import('./StrategyMarketplace');
    render(<StrategyMarketplace />);
    const deployBtn = screen.getByRole('button', { name: /deploy|paper phase/i });
    expect(deployBtn).toBeDisabled();
  });
});

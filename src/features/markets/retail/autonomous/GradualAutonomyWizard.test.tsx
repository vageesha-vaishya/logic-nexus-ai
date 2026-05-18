// src/features/markets/retail/autonomous/GradualAutonomyWizard.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { access_token: 'test-token' } }),
}));

vi.mock('./hooks/useAutonomyProgress', () => ({
  useAutonomyProgress: () => ({
    data: { current_phase: 'paper', paper_trades_done: 3, micro_trades_done: 0, kill_switch_level: 'none' },
    isLoading: false,
  }),
  useAdvancePhase: () => ({ mutate: vi.fn(), isPending: false }),
}));

describe('GradualAutonomyWizard', () => {
  it('shows all 4 phases', async () => {
    const { GradualAutonomyWizard } = await import('./GradualAutonomyWizard');
    render(<GradualAutonomyWizard />);
    expect(screen.getByText('Paper Trading')).toBeInTheDocument();
    expect(screen.getAllByText(/micro/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/pilot/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/full/i).length).toBeGreaterThan(0);
  });

  it('shows current phase progress (3 of 10)', async () => {
    const { GradualAutonomyWizard } = await import('./GradualAutonomyWizard');
    render(<GradualAutonomyWizard />);
    expect(screen.getByText(/3.*10|3 of 10|7 more/i)).toBeInTheDocument();
  });
});

// src/features/markets/retail/autonomous/KillSwitchPanel.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: { access_token: 'test-token' } }),
}));

const mockSetKillSwitch = vi.fn();
vi.mock('./hooks/useKillSwitch', () => ({
  useKillSwitch: () => ({ data: { kill_switch_level: 'none', current_phase: 'micro' }, isLoading: false }),
  useSetKillSwitch: () => ({ mutate: mockSetKillSwitch, isPending: false }),
}));

beforeEach(() => vi.clearAllMocks());

describe('KillSwitchPanel', () => {
  it('shows all 4 kill switch action buttons', async () => {
    const { KillSwitchPanel } = await import('./KillSwitchPanel');
    render(<KillSwitchPanel />);
    expect(screen.getByRole('button', { name: /pause.*strategy|strategy.*pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pause.*all|all.*pause/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /flatten/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /revoke|api key/i })).toBeInTheDocument();
  });

  it('clicking Pause All calls setKillSwitch with all_pause', async () => {
    const { KillSwitchPanel } = await import('./KillSwitchPanel');
    render(<KillSwitchPanel />);
    fireEvent.click(screen.getByRole('button', { name: /pause.*all|all.*pause/i }));
    expect(mockSetKillSwitch).toHaveBeenCalledWith('all_pause');
  });
});

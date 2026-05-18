// src/features/markets/retail/community/CopyTradingExtended.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('CopyTradingExtended', () => {
  it('renders leaderboard header and safety notice with 20% mention', async () => {
    const { CopyTradingExtended } = await import('./CopyTradingExtended');
    render(<CopyTradingExtended />);
    expect(screen.getAllByText(/top traders|leaderboard/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/20%/i)).toBeInTheDocument();
  });
});

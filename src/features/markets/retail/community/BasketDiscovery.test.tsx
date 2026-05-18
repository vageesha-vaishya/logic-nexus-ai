// src/features/markets/retail/community/BasketDiscovery.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./hooks/useCommunity', () => ({
  useBaskets: () => ({
    data: [
      { id: 'b1', name: 'EV Revolution', theme: 'Tech', risk_level: 'high', follower_count: 142, total_invested: 500000, description: 'EV stocks' },
      { id: 'b2', name: 'Dividend Income', theme: 'Value', risk_level: 'low', follower_count: 98, total_invested: 320000, description: 'Dividend stocks' },
    ],
    isLoading: false,
  }),
  useInvestInBasket: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('BasketDiscovery', () => {
  it('renders all baskets', async () => {
    const { BasketDiscovery } = await import('./BasketDiscovery');
    render(<BasketDiscovery onSelect={vi.fn()} />);
    expect(screen.getByText('EV Revolution')).toBeInTheDocument();
    expect(screen.getByText('Dividend Income')).toBeInTheDocument();
  });

  it('filter by risk_level high shows only EV Revolution', async () => {
    const { BasketDiscovery } = await import('./BasketDiscovery');
    render(<BasketDiscovery onSelect={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /high risk/i }));
    expect(screen.getByText('EV Revolution')).toBeInTheDocument();
    expect(screen.queryByText('Dividend Income')).toBeNull();
  });
});

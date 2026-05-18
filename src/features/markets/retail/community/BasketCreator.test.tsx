// src/features/markets/retail/community/BasketCreator.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('./hooks/useCommunity', () => ({
  useCreatorStatus: () => ({ data: { is_verified: false }, isLoading: false }),
  useBaskets: () => ({ data: [], isLoading: false }),
}));
vi.mock('@/hooks/useSession', () => ({ useSession: () => ({ session: null }) }));

describe('BasketCreator', () => {
  it('shows verified creator required message for non-creator', async () => {
    const { BasketCreator } = await import('./BasketCreator');
    render(<BasketCreator />);
    expect(screen.getByText(/verified creator required/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /create basket/i })).toBeNull();
  });
});

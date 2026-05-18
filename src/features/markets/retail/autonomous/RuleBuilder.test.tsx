// src/features/markets/retail/autonomous/RuleBuilder.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockCreate = vi.fn();
vi.mock('./hooks/useExecutionRules', () => ({
  useExecutionRules: () => ({ data: [], isLoading: false }),
  useCreateExecutionRule: () => ({ mutate: mockCreate, isPending: false }),
}));
vi.mock('@/hooks/useSession', () => ({
  useSession: () => ({ session: null }),
}));

beforeEach(() => vi.clearAllMocks());

describe('RuleBuilder', () => {
  it('renders name input and asset class selector', async () => {
    const { RuleBuilder } = await import('./RuleBuilder');
    render(<RuleBuilder />);
    expect(screen.getByLabelText(/rule name/i)).toBeInTheDocument();
    // Asset class selector renders a select trigger
    expect(screen.getByText(/asset class/i)).toBeInTheDocument();
  });

  it('save button calls createRule when name is provided', async () => {
    const { RuleBuilder } = await import('./RuleBuilder');
    render(<RuleBuilder />);
    const nameInput = screen.getByLabelText(/rule name/i);
    fireEvent.change(nameInput, { target: { value: 'My HDFC Rule' } });
    fireEvent.click(screen.getByRole('button', { name: /save rule/i }));
    expect(mockCreate).toHaveBeenCalled();
  });
});

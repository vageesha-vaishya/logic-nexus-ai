import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMutate = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockMutate }),
}));

beforeEach(() => vi.clearAllMocks());

describe('CoolingOffScreen', () => {
  it('shows drawdown percentage and both action buttons', async () => {
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={vi.fn()}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    expect(screen.getByText(/23%|23/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /proceed anyway/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wait 24 hours/i })).toBeInTheDocument();
  });

  it('"Proceed anyway" calls onProceed and logs panic_sell_intercepted', async () => {
    const onProceed = vi.fn();
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={vi.fn()}
        onProceed={onProceed}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /proceed anyway/i }));
    expect(onProceed).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'panic_sell_intercepted' }),
    );
  });

  it('"Wait 24 hours" calls onClose and logs cooling_off_waited', async () => {
    const onClose = vi.fn();
    const { CoolingOffScreen } = await import('./CoolingOffScreen');
    render(
      <CoolingOffScreen
        open={true}
        onClose={onClose}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /wait 24 hours/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'cooling_off_waited' }),
    );
  });
});

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLog = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLog }),
}));

import { CoolingOffScreen } from './CoolingOffScreen';

describe('CoolingOffScreen', () => {
  beforeEach(() => mockLog.mockReset());

  it('renders the warning, drawdown %, and both action buttons', () => {
    render(
      <CoolingOffScreen
        open
        onClose={vi.fn()}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    expect(screen.getByRole('button', { name: /proceed anyway/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /wait 24 hours/i })).toBeInTheDocument();
    // "23%" appears in both the title and the bullet list — use getAllByText.
    expect(screen.getAllByText(/23%/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/informational only/i)).toBeInTheDocument();
  });

  it('"Proceed anyway" calls onProceed and logs panic_sell_intercepted', () => {
    const onProceed = vi.fn();
    render(
      <CoolingOffScreen
        open
        onClose={vi.fn()}
        onProceed={onProceed}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /proceed anyway/i }));

    expect(onProceed).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'panic_sell_intercepted',
        severity: 'critical',
        metadata: expect.objectContaining({
          portfolio_id: 'p1',
          drawdown_pct: 23,
          action: 'proceeded',
        }),
      }),
    );
  });

  it('"Wait 24 hours" calls onClose and logs cooling_off_waited', () => {
    const onClose = vi.fn();
    render(
      <CoolingOffScreen
        open
        onClose={onClose}
        onProceed={vi.fn()}
        drawdownPct={23}
        portfolioId="p1"
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: /wait 24 hours/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockLog).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'cooling_off_waited',
        severity: 'warning',
      }),
    );
  });
});

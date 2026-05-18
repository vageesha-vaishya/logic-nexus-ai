import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLog = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLog, isPending: false }),
}));

import { BehavioralAlertBanner } from './BehavioralAlertBanner';

describe('BehavioralAlertBanner', () => {
  beforeEach(() => mockLog.mockReset());

  it('renders nothing when alertTier is null', () => {
    const { container } = render(
      <BehavioralAlertBanner alertTier={null} drawdownPct={2} portfolioId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for the red tier (handled by CoolingOffScreen)', () => {
    const { container } = render(
      <BehavioralAlertBanner alertTier="red" drawdownPct={23} portfolioId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders the yellow banner with drawdown % and "normal" framing', () => {
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7.2} portfolioId="p1" />,
    );
    expect(screen.getByText(/7\.2%/)).toBeInTheDocument();
    expect(screen.getByText(/normal/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /understood/i })).toBeInTheDocument();
  });

  it('renders the orange banner with recovery context', () => {
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={14.0} portfolioId="p1" />,
    );
    expect(screen.getByText(/14\.0%/)).toBeInTheDocument();
    expect(screen.getByText(/recover/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /keep holding/i })).toBeInTheDocument();
  });

  it('dismiss button logs the correct event type for yellow tier', () => {
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /understood/i }));
    expect(mockLog).toHaveBeenCalledWith({
      event_type: 'yellow_alert',
      severity: 'info',
      metadata: { drawdown_pct: 7, portfolio_id: 'p1', action: 'dismissed' },
    });
  });

  it('dismiss button logs the correct event type for orange tier', () => {
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={14} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /keep holding/i }));
    expect(mockLog).toHaveBeenCalledWith({
      event_type: 'orange_alert',
      severity: 'warning',
      metadata: { drawdown_pct: 14, portfolio_id: 'p1', action: 'dismissed' },
    });
  });
});

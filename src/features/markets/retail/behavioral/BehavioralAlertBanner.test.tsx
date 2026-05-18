import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockLog = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLog, isPending: false }),
}));
vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'user-banner-1' }, roles: [] }),
}));

import { BehavioralAlertBanner } from './BehavioralAlertBanner';

describe('BehavioralAlertBanner', () => {
  beforeEach(() => {
    mockLog.mockReset();
    window.localStorage.clear();
  });

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

  it('hides immediately on dismiss (same render tree)', () => {
    const { container } = render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={12} portfolioId="p1" />,
    );
    expect(screen.getByRole('button', { name: /keep holding/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /keep holding/i }));
    expect(container.firstChild).toBeNull();
  });

  it('stays hidden across remounts when previously dismissed (localStorage TTL)', () => {
    const { unmount } = render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={12} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /keep holding/i }));
    unmount();

    // Remount with the same tier+portfolio — should be suppressed.
    const second = render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={12} portfolioId="p1" />,
    );
    expect(second.container.firstChild).toBeNull();
  });

  it('re-appears when the tier escalates (yellow → orange)', () => {
    const { rerender, container } = render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={6} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button', { name: /understood/i }));
    expect(container.firstChild).toBeNull();

    // Drawdown deepens → orange tier; banner must surface again.
    rerender(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={12} portfolioId="p1" />,
    );
    expect(screen.getByRole('button', { name: /keep holding/i })).toBeInTheDocument();
  });

  it('re-appears once the 24h ack window has elapsed', () => {
    // Pre-seed an ack from 25h ago.
    window.localStorage.setItem(
      'lnai_drawdown_ack_user-banner-1_p1',
      JSON.stringify({ tier: 'orange', ackedAt: Date.now() - 25 * 60 * 60 * 1000 }),
    );
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={12} portfolioId="p1" />,
    );
    expect(screen.getByRole('button', { name: /keep holding/i })).toBeInTheDocument();
  });
});

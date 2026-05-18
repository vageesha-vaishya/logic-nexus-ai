import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockMutate = vi.fn();
vi.mock('./useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockMutate, isPending: false }),
}));

beforeEach(() => vi.clearAllMocks());

describe('BehavioralAlertBanner', () => {
  it('renders nothing when alertTier is null', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    const { container } = render(
      <BehavioralAlertBanner alertTier={null} drawdownPct={2} portfolioId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing for red tier (handled by CoolingOffScreen)', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    const { container } = render(
      <BehavioralAlertBanner alertTier="red" drawdownPct={25} portfolioId="p1" />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('shows yellow banner with drawdown percentage', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7.2} portfolioId="p1" />,
    );
    // Should mention the drawdown % and a calming message
    expect(screen.getByText(/7\.2|7%/)).toBeInTheDocument();
    expect(screen.getByText(/normal|no action/i)).toBeInTheDocument();
  });

  it('shows orange banner with recovery context', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={14.5} portfolioId="p1" />,
    );
    expect(screen.getByText(/14|14\.5/)).toBeInTheDocument();
    expect(screen.getByText(/recover|selling|lock/i)).toBeInTheDocument();
  });

  it('yellow dismiss button calls logEvent with yellow_alert event_type', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="yellow" drawdownPct={7} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'yellow_alert' }),
    );
  });

  it('orange dismiss button calls logEvent with orange_alert event_type', async () => {
    const { BehavioralAlertBanner } = await import('./BehavioralAlertBanner');
    render(
      <BehavioralAlertBanner alertTier="orange" drawdownPct={14} portfolioId="p1" />,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'orange_alert' }),
    );
  });
});

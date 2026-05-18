import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/features/markets/hooks/useActiveConnection', () => ({
  useActiveConnection: () => ({
    connection: null,
    hasTradeableConnection: false,
    isLoading: false,
  }),
}));

const mockLogMutate = vi.fn();
vi.mock('../behavioral/useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: mockLogMutate }),
}));

beforeEach(() => vi.clearAllMocks());

const mockSignal = {
  id: 's1',
  ts: '2026-05-18T10:00:00Z',
  instrument_id: 'instr-1',
  signal_type: 'buy' as const,
  direction: 'long' as const,
  confidence: 0.73,
  score: 73,
  horizon: 'short_term',
  asset_class: 'equity',
  rationale: 'EMA cross with volume confirmation',
  price_at_signal: 2890,
  expires_at: null,
  strategy_id: null,
  portfolio_id: null,
  generated_by: 'signal_generator',
  risk_params: { stop_loss_pct: 2.5, target_pct: 5.5, r_r: 2.2 },
  metadata: {
    explanations: {
      beginner: 'Reliance looks good to buy.',
      casual: 'RSI rising. Confidence 73%. Entry ₹2,890.',
      self_directed: 'EMA20 > EMA50. RSI 58. Vol +65%. Stop ₹2,820.',
    },
    stop_loss: 2820,
    target_price: 3050,
  },
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
};

describe('SignalCard', () => {
  it('shows instrument symbol and buy badge', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="beginner" />
      </MemoryRouter>,
    );
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText(/buy/i)).toBeInTheDocument();
  });

  it('shows beginner explanation for beginner level', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="beginner" />
      </MemoryRouter>,
    );
    expect(screen.getByText('Reliance looks good to buy.')).toBeInTheDocument();
    // Confidence % NOT shown for beginners
    expect(screen.queryByText(/73%/)).toBeNull();
  });

  it('shows confidence % for casual level', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="casual" />
      </MemoryRouter>,
    );
    expect(screen.getByText(/73%/)).toBeInTheDocument();
  });

  it('shows confidence badge label based on score', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={mockSignal as any} experienceLevel="beginner" />
      </MemoryRouter>,
    );
    // 0.73 = 73% → "Strong" (70-85 range)
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('shows no education when seenEducationIds is undefined', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard signal={{ ...mockSignal, confidence: 0.9 } as any} experienceLevel="beginner" />
      </MemoryRouter>,
    );
    expect(screen.queryByText('High Conviction — what does it mean?')).toBeNull();
  });

  it('shows high_conviction_signal education when confidence >= 0.85 and not seen', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, confidence: 0.9 } as any}
          experienceLevel="beginner"
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('High Conviction — what does it mean?')).toBeInTheDocument();
  });

  it('does not show high_conviction_signal if already seen', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, confidence: 0.9 } as any}
          experienceLevel="beginner"
          seenEducationIds={new Set(['high_conviction_signal'])}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText('High Conviction — what does it mean?')).toBeNull();
  });

  it('shows high_vix_execution when isHighStress and not seen', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={mockSignal as any}
          experienceLevel="casual"
          isHighStress={true}
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('High volatility right now')).toBeInTheDocument();
  });

  it('shows first_intraday education for intraday horizon', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, horizon: 'intraday' } as any}
          experienceLevel="casual"
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('Intraday means sell today')).toBeInTheDocument();
  });

  it('shows fo_enable education for derivative asset_class', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, asset_class: 'derivative' } as any}
          experienceLevel="self_directed"
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('F&O carries higher risk')).toBeInTheDocument();
  });

  it('high_conviction takes priority over high_vix when both conditions met', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, confidence: 0.9 } as any}
          experienceLevel="casual"
          isHighStress={true}
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    expect(screen.getByText('High Conviction — what does it mean?')).toBeInTheDocument();
    expect(screen.queryByText('High volatility right now')).toBeNull();
  });

  it('dismiss logs education_shown event', async () => {
    const { SignalCard } = await import('./SignalCard');
    render(
      <MemoryRouter>
        <SignalCard
          signal={{ ...mockSignal, confidence: 0.9 } as any}
          experienceLevel="beginner"
          seenEducationIds={new Set()}
        />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(mockLogMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'education_shown',
        severity: 'info',
        metadata: { education_id: 'high_conviction_signal' },
      }),
    );
  });
});

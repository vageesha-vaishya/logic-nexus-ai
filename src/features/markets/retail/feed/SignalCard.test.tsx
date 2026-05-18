import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// SignalCard now calls useLogBehavioralEvent (TanStack Query). Stub it so the
// tests don't need a real worker; QueryClientProvider still wraps so any other
// query hooks in the tree behave.
vi.mock('../behavioral/useBehavioralEvents', () => ({
  useLogBehavioralEvent: () => ({ mutate: vi.fn() }),
}));

import { SignalCard } from './SignalCard';
import type { RetailSignal } from '../types';

const mockSignal: RetailSignal = {
  id: 's1',
  ts: '2026-05-18T10:00:00Z',
  instrument_id: 'instr-1',
  strategy_id: null,
  portfolio_id: null,
  signal_type: 'buy',
  direction: 'long',
  confidence: 0.73,
  score: 73,
  rationale: 'EMA cross with volume confirmation',
  price_at_signal: 2890,
  generated_by: 'signal_generator',
  expires_at: null,
  metadata: {
    explanations: {
      beginner: 'Reliance looks good to buy.',
      casual: 'RSI rising. Confidence 73%. Entry ₹2,890.',
      self_directed: 'EMA20 > EMA50. RSI 58. Vol +65%.',
    },
    horizon: 'short_term',
    stop_loss: 2820,
    target_price: 3050,
  },
  instrument: { symbol: 'RELIANCE', exchange: 'NSE', instrument_type: 'EQ' },
};

const wrap = (ui: React.ReactNode) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe('SignalCard', () => {
  it('renders the beginner explanation at beginner level', () => {
    render(wrap(<SignalCard signal={mockSignal} experienceLevel="beginner" />));
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('Reliance looks good to buy.')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('hides the raw confidence percent at beginner level', () => {
    render(wrap(<SignalCard signal={mockSignal} experienceLevel="beginner" />));
    expect(screen.queryByText(/73%/)).not.toBeInTheDocument();
  });

  it('renders the casual explanation and confidence % at casual level', () => {
    render(wrap(<SignalCard signal={mockSignal} experienceLevel="casual" />));
    expect(screen.getByText(/RSI rising/)).toBeInTheDocument();
    // Header carries a standalone "73%" span — assert it specifically, not the
    // explanation copy that also happens to contain "73%".
    expect(screen.getAllByText(/73%/).length).toBeGreaterThanOrEqual(2);
  });

  it('renders the technical block + risk params at self_directed level', () => {
    render(wrap(<SignalCard signal={mockSignal} experienceLevel="self_directed" />));
    expect(screen.getByText(/EMA20/)).toBeInTheDocument();
    // Stop, target, R/R row
    expect(screen.getByText(/Stop/)).toBeInTheDocument();
    expect(screen.getByText(/Target/)).toBeInTheDocument();
  });

  it('falls back to rationale when explanations are missing', () => {
    const noExpl: RetailSignal = {
      ...mockSignal,
      metadata: { ...mockSignal.metadata, explanations: undefined },
    };
    render(wrap(<SignalCard signal={noExpl} experienceLevel="beginner" />));
    expect(screen.getByText('EMA cross with volume confirmation')).toBeInTheDocument();
  });

  it('invokes onExecute when the action button is clicked', async () => {
    const onExecute = vi.fn();
    const { default: userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();

    render(wrap(<SignalCard signal={mockSignal} experienceLevel="beginner" onExecute={onExecute} />));
    await user.click(screen.getByRole('button', { name: /buy/i }));

    expect(onExecute).toHaveBeenCalledWith(mockSignal);
  });
});

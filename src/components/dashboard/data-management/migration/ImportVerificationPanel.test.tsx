import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ImportVerificationPanel } from './ImportVerificationPanel';
import { PgDumpErrorCategory, ImportSummary, ImportError, ImportLog } from '@/hooks/usePgDumpImport';

describe('ImportVerificationPanel', () => {
  const summary: ImportSummary = {
    status: 'partial',
    startTime: Date.now() - 5000,
    endTime: Date.now(),
    duration: 5000,
    statementsExecuted: 10,
    statementsFailed: 2,
    errors: [],
    phases: {
      schema: { executed: 5, failed: 1 },
      data: { executed: 5, failed: 1 },
      constraints: { executed: 0, failed: 0 },
      indexes: { executed: 0, failed: 0 },
      functions: { executed: 0, failed: 0 },
      policies: { executed: 0, failed: 0 },
    },
    metrics: {
      totalDuration: 5000,
      phases: {
        schema: { startTime: Date.now() - 4000, endTime: Date.now() - 3000, duration: 1000, executed: 5, failed: 1 },
        data: { startTime: Date.now() - 2000, endTime: Date.now() - 1000, duration: 1000, executed: 5, failed: 1 },
      },
    },
  };

  const errors: ImportError[] = [
    {
      index: 0,
      statement: 'INSERT INTO public.users(id) VALUES (1);',
      error: 'duplicate key value violates unique constraint "users_pkey"',
      timestamp: Date.now(),
      phase: 'data',
      category: PgDumpErrorCategory.CONSTRAINT_VIOLATION,
      severity: 'error',
      code: PgDumpErrorCategory.CONSTRAINT_VIOLATION,
    },
  ];

  const logs: ImportLog[] = [
    { timestamp: Date.now(), level: 'info', message: 'Applying Stage 1 schema changes' },
  ];

  it('renders code legend and badges', () => {
    render(<ImportVerificationPanel summary={{ ...summary, errors }} errors={errors} logs={logs} />);
    expect(screen.getByText(/Code Legend/i)).toBeInTheDocument();
    expect(screen.getByText(/303 Constraint Violation/i)).toBeInTheDocument();
  });

  it('shows category and phase duration badges in error list', () => {
    render(<ImportVerificationPanel summary={{ ...summary, errors }} errors={errors} logs={logs} />);
    expect(screen.getByText(/Statement #1/i)).toBeInTheDocument();
    expect(screen.getByText(/duplicate key value violates unique constraint/i)).toBeInTheDocument();
  });
});

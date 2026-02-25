import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TopAccounts } from '../TopAccounts';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');

describe('TopAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch top accounts from database', async () => {
    const mockAccounts = [
      {
        rank: 1,
        company_name: 'Acme Corp',
        annual_revenue: 1000000,
        growth: '+15%',
      },
    ];

    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb as any,
    } as any);

    render(<TopAccounts />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });

  it('should handle database errors', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb as any,
    } as any);

    render(<TopAccounts />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load accounts/)).toBeInTheDocument();
    });
  });
});

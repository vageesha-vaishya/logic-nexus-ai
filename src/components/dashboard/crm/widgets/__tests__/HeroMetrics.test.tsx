import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HeroMetrics } from '../HeroMetrics';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');

describe('HeroMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch today activities from scopedDb', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              count: 5,
              data: [],
            }),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: 0,
                data: [],
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });

  it('should fetch calls made today', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              count: 5,
              data: [],
            }),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: 3,
                data: [],
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(mockScopedDb.from).toHaveBeenCalledWith('activities');
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              error: new Error('Database error'),
              data: null,
            }),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                error: new Error('Database error'),
                data: null,
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      // It should display 0 for all metrics
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
  });
});

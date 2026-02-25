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
    const createMockChain = (count: number) => ({
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              count,
              data: [],
            }),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: Math.max(0, count - 2),
                data: [],
              }),
            }),
          }),
        }),
      }),
    });

    const mockScopedDb = createMockChain(5);

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb as any,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              count: null,
              error: new Error('Database error'),
            }),
          }),
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: null,
                error: new Error('Database error'),
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb as any,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      // Should show 0 for all metrics when there are errors
      const zeros = screen.getAllByText('0');
      expect(zeros.length).toBeGreaterThan(0);
    });
  });
});

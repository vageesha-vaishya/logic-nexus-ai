import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '@testing-library/jest-dom';
import MasterDataGeography from './MasterDataGeography';
import { useCRM } from '@/hooks/useCRM';
import { TooltipProvider } from '@/components/ui/tooltip';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useCRM');

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('MasterDataGeography', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies mdm-template contract for geography page and continent dialog', async () => {
    const order = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn(() => ({ order }));

    const from = vi.fn(() => ({
      select,
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      delete: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
    }));

    (useCRM as any).mockReturnValue({
      scopedDb: { from },
    });

    render(
      <TooltipProvider>
        <MasterDataGeography />
      </TooltipProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('master-data-geography-template')).toHaveClass('mdm-template-page');
    });

    expect(screen.getByPlaceholderText('Search by name')).toHaveClass('mdm-template-input');
    expect(screen.getByRole('tablist')).toHaveClass('mdm-template-tab-rail');
  });
});

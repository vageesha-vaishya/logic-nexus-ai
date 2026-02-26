import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TopAccounts } from '../TopAccounts';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');
vi.mock('@/components/ui/enterprise', () => ({
  EnterpriseTable: ({ data, columns }: any) => (
    <div>
      {data?.map((row: any) => (
        <div key={row.id}>{row.company_name}</div>
      ))}
    </div>
  ),
}));

describe('TopAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch top accounts from database', async () => {
    const mockAccounts = [
      {
        id: '1',
        company_name: 'Acme Corp',
        annual_revenue: 1000000,
        status: 'active',
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
      scopedDb: mockScopedDb,
    } as any);

    render(<TopAccounts />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });
});

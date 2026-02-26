import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MyActiveLeads } from '../MyActiveLeads';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');
vi.mock('@/components/ui/enterprise', () => ({
  EnterpriseTable: ({ data, columns }: any) => (
    <div>
      {data?.map((row: any) => (
        <div key={row.id}>
          {row.first_name} {row.last_name}
        </div>
      ))}
    </div>
  ),
}));

describe('MyActiveLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch contacts from database', async () => {
    const mockContacts = [
      {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0001',
        created_at: new Date().toISOString(),
      },
    ];

    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockContacts,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<MyActiveLeads />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
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
      scopedDb: mockScopedDb,
    } as any);

    render(<MyActiveLeads />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load leads/)).toBeInTheDocument();
    });
  });
});

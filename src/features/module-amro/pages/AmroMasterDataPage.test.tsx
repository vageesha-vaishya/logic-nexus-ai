import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AmroMasterDataPage from './AmroMasterDataPage';

const mockGetSession = vi.fn();
const mockRefreshSession = vi.fn();
const mockToastError = vi.fn();
const mockToastSuccess = vi.fn();

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    context: {
      tenantId: 'tenant-1',
      franchiseId: 'franchise-1',
      userId: 'user-1',
    },
  }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      refreshSession: (...args: unknown[]) => mockRefreshSession(...args),
    },
  },
}));

vi.mock('sonner', () => ({
  toast: {
    error: (...args: unknown[]) => mockToastError(...args),
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}));

describe('AmroMasterDataPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
        },
      },
    });
    mockRefreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: '',
        },
      },
    });
    const successPayload = {
      output: {
        records: [
          { id: 'ac-1', tail_number: 'N100AA', status: 'active' },
          { id: 'ac-2', tail_number: 'N200BB', status: 'inactive' },
        ],
      },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(successPayload),
      }),
    );
  });

  it('renders AMRO master data page and loads aircraft records', async () => {
    render(
      <MemoryRouter>
        <AmroMasterDataPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('heading', { name: 'AMRO Settings · Master Data' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Aircraft' })).toBeInTheDocument();
    expect(screen.getAllByText(/Bulk Import/i).length).toBeGreaterThan(0);

    await waitFor(() => {
      expect(screen.getByText('N100AA')).toBeInTheDocument();
    });
    expect(global.fetch).toHaveBeenCalled();
  });

  it('renders new AMRO master data entity options', async () => {
    render(
      <MemoryRouter>
        <AmroMasterDataPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole('tab', { name: 'Regulator Profiles' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Shift Calendars' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Work Package Templates' })).toBeInTheDocument();

    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalled();
    });
  });

  it('loads seed payload for work package templates', async () => {
    render(
      <MemoryRouter>
        <AmroMasterDataPage />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Work Package Templates' }));

    fireEvent.click(screen.getByRole('button', { name: 'Load Seed Payload' }));

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalled();
    });
  });

  it('handles empty successful API responses without JSON parsing errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => '',
      }),
    );

    render(
      <MemoryRouter>
        <AmroMasterDataPage />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(mockToastError).not.toHaveBeenCalledWith(
        expect.stringContaining("Failed to execute 'json' on 'Response'"),
      );
    });
  });
});

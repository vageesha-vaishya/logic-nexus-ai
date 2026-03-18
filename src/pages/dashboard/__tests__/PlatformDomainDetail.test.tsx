import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PlatformDomainDetail from '../PlatformDomainDetail';

const mockCreateDomain = vi.fn();
const mockToast = vi.fn();
const mockIsPlatformAdmin = vi.fn();
const mockHasPermission = vi.fn();

vi.mock('@/services/DomainService', () => ({
  DomainService: {
    createDomain: (...args: any[]) => mockCreateDomain(...args),
    updateDomain: vi.fn(),
    deleteDomain: vi.fn(),
    getAllDomains: vi.fn(),
  },
}));

vi.mock('@/services/ServiceArchitectureService', () => ({
  ServiceArchitectureService: {
    getCategoriesByDomain: vi.fn(),
    getTypesByCategory: vi.fn(),
    getServicesByType: vi.fn(),
    createCategory: vi.fn(),
    updateCategory: vi.fn(),
    deleteCategory: vi.fn(),
    createType: vi.fn(),
    updateType: vi.fn(),
    deleteType: vi.fn(),
  },
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: any[]) => mockToast(...args) }),
}));

vi.mock('@/hooks/useDebug', () => ({
  useDebug: () => ({
    error: vi.fn(),
    warn: vi.fn(),
    log: vi.fn(),
    group: vi.fn(),
    groupEnd: vi.fn(),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    isPlatformAdmin: mockIsPlatformAdmin,
    hasPermission: mockHasPermission,
  }),
}));

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

describe('PlatformDomainDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateDomain.mockResolvedValue({
      id: 'new-domain-id',
      code: 'finance',
      name: 'Finance',
      description: 'Finance domain',
      is_active: true,
    });
    mockIsPlatformAdmin.mockReturnValue(true);
    mockHasPermission.mockReturnValue(true);
  });

  const renderNewDomainPage = () =>
    render(
      <MemoryRouter initialEntries={['/dashboard/settings/domains/new']}>
        <Routes>
          <Route path="/dashboard/settings/domains/:id" element={<PlatformDomainDetail />} />
        </Routes>
      </MemoryRouter>
    );

  it('enables Save when platform admin enters valid values', async () => {
    const user = userEvent.setup();
    renderNewDomainPage();

    const saveButton = screen.getByRole('button', { name: 'Save' });
    expect(saveButton).toBeDisabled();

    await user.type(screen.getByLabelText('Name *'), 'Finance');
    await user.type(screen.getByLabelText('Code *'), 'finance');

    await waitFor(() => {
      expect(saveButton).toBeEnabled();
    });
  });

  it('creates a domain for platform admin on Save', async () => {
    const user = userEvent.setup();
    renderNewDomainPage();

    await user.type(screen.getByLabelText('Name *'), 'Finance');
    await user.type(screen.getByLabelText('Code *'), 'finance');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(mockCreateDomain).toHaveBeenCalledWith({
        name: 'Finance',
        code: 'finance',
        description: '',
        is_active: true,
      });
    });
  });

  it('keeps Save disabled for non-admin users', async () => {
    const user = userEvent.setup();
    mockIsPlatformAdmin.mockReturnValue(false);
    mockHasPermission.mockReturnValue(false);
    renderNewDomainPage();

    const saveButton = screen.getByRole('button', { name: 'Save' });
    await user.type(screen.getByLabelText('Name *'), 'Finance');
    await user.type(screen.getByLabelText('Code *'), 'finance');

    await waitFor(() => {
      expect(saveButton).toBeDisabled();
    });
    expect(mockCreateDomain).not.toHaveBeenCalled();
  });
});

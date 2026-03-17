import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdminScopeSwitcher } from './AdminScopeSwitcher';
import { useCRM } from '@/hooks/useCRM';

// Mock useCRM
vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

describe('AdminScopeSwitcher', () => {
  const mockSetAdminOverride = vi.fn();
  const mockSetScopePreference = vi.fn();

  const createQuery = (data: unknown[]) => {
    const query: any = {
      eq: vi.fn(() => query),
      order: vi.fn(() => query),
      then: (resolve: (value: { data: unknown[] }) => void) => resolve({ data }),
    };
    return query;
  };

  const createScopedDb = (tenants: unknown[] = []) => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => (table === 'tenants' ? createQuery(tenants) : createQuery([]))),
    })),
    logViewPreference: vi.fn(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render nothing if user is not platform admin', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: false },
      preferences: {},
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      scopedDb: createScopedDb(),
    });

    const { container } = render(<AdminScopeSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });

  it('should render "Global Admin" button if user is platform admin and override is disabled', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: true },
      preferences: { admin_override_enabled: false },
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      scopedDb: createScopedDb(),
    });

    render(<AdminScopeSwitcher />);
    expect(screen.getByText('Global Admin')).toBeInTheDocument();
  });

  it('does not expose all-tenants label for tenant-bound platform admins', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: true, ownedTenantId: 'tenant-1' },
      preferences: { admin_override_enabled: true, tenant_id: 'tenant-1', franchise_id: null },
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      scopedDb: createScopedDb([{ id: 'tenant-1', name: 'Miami Global Lines' }]),
    });

    render(<AdminScopeSwitcher />);
    expect(screen.getByText('Scoped View')).toBeInTheDocument();
    expect(screen.queryByText('All Tenants')).not.toBeInTheDocument();
  });

  it('shows all tenants label only for unbound platform admins', () => {
    (useCRM as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      context: { isPlatformAdmin: true, ownedTenantId: null },
      preferences: { admin_override_enabled: true, tenant_id: null, franchise_id: null },
      setAdminOverride: mockSetAdminOverride,
      setScopePreference: mockSetScopePreference,
      scopedDb: createScopedDb([{ id: 'tenant-1', name: 'Miami Global Lines' }]),
    });

    render(<AdminScopeSwitcher />);
    expect(screen.getByText('All Tenants')).toBeInTheDocument();
  });
});

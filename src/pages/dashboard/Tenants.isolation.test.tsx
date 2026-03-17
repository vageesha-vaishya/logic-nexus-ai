import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import Tenants from './Tenants';
import { useCRM } from '@/hooks/useCRM';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/components/system/FirstScreenTemplate', () => ({
  FirstScreenTemplate: ({ children, onCreate }: any) => (
    <div>
      <div data-testid="create-enabled">{String(Boolean(onCreate))}</div>
      {children}
    </div>
  ),
}));

vi.mock('@/components/system/EmptyState', () => ({
  EmptyState: ({ title }: any) => <div>{title}</div>,
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: vi.fn(),
}));

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

function createScopedDb(rows: any[]) {
  const result = { data: rows, error: null };
  const builder: any = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue(result),
    then: (resolve: any) => Promise.resolve(result).then(resolve),
  };
  return {
    from: vi.fn(() => builder),
    builder,
  };
}

describe('Tenants isolation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters tenants by authenticated tenant for tenant users', async () => {
    const { from, builder } = createScopedDb([
      { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', domain: null, subscription_tier: 'pro', is_active: true, created_at: new Date().toISOString() },
    ]);
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: false, tenantId: 'tenant-1' },
      scopedDb: { from },
    } as any);

    render(
      <BrowserRouter>
        <Tenants />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(builder.eq).toHaveBeenCalledWith('id', 'tenant-1');
    });
    expect(screen.getByTestId('create-enabled')).toHaveTextContent('false');
  });

  it('does not apply tenant eq filter for platform admins', async () => {
    const { from, builder } = createScopedDb([
      { id: 'tenant-1', name: 'Tenant One', slug: 'tenant-one', domain: null, subscription_tier: 'pro', is_active: true, created_at: new Date().toISOString() },
      { id: 'tenant-2', name: 'Tenant Two', slug: 'tenant-two', domain: null, subscription_tier: 'pro', is_active: true, created_at: new Date().toISOString() },
    ]);
    vi.mocked(useCRM).mockReturnValue({
      context: { isPlatformAdmin: true, tenantId: '' },
      scopedDb: { from },
    } as any);

    render(
      <BrowserRouter>
        <Tenants />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(builder.order).toHaveBeenCalled();
    });
    expect(builder.eq).not.toHaveBeenCalled();
    expect(screen.getByTestId('create-enabled')).toHaveTextContent('true');
  });
});

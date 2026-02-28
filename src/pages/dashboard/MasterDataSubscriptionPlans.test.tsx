import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MasterDataSubscriptionPlans from './MasterDataSubscriptionPlans';
import { BrowserRouter } from 'react-router-dom';
import '@testing-library/jest-dom';
import { useCRM } from '@/hooks/useCRM';
import { TooltipProvider } from '@/components/ui/tooltip';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div data-testid="dashboard-layout">{children}</div>,
}));

vi.mock('@/hooks/useCRM');

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

describe('MasterDataSubscriptionPlans', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows platform admin restriction when user is not platform admin', () => {
    (useCRM as any).mockReturnValue({
      scopedDb: { from: vi.fn() },
      context: { isPlatformAdmin: false },
    });

    render(
      <BrowserRouter>
        <TooltipProvider>
          <MasterDataSubscriptionPlans />
        </TooltipProvider>
      </BrowserRouter>,
    );

    expect(screen.getByText('Subscription Plans')).toBeInTheDocument();
    expect(screen.getByText('Only platform admins can manage subscription plans.')).toBeInTheDocument();
  });

  it('loads and displays plans for platform admins', async () => {
    const mockPlans = [
      {
        id: 'plan-1',
        name: 'Pro Plan',
        slug: 'pro',
        description: 'Pro tier',
        plan_type: 'crm_base',
        tier: 'professional',
        billing_period: 'monthly',
        price_monthly: 99,
        price_quarterly: null,
        price_annual: 999,
        currency: 'USD',
        features: {},
        limits: {},
        trial_period_days: 14,
        deployment_model: 'saas',
        supported_currencies: ['USD'],
        supported_languages: ['en'],
        metadata: {},
        is_active: true,
      },
    ];

    const mockOrder = vi.fn().mockResolvedValue({ data: mockPlans, error: null });
    const mockSelect = vi.fn(() => ({ order: mockOrder }));

    const from = vi.fn((table: string, readScope?: boolean) => {
      if (table === 'subscription_plans' && readScope) {
        return {
          select: mockSelect,
        };
      }
      return {
        select: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        insert: vi.fn(),
        eq: vi.fn(),
      };
    });

    (useCRM as any).mockReturnValue({
      scopedDb: { from },
      context: { isPlatformAdmin: true },
    });

    render(
      <BrowserRouter>
        <TooltipProvider>
          <MasterDataSubscriptionPlans />
        </TooltipProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Master Data: Subscription Plans')).toBeInTheDocument();
    });

    expect(await screen.findByText('Pro Plan')).toBeInTheDocument();
    expect(from).toHaveBeenCalledWith('subscription_plans', true);
  });

  it('validates required fields and sends payload with audit log on create', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelectRead = vi.fn(() => ({ order: mockOrder }));

    const mockSingle = vi.fn().mockResolvedValue({ data: { id: 'new-plan-id' }, error: null });
    const mockSelectInsert = vi.fn(() => ({ single: mockSingle }));
    const mockInsertPlan = vi.fn(() => ({ select: mockSelectInsert }));
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string, readScope?: boolean) => {
      if (table === 'subscription_plans' && readScope) {
        return {
          select: mockSelectRead,
        };
      }
      if (table === 'subscription_plans') {
        return {
          insert: mockInsertPlan,
          update: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn(),
          select: vi.fn(),
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: mockAuditInsert,
        };
      }
      return {
        select: vi.fn(),
      };
    });

    (useCRM as any).mockReturnValue({
      scopedDb: { from },
      context: { isPlatformAdmin: true },
    });

    render(
      <BrowserRouter>
        <MasterDataSubscriptionPlans />
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Master Data: Subscription Plans')).toBeInTheDocument();
    });

    const newPlanButton = screen.getByRole('button', { name: /New Plan/i });
    fireEvent.click(newPlanButton);

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);
    expect(mockInsertPlan).not.toHaveBeenCalled();

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const slugInput = screen.getByLabelText('Slug') as HTMLInputElement;
    const priceInput = screen.getByLabelText('Monthly Price') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Enterprise CRM' } });
    fireEvent.change(slugInput, { target: { value: 'enterprise-crm' } });
    fireEvent.change(priceInput, { target: { value: '199' } });

    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockInsertPlan).toHaveBeenCalledTimes(1);
    });

    const payload = (mockInsertPlan as any).mock.calls[0][0];

    expect(payload).toMatchObject({
      name: 'Enterprise CRM',
      slug: 'enterprise-crm',
      price_monthly: 199,
      currency: 'USD',
      plan_type: 'crm_base',
      billing_period: 'monthly',
      is_active: true,
    });

    await waitFor(() => {
      expect(mockAuditInsert).toHaveBeenCalledTimes(1);
    });

    const auditPayload = (mockAuditInsert as any).mock.calls[0][0];

    expect(auditPayload).toMatchObject({
      action: 'create',
      resource_type: 'subscription_plan',
      resource_id: 'new-plan-id',
    });
    expect(auditPayload.details).toMatchObject(payload);
  });

  it('disables save button while saving a subscription plan', async () => {
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockSelectRead = vi.fn(() => ({ order: mockOrder }));

    let resolveSingle: (value: any) => void = () => {};
    const mockSingle = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveSingle = resolve;
        }),
    );
    const mockSelectInsert = vi.fn(() => ({ single: mockSingle }));
    const mockInsertPlan = vi.fn(() => ({ select: mockSelectInsert }));
    const mockAuditInsert = vi.fn().mockResolvedValue({ error: null });

    const from = vi.fn((table: string, readScope?: boolean) => {
      if (table === 'subscription_plans' && readScope) {
        return {
          select: mockSelectRead,
        };
      }
      if (table === 'subscription_plans') {
        return {
          insert: mockInsertPlan,
          update: vi.fn().mockResolvedValue({ error: null }),
          delete: vi.fn().mockResolvedValue({ error: null }),
          eq: vi.fn(),
          select: vi.fn(),
        };
      }
      if (table === 'audit_logs') {
        return {
          insert: mockAuditInsert,
        };
      }
      return {
        select: vi.fn(),
      };
    });

    (useCRM as any).mockReturnValue({
      scopedDb: { from },
      context: { isPlatformAdmin: true },
    });

    render(
      <BrowserRouter>
        <TooltipProvider>
          <MasterDataSubscriptionPlans />
        </TooltipProvider>
      </BrowserRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Master Data: Subscription Plans')).toBeInTheDocument();
    });

    const newPlanButton = screen.getByRole('button', { name: /New Plan/i });
    fireEvent.click(newPlanButton);

    const nameInput = screen.getByLabelText('Name') as HTMLInputElement;
    const slugInput = screen.getByLabelText('Slug') as HTMLInputElement;
    const priceInput = screen.getByLabelText('Monthly Price') as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: 'Enterprise CRM' } });
    fireEvent.change(slugInput, { target: { value: 'enterprise-crm' } });
    fireEvent.change(priceInput, { target: { value: '199' } });

    const saveButton = screen.getByRole('button', { name: /^Save$/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^Save$/i })).toBeDisabled();
    });

    resolveSingle({ data: { id: 'new-plan-id' }, error: null });

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /^Save$/i })).not.toBeInTheDocument();
    });
  });
});

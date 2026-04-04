import { describe, expect, it, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import axe from 'axe-core';
import {
  UimAnalyticsForm,
  UimIssueConsumeForm,
  UimItemMasterForm,
  UimLocationsForm,
  UimOverviewForm,
  UimReservationsForm,
  UimRestockForm,
  UimStockLedgerForm,
} from './UimForms';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

const toastSpy = vi.fn();
vi.mock('@/components/ui/use-toast', () => ({
  toast: (payload: unknown) => toastSpy(payload),
}));

const forms = [
  ['Overview', UimOverviewForm],
  ['Item Master', UimItemMasterForm],
  ['Stock Ledger', UimStockLedgerForm],
  ['Reservation Engine', UimReservationsForm],
  ['Issue & Consume', UimIssueConsumeForm],
  ['Dynamic Restock', UimRestockForm],
  ['Location Registry', UimLocationsForm],
  ['Inventory Analytics', UimAnalyticsForm],
] as const;

describe('UIM form suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'entity-1' }),
    }));
  });

  it.each(forms)('renders empty state for %s form', async (_name, FormComponent) => {
    render(<FormComponent />);
    expect(screen.getByRole('button', { name: /Create/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reset/i })).toBeInTheDocument();
  });

  it('shows inline validation and summary banner for invalid item master submission', async () => {
    render(<UimItemMasterForm />);

    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(screen.getByText(/please resolve the following errors/i)).toBeInTheDocument();
  });

  it('submits create flow successfully and shows success toast', async () => {
    render(<UimOverviewForm />);

    fireEvent.change(screen.getByLabelText(/Module name/i), { target: { value: 'UIM Platform' } });
    fireEvent.change(screen.getByLabelText(/Owner email/i), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText(/Target go-live date/i), { target: { value: '2026-06-20' } });

    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalled();
    });
    expect(toastSpy).toHaveBeenCalled();
  });

  it('supports edit mode and uses update submit label', async () => {
    render(<UimOverviewForm existingEntity={{ id: '550e8400-e29b-41d4-a716-446655440000', module_name: 'Existing', owner_email: 'a@b.com', rollout_phase: 'phase_1', target_go_live_date: '2026-08-01', notes: '' }} />);
    expect(screen.getByRole('button', { name: /Update/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Update/i }));
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/forms/overview/550e8400-e29b-41d4-a716-446655440000'),
        expect.objectContaining({ method: 'PATCH' }),
      );
    });
  });

  it('rolls back on api failure and shows user-friendly error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ error: 'Internal server error' }),
    }));

    render(<UimOverviewForm />);
    fireEvent.change(screen.getByLabelText(/Module name/i), { target: { value: 'Will fail' } });
    fireEvent.change(screen.getByLabelText(/Owner email/i), { target: { value: 'ops@example.com' } });
    fireEvent.change(screen.getByLabelText(/Target go-live date/i), { target: { value: '2026-06-20' } });
    fireEvent.click(screen.getByRole('button', { name: /Create/i }));

    await waitFor(() => {
      expect(screen.getByText(/we could not save your changes/i)).toBeInTheDocument();
    });
  });

  it('passes axe accessibility audit with zero violations', async () => {
    const { container } = render(<UimReservationsForm />);
    const result = await axe.run(container);
    expect(result.violations).toHaveLength(0);
  });
});

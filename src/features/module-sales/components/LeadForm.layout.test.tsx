import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LeadForm } from './LeadForm';

const fromMock = vi.fn();
const mockContext = {
  tenantId: 'tenant-1',
  franchiseId: null as string | null,
  isPlatformAdmin: false,
  isTenantAdmin: false,
  isFranchiseAdmin: false,
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: {},
    context: mockContext,
    scopedDb: {
      from: fromMock,
    },
  }),
}));

vi.mock('@/components/forms/AdvancedFields', () => ({
  FileUploadField: () => <div data-testid="file-upload-field">FileUpload</div>,
}));

describe('LeadForm complex layout integration', () => {
  beforeEach(() => {
    fromMock.mockReset();
    mockContext.tenantId = 'tenant-1';
    mockContext.franchiseId = null;
    mockContext.isPlatformAdmin = false;
    mockContext.isTenantAdmin = false;
    mockContext.isFranchiseAdmin = false;
    localStorage.clear();
  });

  it('renders complex layout section for create mode', () => {
    render(<LeadForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);

    expect(screen.getByText('New Lead Details')).toBeInTheDocument();
    expect(screen.getByText('Complex entity form layout for lead profile and qualification')).toBeInTheDocument();
    expect(screen.getByLabelText('First Name *')).toBeInTheDocument();
    expect(screen.getByLabelText('Expected Close Date *')).toBeInTheDocument();
    expect(screen.queryByTestId('file-upload-field')).not.toBeInTheDocument();
  });

  it('renders edit mode layout and preserves submit flow', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LeadForm
        initialData={{
          id: 'lead-1',
          first_name: 'Jane',
          last_name: 'Doe',
          tenant_id: 'tenant-1',
          custom_fields: { service_id: 'Rail Freight' },
          source: 'email',
          status: 'contacted',
          expected_close_date: '2026-06-01',
          email: 'jane@acme.com',
        } as any}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Lead Details')).toBeInTheDocument();
    expect(screen.queryByText('Editable Fields')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await screen.findByText('Confirm Update');
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('supports save and new flow in create mode', async () => {
    const onSaveAndNew = vi.fn().mockResolvedValue(undefined);
    render(
      <LeadForm
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onSaveAndNew={onSaveAndNew}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Lane' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });
    fireEvent.change(screen.getByLabelText('Expected Close Date *'), { target: { value: '2026-06-01' } });
    fireEvent.change(screen.getByLabelText('Interested Service *'), { target: { value: 'Air Freight' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save & New' }));
    await screen.findByText('Confirm Create');
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(onSaveAndNew).toHaveBeenCalled();
    });
  });

  it('shows attachment controls on qualification step', async () => {
    render(<LeadForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Alex' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Lane' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'alex@example.com' } });

    await waitFor(() => {
      expect(screen.getByText('Attachments')).toBeInTheDocument();
      expect(screen.getByText('Your role cannot upload attachments.')).toBeInTheDocument();
      expect(screen.queryByTestId('file-upload-field')).not.toBeInTheDocument();
    });
  });

  it('renders tenant and franchise selectors for platform admin context', async () => {
    mockContext.isPlatformAdmin = true;
    fromMock.mockImplementation((table: string) => {
      if (table === 'tenants') {
        return {
          select: () => ({
            order: async () => ({ data: [{ id: 'tenant-1', name: 'Tenant One' }] }),
          }),
        };
      }
      if (table === 'franchises') {
        return {
          select: () => ({
            eq: () => ({
              order: async () => ({ data: [{ id: 'fr-1', name: 'Franchise One' }] }),
            }),
          }),
        };
      }
      return {
        select: () => ({ order: async () => ({ data: [] }) }),
      };
    });

    render(<LeadForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);
    expect(await screen.findByText('Tenant *')).toBeInTheDocument();
    expect(await screen.findByText('Franchise')).toBeInTheDocument();
  });

  it('shows conditional enterprise and lost fields', async () => {
    render(
      <LeadForm
        initialData={{
          first_name: 'Alex',
          last_name: 'Lane',
          email: 'alex@example.com',
          source: 'referral',
          status: 'lost',
          expected_close_date: '2026-07-01',
          tenant_id: 'tenant-1',
          custom_fields: {
            lead_type: 'enterprise',
          },
        } as any}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText('Referral Name *')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Referral Name *'), { target: { value: 'Pat Referral' } });

    expect(await screen.findByLabelText('Stakeholders Count *')).toBeInTheDocument();
    expect(screen.getByLabelText('Loss Reason *')).toBeInTheDocument();
  });

  it('loads and persists draft data with storage key', async () => {
    localStorage.setItem('lead-draft-key', JSON.stringify({
      first_name: 'Draft',
      last_name: 'User',
      expected_close_date: '2026-09-01',
      email: 'draft@example.com',
      service_id: 'Sea Freight',
      tenant_id: 'tenant-1',
      source: 'email',
      status: 'new',
    }));

    render(
      <LeadForm
        draftStorageKey="lead-draft-key"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByDisplayValue('Draft')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'Updated' } });

    await waitFor(() => {
      const saved = localStorage.getItem('lead-draft-key');
      expect(saved).toContain('Updated');
    }, { timeout: 2000 });
  }, 10000);

  it('submits through keyboard shortcut with confirmation', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <LeadForm
        initialData={{
          id: 'lead-ctrl-s',
          first_name: 'Jane',
          last_name: 'Doe',
          email: 'jane@acme.com',
          source: 'email',
          status: 'qualified',
          expected_close_date: '2026-08-01',
          tenant_id: 'tenant-1',
          custom_fields: { service_id: 'Air Freight' },
        } as any}
        onSubmit={onSubmit}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.keyDown(window, { key: 's', ctrlKey: true });
    await screen.findByText('Confirm Update');
    fireEvent.click(screen.getByText('Confirm'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  it('executes rich text toolbar actions on notes editor', async () => {
    const execCommandMock = vi.fn();
    (document as any).execCommand = execCommandMock;

    render(
      <LeadForm
        initialData={{
          first_name: 'Rich',
          last_name: 'Text',
          email: 'rich@example.com',
          source: 'email',
          status: 'qualified',
          expected_close_date: '2026-08-01',
          tenant_id: 'tenant-1',
          custom_fields: { service_id: 'Air Freight' },
        } as any}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByLabelText('Bold'));

    expect(execCommandMock).toHaveBeenCalledWith('bold');
  });

  it('loads franchise name for franchise scoped users', async () => {
    mockContext.franchiseId = 'fr-22';
    fromMock.mockImplementation(() => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 'fr-22', name: 'Franchise Twenty Two' } }),
        }),
      }),
    }));

    render(<LeadForm onSubmit={vi.fn().mockResolvedValue(undefined)} onCancel={vi.fn()} />);
    expect(await screen.findByDisplayValue('Franchise Twenty Two')).toBeInTheDocument();
  });

  it('applies recommendation selection into service, value and notes', async () => {
    render(
      <LeadForm
        recommendationSelection={{
          mode: 'Rail',
          price: '$1,250',
          bestFor: 'Heavy cargo',
          interchangePoints: 'LAX > DFW',
        } as any}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText('First Name *'), { target: { value: 'Reco' } });
    fireEvent.change(screen.getByLabelText('Last Name *'), { target: { value: 'User' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'reco@example.com' } });
    expect(await screen.findByDisplayValue('Rail')).toBeInTheDocument();
    expect(await screen.findByDisplayValue('1250')).toBeInTheDocument();
  });

  it('renders attachment file summary when draft contains attachments', async () => {
    localStorage.setItem('lead-files-key', JSON.stringify({
      first_name: 'Files',
      last_name: 'User',
      expected_close_date: '2026-09-01',
      email: 'files@example.com',
      service_id: 'Sea Freight',
      tenant_id: 'tenant-1',
      source: 'email',
      status: 'new',
      attachments: [{ name: 'brief.pdf', type: 'application/pdf', size: 4096 }],
    }));

    render(
      <LeadForm
        draftStorageKey="lead-files-key"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByText('brief.pdf')).toBeInTheDocument();
  });

  it('handles invalid draft JSON without crashing', () => {
    localStorage.setItem('bad-draft-key', '{"first_name":');
    render(
      <LeadForm
        draftStorageKey="bad-draft-key"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('First Name *')).toBeInTheDocument();
  });

  it('executes all rich text toolbar commands', async () => {
    const execCommandMock = vi.fn();
    (document as any).execCommand = execCommandMock;

    render(
      <LeadForm
        initialData={{
          first_name: 'Cmd',
          last_name: 'Runner',
          email: 'cmd@example.com',
          source: 'email',
          status: 'qualified',
          expected_close_date: '2026-08-01',
          tenant_id: 'tenant-1',
          custom_fields: { service_id: 'Air Freight' },
        } as any}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    await screen.findByText('Attachments');
    fireEvent.click(screen.getByLabelText('Bold'));
    fireEvent.click(screen.getByLabelText('Italic'));
    fireEvent.click(screen.getByLabelText('Underline'));
    fireEvent.click(screen.getByLabelText('Unordered list'));
    fireEvent.click(screen.getByLabelText('Ordered list'));

    expect(execCommandMock).toHaveBeenNthCalledWith(1, 'bold');
    expect(execCommandMock).toHaveBeenNthCalledWith(2, 'italic');
    expect(execCommandMock).toHaveBeenNthCalledWith(3, 'underline');
    expect(execCommandMock).toHaveBeenNthCalledWith(4, 'insertUnorderedList');
    expect(execCommandMock).toHaveBeenNthCalledWith(5, 'insertOrderedList');
  });
});

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadWorkspaceSections } from './LeadWorkspaceSections';

const mockAccountsInsert = vi.fn();
const mockContactsInsert = vi.fn();
const mockLeadsUpdate = vi.fn();
const mockActivitiesInsert = vi.fn();
const featureFlagState = {
  lead_workspace_enhancements_v1: true,
  lead_workspace_scrolling_v1: true,
};

const dbState = {
  leadCustomFields: {} as Record<string, unknown>,
  accounts: [
    { id: 'acc-1', name: 'Acme Inc', industry: 'Logistics', phone: '5551111', website: 'https://acme.test' },
  ],
  contacts: [
    { id: 'con-1', account_id: 'acc-1', first_name: 'Alex', last_name: 'Lane', title: 'Manager', email: 'alex@acme.test', phone: '5552222' },
  ],
};

const mockScopedDb = {
  from: vi.fn((table: string) => {
    if (table === 'leads') {
      return {
        select: (fields: string) => ({
          eq: () => ({
            single: async () => ({
              data: fields.includes('description')
                ? { custom_fields: dbState.leadCustomFields, description: '', notes: '' }
                : { custom_fields: dbState.leadCustomFields },
              error: null,
            }),
          }),
        }),
        update: (payload: Record<string, unknown>) => ({
          eq: async () => {
            mockLeadsUpdate(payload);
            dbState.leadCustomFields = {
              ...(payload.custom_fields as Record<string, unknown>),
            };
            return { error: null };
          },
        }),
      };
    }

    // Phase 2 Step 4b — frontend reads switched to v_accounts. The
    // mock accepts both names so this test stays decoupled from the
    // legacy/view transition.
    if (table === 'accounts' || table === 'v_accounts') {
      return {
        select: () => ({
          order: () => ({
            limit: async () => ({ data: dbState.accounts, error: null }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          mockAccountsInsert(payload);
          const created = {
            id: 'acc-new',
            name: String(payload.name || ''),
            industry: (payload.industry as string | null) || null,
            phone: (payload.phone as string | null) || null,
            website: (payload.website as string | null) || null,
          };
          dbState.accounts = [created, ...dbState.accounts];
          return {
            select: () => ({
              single: async () => ({ data: created, error: null }),
            }),
          };
        },
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: dbState.accounts[0], error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }

    if (table === 'contacts' || table === 'v_contacts') {
      return {
        select: () => ({
          order: () => ({
            limit: async () => ({ data: dbState.contacts, error: null }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          mockContactsInsert(payload);
          const created = {
            id: 'con-new',
            account_id: (payload.account_id as string | null) || null,
            first_name: String(payload.first_name || ''),
            last_name: String(payload.last_name || ''),
            title: (payload.title as string | null) || null,
            email: (payload.email as string | null) || null,
            phone: (payload.phone as string | null) || null,
          };
          dbState.contacts = [created, ...dbState.contacts];
          return {
            select: () => ({
              single: async () => ({ data: created, error: null }),
            }),
          };
        },
        update: () => ({
          eq: () => ({
            select: () => ({
              single: async () => ({ data: dbState.contacts[0], error: null }),
            }),
          }),
        }),
        delete: () => ({
          eq: async () => ({ error: null }),
        }),
      };
    }

    if (table === 'activities') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              order: () => ({
                limit: async () => ({ data: [], error: null }),
              }),
            }),
          }),
        }),
        insert: (payload: Record<string, unknown>) => {
          mockActivitiesInsert(payload);
          return Promise.resolve({ error: null });
        },
      };
    }

    return {
      select: () => ({
        order: () => ({
          limit: async () => ({ data: [], error: null }),
        }),
      }),
    };
  }),
};

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    scopedDb: mockScopedDb,
    context: { tenantId: 'tenant-1', franchiseId: 'fr-1' },
    supabase: {},
  }),
}));

vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<any>('@/lib/feature-flags');
  return {
    ...actual,
    useAppFeatureFlag: vi.fn((key: string, defaultValue: boolean = false) => ({
      enabled: key in featureFlagState ? featureFlagState[key as keyof typeof featureFlagState] : defaultValue,
      isLoading: false,
      error: null,
    })),
  };
});

vi.mock('@/components/crm/LeadForm', () => ({
  LeadForm: ({ sectionDescription, hideNarrativeFields }: { sectionDescription?: string; hideNarrativeFields?: boolean }) => (
    <div data-testid="lead-form-mock">
      <span>{sectionDescription}</span>
      <span>{hideNarrativeFields ? 'narrative-hidden' : 'narrative-visible'}</span>
    </div>
  ),
}));

vi.mock('@/components/crm/LeadActivitiesTimeline', () => ({
  LeadActivitiesTimeline: () => <div data-testid="lead-activities-timeline" />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('LeadWorkspaceSections', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    featureFlagState.lead_workspace_enhancements_v1 = true;
    featureFlagState.lead_workspace_scrolling_v1 = true;
    dbState.leadCustomFields = {};
    dbState.accounts = [
      { id: 'acc-1', name: 'Acme Inc', industry: 'Logistics', phone: '5551111', website: 'https://acme.test' },
    ];
    dbState.contacts = [
      { id: 'con-1', account_id: 'acc-1', first_name: 'Alex', last_name: 'Lane', title: 'Manager', email: 'alex@acme.test', phone: '5552222' },
    ];
  });

  it('renders tab order, communication label, and scrolling containers', async () => {
    render(
      <LeadWorkspaceSections
        mode="create"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByText('Communication')).toBeInTheDocument();
    expect(screen.getByText('Lead profile details and qualification fields')).toBeInTheDocument();
    expect(screen.getByText('narrative-hidden')).toBeInTheDocument();

    const bottomTabList = screen.getAllByRole('tablist').find((tabList) =>
      within(tabList).queryByRole('tab', { name: 'Account' }),
    );
    expect(bottomTabList).toBeDefined();
    const bottomTabs = within(bottomTabList as HTMLElement).getAllByRole('tab');
    expect(bottomTabs.map((tab) => tab.textContent?.trim())).toEqual([
      'Account',
      'Contacts',
      'Internal Notes and Extra Info',
      'Extra Info',
      'AI',
      'Lead Information',
    ]);

    expect(screen.getByLabelText('Main lead section')).toHaveClass('overflow-y-auto', 'scroll-smooth');
    expect(screen.getByLabelText('Bottom lead section')).toHaveClass('overflow-y-auto', 'scroll-smooth');
    expect(screen.getByLabelText('Communication section')).toHaveClass('overflow-y-auto', 'scroll-smooth');

    await waitFor(() => {
      // Phase 2 Step 4b — component reads from v_accounts / v_contacts
      // views; legacy table names accepted by the mock dispatcher above.
      expect(mockScopedDb.from).toHaveBeenCalledWith('v_accounts');
      expect(mockScopedDb.from).toHaveBeenCalledWith('v_contacts');
    });
  });

  it('executes account and contact create flows and syncs lead relationships', async () => {
    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Account Name *'), { target: { value: 'Northwind' } });
    fireEvent.change(screen.getByPlaceholderText('Industry'), { target: { value: 'Distribution' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    await waitFor(() => {
      expect(mockAccountsInsert).toHaveBeenCalled();
    });

    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    await screen.findByPlaceholderText('Search contact');
    const firstNameInput = await screen.findByPlaceholderText('First Name *');
    const lastNameInput = await screen.findByPlaceholderText('Last Name *');
    const emailInput = await screen.findByPlaceholderText('Email');
    fireEvent.change(firstNameInput, { target: { value: 'Jordan' } });
    fireEvent.change(lastNameInput, { target: { value: 'Miles' } });
    fireEvent.change(emailInput, { target: { value: 'jordan@northwind.test' } });
    const contactPanel = firstNameInput.closest('[role="tabpanel"]') as HTMLElement;
    fireEvent.click(within(contactPanel).getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(mockContactsInsert).toHaveBeenCalled();
      expect(mockLeadsUpdate).toHaveBeenCalled();
    });

    const lastContactPayload = mockContactsInsert.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(lastContactPayload.first_name).toBe('Jordan');
    expect(lastContactPayload.last_name).toBe('Miles');
  });

  it('validates account website and contact email before creating records', async () => {
    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Account Name *'), { target: { value: 'Northwind' } });
    fireEvent.change(screen.getByPlaceholderText('Website'), { target: { value: 'bad url value' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Create' })[0]);

    expect(screen.getByText('Account website must be a valid URL')).toBeInTheDocument();
    expect(mockAccountsInsert).not.toHaveBeenCalled();

    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    const firstNameInput = await screen.findByPlaceholderText('First Name *');
    const lastNameInput = await screen.findByPlaceholderText('Last Name *');
    const emailInput = await screen.findByPlaceholderText('Email');
    fireEvent.change(firstNameInput, { target: { value: 'Jordan' } });
    fireEvent.change(lastNameInput, { target: { value: 'Miles' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email' } });
    const contactPanel = firstNameInput.closest('[role="tabpanel"]') as HTMLElement;
    fireEvent.click(within(contactPanel).getByRole('button', { name: 'Create' }));

    expect(screen.getByText('Contact email must be a valid email address')).toBeInTheDocument();
    expect(mockContactsInsert).not.toHaveBeenCalled();
  });

  it('updates CRUD state badges across account and contact read and update states', async () => {
    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Account create mode')).toHaveTextContent('Create mode');
    const accountListItem = await screen.findByRole('button', { name: /Acme Inc/i });
    await user.click(accountListItem);
    expect(screen.getByLabelText('Account read mode')).toHaveTextContent('Read mode');

    fireEvent.change(screen.getByPlaceholderText('Account Name *'), { target: { value: 'Acme Prime' } });
    expect(screen.getByLabelText('Account update mode')).toHaveTextContent('Update mode');

    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect(await screen.findByLabelText('Contact create mode')).toHaveTextContent('Create mode');
    const contactListItem = await screen.findByRole('button', { name: /Alex Lane/i });
    await user.click(contactListItem);
    expect(screen.getByLabelText('Contact read mode')).toHaveTextContent('Read mode');

    fireEvent.change(screen.getByPlaceholderText('First Name *'), { target: { value: 'Alexa' } });
    expect(screen.getByLabelText('Contact update mode')).toHaveTextContent('Update mode');
  });

  it('filters account and contact lists from search inputs', async () => {
    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    const accountSearch = await screen.findByPlaceholderText('Search account');
    fireEvent.change(accountSearch, { target: { value: 'nomatch-value' } });
    expect(await screen.findByText('No accounts found')).toBeInTheDocument();
    fireEvent.change(accountSearch, { target: { value: 'Acme' } });
    expect(await screen.findByRole('button', { name: /Acme Inc/i })).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    const contactSearch = await screen.findByPlaceholderText('Search contact');
    fireEvent.change(contactSearch, { target: { value: 'nomatch-value' } });
    expect(await screen.findByText('No contacts found')).toBeInTheDocument();
    fireEvent.change(contactSearch, { target: { value: 'Alex' } });
    expect(await screen.findByRole('button', { name: /Alex Lane/i })).toBeInTheDocument();
  });

  it('keeps enhanced bottom tab layout active when feature flags are disabled', async () => {
    featureFlagState.lead_workspace_enhancements_v1 = false;
    featureFlagState.lead_workspace_scrolling_v1 = false;

    render(
      <LeadWorkspaceSections
        mode="create"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Account' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Contacts' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Internal Notes and Extra Info' })).toBeInTheDocument();
    expect(screen.getByText('Lead profile details and qualification fields')).toBeInTheDocument();
    expect(screen.getByText('narrative-hidden')).toBeInTheDocument();
  });

  it('supports keyboard scrolling in main section', async () => {
    render(
      <LeadWorkspaceSections
        mode="create"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    const mainSection = screen.getByLabelText('Main lead section');
    const scrollBy = vi.fn();
    const scrollTo = vi.fn();
    Object.defineProperty(mainSection, 'scrollBy', { value: scrollBy, configurable: true });
    Object.defineProperty(mainSection, 'scrollTo', { value: scrollTo, configurable: true });
    Object.defineProperty(mainSection, 'clientHeight', { value: 480, configurable: true });
    Object.defineProperty(mainSection, 'scrollHeight', { value: 2400, configurable: true });

    fireEvent.keyDown(mainSection, { key: 'ArrowDown' });
    fireEvent.keyDown(mainSection, { key: 'PageDown' });
    fireEvent.keyDown(mainSection, { key: 'Home' });
    fireEvent.keyDown(mainSection, { key: 'End' });

    expect(scrollBy).toHaveBeenCalledWith({ top: 48, behavior: 'smooth' });
    expect(scrollBy).toHaveBeenCalledWith({ top: 384, behavior: 'smooth' });
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
    expect(scrollTo).toHaveBeenCalledWith({ top: 2400, behavior: 'smooth' });
  });

  it('restores persisted scroll positions for all workspace sections', async () => {
    localStorage.setItem(
      'lead.workspace.scroll.lead-1',
      JSON.stringify({ main: 180, bottom: 220, communication: 75 }),
    );

    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Main lead section').scrollTop).toBe(180);
      expect(screen.getByLabelText('Bottom lead section').scrollTop).toBe(220);
      expect(screen.getByLabelText('Communication section').scrollTop).toBe(75);
    });
  });

  it('renders description in internal notes and notes in extra info tab', async () => {
    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    await user.click(screen.getByRole('tab', { name: 'Internal Notes and Extra Info' }));
    expect(await screen.findByText('Description')).toBeInTheDocument();
    expect(screen.queryByLabelText('Notes Bold')).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Extra Info' }));
    expect(await screen.findByLabelText('Notes Bold')).toBeInTheDocument();
  });

  it('handles account and contact list rendering with 1000 records', async () => {
    dbState.accounts = Array.from({ length: 1000 }, (_, index) => ({
      id: `acc-${index + 1}`,
      name: `Account ${index + 1}`,
      industry: index % 2 === 0 ? 'Logistics' : 'Supply Chain',
      phone: `555${String(index + 1000)}`,
      website: `https://account-${index + 1}.test`,
    }));
    dbState.contacts = Array.from({ length: 1000 }, (_, index) => ({
      id: `con-${index + 1}`,
      account_id: `acc-${(index % 100) + 1}`,
      first_name: `First${index + 1}`,
      last_name: `Last${index + 1}`,
      title: 'Manager',
      email: `contact${index + 1}@test.com`,
      phone: `777${String(index + 1000)}`,
    }));

    const user = userEvent.setup();
    render(
      <LeadWorkspaceSections
        mode="edit"
        leadId="lead-1"
        onSubmit={vi.fn().mockResolvedValue(undefined)}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByText('Account 1000')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search account'), { target: { value: 'Account 1000' } });
    expect(await screen.findByText('Account 1000')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Contacts' }));
    expect(await screen.findByText('First1000 Last1000')).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('Search contact'), { target: { value: 'First1000' } });
    expect(await screen.findByText('First1000 Last1000')).toBeInTheDocument();
  }, 15000);
});

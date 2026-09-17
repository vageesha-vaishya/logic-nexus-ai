import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/oauth', () => ({
  initiateGoogleOAuth: vi.fn(),
  initiateMicrosoftOAuth: vi.fn(),
  handleOAuthCallback: vi.fn(),
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: { userId: 'user-1', tenantId: 'tenant-1', franchiseId: null } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

// The shared logger masks PII by calling String.replace on its first argument;
// this component passes a raw error object to logger.error, which would surface
// as an unhandled rejection in the test runner. Stub it out.
vi.mock('@/lib/logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const invokeFunctionMock = vi.fn();
const invokeAnonymousMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
  invokeAnonymous: (...args: unknown[]) => invokeAnonymousMock(...args),
}));

import { EmailAutoSetup } from './EmailAutoSetup';

const DISCOVERY_RESULT = {
  provider: 'generic-imap',
  displayName: 'Example Mail',
  type: 'imap',
  imap: {
    host: 'imap.example.com',
    port: 993,
    username: '%EMAIL%',
    secure: true,
  },
  smtp: {
    host: 'smtp.example.com',
    port: 587,
    username: '%EMAIL%',
    socketType: 'STARTTLS',
  },
};

function mockAnonymousFlow() {
  invokeAnonymousMock.mockImplementation(async (fn: string) => {
    if (fn === 'discover-email-settings') return DISCOVERY_RESULT;
    if (fn === 'verify-email-credentials') return { success: true };
    throw new Error(`Unexpected anonymous function: ${fn}`);
  });
}

async function walkToConnect(user: ReturnType<typeof userEvent.setup>) {
  await user.type(await screen.findByLabelText(/Email Address/i), 'person@example.com');
  await user.click(screen.getByRole('button', { name: /^Continue$/i }));

  await user.type(await screen.findByLabelText(/^Password$/i), 'super-secret-pw');
  await user.click(screen.getByRole('button', { name: /Connect Account/i }));
}

describe('EmailAutoSetup save flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the discovered account through the save-smtp-imap-account edge function (never a direct table insert)', async () => {
    mockAnonymousFlow();
    invokeFunctionMock.mockResolvedValue({ data: { id: 'new-acc' }, error: null });

    const user = userEvent.setup();
    render(<EmailAutoSetup onSuccess={vi.fn()} onManual={vi.fn()} onClose={vi.fn()} />);

    await walkToConnect(user);

    await waitFor(() => expect(invokeFunctionMock).toHaveBeenCalledWith(
      'save-smtp-imap-account',
      expect.objectContaining({
        body: expect.objectContaining({
          provider: 'smtp_imap',
          display_name: 'person',
          email_address: 'person@example.com',
          is_primary: false,
          imap_host: 'imap.example.com',
          imap_port: 993,
          imap_username: 'person@example.com',
          imap_password: 'super-secret-pw',
          imap_use_ssl: true,
          smtp_host: 'smtp.example.com',
          smtp_port: 587,
          smtp_username: 'person@example.com',
          smtp_password: 'super-secret-pw',
          smtp_use_tls: true,
        }),
      }),
    ));

    // The edge function derives ownership server-side from the caller's JWT.
    const body = invokeFunctionMock.mock.calls[0][1].body;
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('franchise_id');

    expect(await screen.findByText(/Account Connected!/i)).toBeInTheDocument();
  }, 15000);

  it('surfaces a save-smtp-imap-account error and returns to the password step', async () => {
    mockAnonymousFlow();
    invokeFunctionMock.mockResolvedValue({
      data: null,
      error: { message: "Could not find the 'imap_password' column of 'email_accounts' in the schema cache" },
    });

    const user = userEvent.setup();
    render(<EmailAutoSetup onSuccess={vi.fn()} onManual={vi.fn()} onClose={vi.fn()} />);

    await walkToConnect(user);

    expect(
      await screen.findByText("Could not find the 'imap_password' column of 'email_accounts' in the schema cache"),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Connect Account/i })).toBeInTheDocument();
    expect(screen.queryByText(/Account Connected!/i)).not.toBeInTheDocument();
  }, 15000);
});

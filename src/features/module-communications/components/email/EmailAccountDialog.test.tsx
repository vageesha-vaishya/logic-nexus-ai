import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const initiateGoogleOAuthMock = vi.fn();
const initiateMicrosoftOAuthMock = vi.fn();
vi.mock('@/lib/oauth', () => ({
  initiateGoogleOAuth: (...args: unknown[]) => initiateGoogleOAuthMock(...args),
  initiateMicrosoftOAuth: (...args: unknown[]) => initiateMicrosoftOAuthMock(...args),
  handleOAuthCallback: vi.fn(),
}));

const toastMock = vi.fn();
vi.mock('@/hooks/use-toast', () => ({
  toast: (...args: unknown[]) => toastMock(...args),
  useToast: () => ({ toast: (...args: unknown[]) => toastMock(...args) }),
}));

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: { userId: 'user-1' } }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: { getUser: vi.fn() } },
}));

const invokeFunctionMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));

import { EmailAccountDialog } from './EmailAccountDialog';

vi.mock('./EmailAutoSetup', () => ({
  EmailAutoSetup: ({ onManual }: { onManual: () => void }) => (
    <button onClick={onManual}>Manual Configure (test)</button>
  ),
}));

function officeAccount() {
  return {
    id: 'acc-1',
    provider: 'office365',
    email_address: 'existing@outlook.com',
    display_name: 'Existing Account',
    is_primary: false,
  };
}

function gmailAccount() {
  return {
    id: 'acc-2',
    provider: 'gmail',
    email_address: 'existing@gmail.com',
    display_name: 'Existing Gmail',
    is_primary: false,
  };
}

function smtpImapAccount() {
  return {
    id: 'acc-smtp-imap',
    provider: 'smtp_imap',
    email_address: 'test@example.com',
    display_name: 'Test SMTP Account',
    is_primary: false,
    smtp_host: 'smtp.example.com',
    smtp_port: 587,
    smtp_username: 'test@example.com',
    smtp_use_tls: true,
    imap_host: 'imap.example.com',
    imap_port: 993,
    imap_username: 'test@example.com',
    imap_use_ssl: true,
    // smtp_password / imap_password intentionally absent: those columns
    // were dropped from email_accounts, so a real fetched row never has
    // them -- the user must always retype the password to save it.
  };
}

describe('EmailAccountDialog OAuth connect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows an error toast when Microsoft OAuth initiation rejects (the exact production failure)', async () => {
    initiateMicrosoftOAuthMock.mockRejectedValue(
      new Error('Office 365 OAuth not configured. System administrator must set VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.'),
    );
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={officeAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Microsoft Office 365/i });
    await user.click(connectButton);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Office 365 OAuth not configured. System administrator must set VITE_MICROSOFT_CLIENT_ID or User must provide custom configuration.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('shows an error toast when Google OAuth initiation rejects (same defect, other branch)', async () => {
    initiateGoogleOAuthMock.mockRejectedValue(new Error('Gmail OAuth not configured for this test.'));
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={gmailAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Gmail/i });
    await user.click(connectButton);

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: 'Gmail OAuth not configured for this test.',
          variant: 'destructive',
        }),
      ),
    );
  });

  it('does not show an error toast when Google OAuth initiation succeeds', async () => {
    initiateGoogleOAuthMock.mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={gmailAccount()}
        onSuccess={vi.fn()}
      />,
    );

    const connectButton = await screen.findByRole('button', { name: /Connect with Gmail/i });
    await user.click(connectButton);

    await waitFor(() => expect(initiateGoogleOAuthMock).toHaveBeenCalledWith('user-1'));
    expect(toastMock).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }));
  });
});

describe('EmailAccountDialog SMTP/IMAP save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves SMTP/IMAP credentials via the save-smtp-imap-account edge function (the exact live bug fixed today)', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { id: 'acc-smtp-imap' }, error: null });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={smtpImapAccount()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(await screen.findByLabelText(/SMTP Password/i), 'new-smtp-app-password');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'new-imap-app-password');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(invokeFunctionMock).toHaveBeenCalledWith('save-smtp-imap-account', {
        body: expect.objectContaining({
          accountId: 'acc-smtp-imap',
          provider: 'smtp_imap',
          smtp_host: 'smtp.example.com',
          smtp_password: 'new-smtp-app-password',
          imap_host: 'imap.example.com',
          imap_password: 'new-imap-app-password',
        }),
      }),
    );
    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Success', description: 'Account updated successfully' }),
      ),
    );
  });

  it('shows an error toast when save-smtp-imap-account returns an error (e.g. the old dropped-column failure)', async () => {
    invokeFunctionMock.mockResolvedValue({
      data: null,
      error: { message: "Could not find the 'imap_password' column of 'email_accounts' in the schema cache" },
    });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={smtpImapAccount()}
        onSuccess={vi.fn()}
      />,
    );

    await user.type(await screen.findByLabelText(/SMTP Password/i), 'new-smtp-app-password');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'new-imap-app-password');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(toastMock).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Error',
          description: "Could not find the 'imap_password' column of 'email_accounts' in the schema cache",
          variant: 'destructive',
        }),
      ),
    );
  });

  it('passes accountId: undefined when creating a brand-new SMTP/IMAP account', async () => {
    // Extended timeout: this test drives 10 sequential userEvent.type() calls
    // under jsdom, which reliably lands right at (or just past) the default
    // 5000ms testTimeout in this environment.
    invokeFunctionMock.mockResolvedValue({ data: { id: 'new-acc' }, error: null });
    const user = userEvent.setup();
    render(
      <EmailAccountDialog
        open={true}
        onOpenChange={vi.fn()}
        account={undefined}
        onSuccess={vi.fn()}
      />,
    );

    await user.click(await screen.findByRole('button', { name: /Manual Configure \(test\)/i }));
    await user.click(screen.getByRole('tab', { name: /SMTP \/ IMAP/i }));

    await user.type(screen.getByLabelText(/Display Name/i), 'New SMTP Account');
    await user.type(screen.getByLabelText(/Email Address/i), 'new@example.com');
    await user.type(screen.getByLabelText(/SMTP Host/i), 'smtp.new.com');
    await user.type(screen.getByLabelText(/SMTP Port/i), '587');
    await user.type(screen.getByLabelText(/SMTP Username/i), 'new@example.com');
    await user.type(screen.getByLabelText(/SMTP Password/i), 'smtp-pw');
    await user.type(screen.getByLabelText(/IMAP Host/i), 'imap.new.com');
    await user.type(screen.getByLabelText(/IMAP Port/i), '993');
    await user.type(screen.getByLabelText(/IMAP Username/i), 'new@example.com');
    await user.type(screen.getByLabelText(/IMAP Password/i), 'imap-pw');
    await user.click(screen.getByRole('button', { name: /Save Account/i }));

    await waitFor(() =>
      expect(invokeFunctionMock).toHaveBeenCalledWith('save-smtp-imap-account', {
        body: expect.objectContaining({
          accountId: undefined,
          provider: 'smtp_imap',
          display_name: 'New SMTP Account',
        }),
      }),
    );
  }, 15000);
});

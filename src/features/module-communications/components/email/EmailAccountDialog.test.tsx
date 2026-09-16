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

import { EmailAccountDialog } from './EmailAccountDialog';

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

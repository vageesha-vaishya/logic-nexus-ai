import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('./DomainManagement', () => ({
  DomainManagement: () => <div data-testid="domain-management" />,
}));
vi.mock('./EmailAccountDialog', () => ({
  EmailAccountDialog: () => null,
}));
vi.mock('@/components/ui/use-toast', () => ({
  toast: vi.fn(),
}));

const invokeFunctionMock = vi.fn();
vi.mock('@/lib/supabase-functions', () => ({
  invokeFunction: (...args: unknown[]) => invokeFunctionMock(...args),
}));

// `useCRM` must return referentially-stable `context`/`scopedDb` objects
// across renders: EmailClientSettings' accounts-fetch `useEffect` depends
// on `scopedDb`, so a mock that returns a fresh object literal on every
// call would re-trigger that effect every render (setAccounts -> re-render
// -> new scopedDb -> effect fires again), looping until the worker crashes.
// `vi.hoisted` is required because `vi.mock` factories are hoisted above
// normal top-level `const`s.
const { scopedDbMock, contextMock } = vi.hoisted(() => {
  const scopedDbMock = {
    client: { auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }) } },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          order: vi.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
    })),
  };
  const contextMock = { tenantId: 'tenant-1', franchiseId: null };
  return { scopedDbMock, contextMock };
});

vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({ context: contextMock, scopedDb: scopedDbMock }),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {},
}));

import { EmailClientSettings } from './EmailClientSettings';
import { toast } from '@/components/ui/use-toast';

// The `Label` components in this form are plain sibling elements next to
// their `Input` (no `htmlFor`/`id` association, no wrapping), so
// `screen.getByLabelText` cannot resolve them per testing-library's
// accessible-name rules. Locate the input via its label's sibling
// container instead, matching the actual rendered DOM structure.
function getInputByLabelText(text: string): HTMLInputElement {
  const label = screen.getByText(text);
  const input = label.parentElement?.querySelector('input');
  if (!input) {
    throw new Error(`No input found next to label "${text}"`);
  }
  return input as HTMLInputElement;
}

async function fillMinimalForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(getInputByLabelText('Email address'), 'test@example.com');
  await user.type(getInputByLabelText('SMTP username'), 'test@example.com');
  await user.type(getInputByLabelText('SMTP password'), 'smtp-secret');
  await user.type(getInputByLabelText('IMAP username'), 'test@example.com');
  await user.type(getInputByLabelText('IMAP password'), 'imap-secret');
}

describe('EmailClientSettings save form', () => {
  beforeEach(() => {
    invokeFunctionMock.mockReset();
    (toast as ReturnType<typeof vi.fn>).mockReset();
  });

  it('calls create-email-client-account with no plaintext password columns and no client-supplied tenant/user ids', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: true, account: { id: 'new-id' } }, error: null });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() => expect(invokeFunctionMock).toHaveBeenCalled());
    const [fnName, options] = invokeFunctionMock.mock.calls[0];
    expect(fnName).toBe('create-email-client-account');
    const body = options.body;
    expect(body).not.toHaveProperty('user_id');
    expect(body).not.toHaveProperty('tenant_id');
    expect(body).not.toHaveProperty('franchise_id');
    expect(body).not.toHaveProperty('smtp_password');
    expect(body).not.toHaveProperty('imap_password');
    expect(body.smtp.password).toBe('smtp-secret');
    expect(body.imap.password).toBe('imap-secret');
  });

  it('shows a success toast and resets the form when the function succeeds', async () => {
    invokeFunctionMock.mockResolvedValue({ data: { success: true, account: { id: 'new-id' } }, error: null });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Email account saved' }),
      ),
    );
    expect(getInputByLabelText('Email address').value).toBe('');
  });

  it('shows a failure toast and does not reset the form when the function errors', async () => {
    invokeFunctionMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const user = userEvent.setup();
    render(<EmailClientSettings />);

    await fillMinimalForm(user);
    await user.click(screen.getByRole('button', { name: 'Save Settings' }));

    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Failed to save account', description: 'boom' }),
      ),
    );
    expect(getInputByLabelText('Email address').value).toBe('test@example.com');
  });
});

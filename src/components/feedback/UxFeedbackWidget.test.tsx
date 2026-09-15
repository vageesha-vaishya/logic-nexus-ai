import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UxFeedbackWidget } from './UxFeedbackWidget';

// jsdom doesn't implement PointerEvent capture methods that Radix Select
// relies on for its pointer-driven open/close handling; this repo's other
// Radix Select tests (e.g. CarrierSelect.test.tsx) stub scrollIntoView plus
// two of these three pointer-capture methods (hasPointerCapture,
// releasePointerCapture — not setPointerCapture) for the same reason.
window.HTMLElement.prototype.hasPointerCapture = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.setPointerCapture = vi.fn();

const mockUseAppFeatureFlag = vi.fn();
vi.mock('@/lib/feature-flags', async () => {
  const actual = await vi.importActual<typeof import('@/lib/feature-flags')>('@/lib/feature-flags');
  return { ...actual, useAppFeatureFlag: (...args: unknown[]) => mockUseAppFeatureFlag(...args) };
});

const mockInsert = vi.fn().mockResolvedValue({ error: null });
let capturedTable: string | undefined;
vi.mock('@/hooks/useCRM', () => ({
  useCRM: () => ({
    supabase: { from: (table: string) => { capturedTable = table; return { insert: mockInsert }; } },
    user: { id: 'user-1' },
    context: { tenantId: 'tenant-1' },
  }),
}));

beforeEach(() => {
  mockUseAppFeatureFlag.mockReset();
  mockInsert.mockClear();
  capturedTable = undefined;
});

describe('UxFeedbackWidget', () => {
  it('renders nothing when the flag is off', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: false, isLoading: false, error: null });
    const { container } = render(<UxFeedbackWidget />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a named, focusable trigger button when the flag is on', () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    render(<UxFeedbackWidget />);
    expect(screen.getByRole('button', { name: 'Give feedback' })).toBeInTheDocument();
  });

  it('submits the expected row shape and shows a success toast', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    const user = userEvent.setup();
    render(<UxFeedbackWidget />);

    await user.click(screen.getByRole('button', { name: 'Give feedback' }));
    await user.click(screen.getByRole('combobox', { name: /what were you trying to do/i }));
    await user.click(await screen.findByRole('option', { name: /find the lead/i }));
    await user.click(screen.getByRole('radio', { name: /^yes$/i }));
    await user.click(screen.getByRole('radio', { name: '4' }));
    await user.type(screen.getByRole('textbox', { name: /anything else/i }), 'Worked fine');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => expect(mockInsert).toHaveBeenCalledTimes(1));
    expect(capturedTable).toBe('ux_feedback');
    const row = mockInsert.mock.calls[0][0];
    expect(row).toMatchObject({
      tenant_id: 'tenant-1',
      user_id: 'user-1',
      round: 1,
      task_id: 'find-open-lead',
      completed: 'yes',
      ease: 4,
      comment: 'Worked fine',
      theme_mode: expect.any(String),
    });
    expect(typeof row.route).toBe('string');
    expect(typeof row.viewport_w).toBe('number');
    expect(typeof row.viewport_h).toBe('number');
    expect(typeof row.user_agent).toBe('string');
  });

  it('Escape closes the popover and returns focus to the trigger', async () => {
    mockUseAppFeatureFlag.mockReturnValue({ enabled: true, isLoading: false, error: null });
    const user = userEvent.setup();
    render(<UxFeedbackWidget />);
    const trigger = screen.getByRole('button', { name: 'Give feedback' });
    await user.click(trigger);
    expect(screen.getByRole('combobox', { name: /what were you trying to do/i })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: /what were you trying to do/i })).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
  });
});

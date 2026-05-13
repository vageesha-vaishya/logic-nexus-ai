import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AmroWorkOrderCreateWizard } from './AmroWorkOrderCreateWizard';

const createMutateAsync = vi.fn().mockResolvedValue({ id: 'wp-100' });
const createEmergencyMutateAsync = vi.fn().mockResolvedValue({ id: 'ewp-100' });

vi.mock('./useWorkOrderState', () => ({
  useCreateWorkOrder: () => ({
    mutateAsync: createMutateAsync,
    isPending: false,
  }),
}));

vi.mock('./useEmergencyWPState', () => ({
  useCreateEmergencyWP: () => ({
    mutateAsync: createEmergencyMutateAsync,
    isPending: false,
  }),
}));

vi.mock('./useWorkOrderTemplates', () => ({
  useWorkOrderTemplateOptions: () => ({
    options: [{ value: 'tpl-1', label: 'A-Check v1' }],
  }),
}));

vi.mock('./useAircraftState', () => ({
  useAircraftOptions: () => ({
    options: [
      { value: 'ac-001', label: 'VT-ABC - Boeing 737-800' },
      { value: 'ac-002', label: 'VT-DEF - Airbus A320neo' },
    ],
    isLoading: false,
    error: null,
  }),
}));

describe('AmroWorkOrderCreateWizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('does not render when closed', () => {
    render(<AmroWorkOrderCreateWizard open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByText('Create New Record')).not.toBeInTheDocument();
  });

  it('renders record wizard when open', () => {
    render(<AmroWorkOrderCreateWizard open onOpenChange={vi.fn()} />);
    expect(screen.getByText('Create New Record')).toBeInTheDocument();
    expect(screen.getAllByText('Aircraft & Path').length).toBeGreaterThan(0);
    expect(screen.getByText('Scheduled Maintenance')).toBeInTheDocument();
  });

  it('shows emergency fields when emergency path is selected', async () => {
    render(<AmroWorkOrderCreateWizard open onOpenChange={vi.fn()} />);

    fireEvent.click(screen.getByText('Emergency / AOG'));

    await waitFor(() => {
      expect(screen.getByText('Emergency Type')).toBeInTheDocument();
      expect(screen.getByText('Urgency Level')).toBeInTheDocument();
    });
  });
});

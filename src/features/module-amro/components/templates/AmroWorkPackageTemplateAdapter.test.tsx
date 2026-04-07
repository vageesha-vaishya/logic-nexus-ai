import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmroWorkPackageTemplateAdapter } from './AmroWorkPackageTemplateAdapter';

vi.mock('@/features/module-amro/settings/pages/amro-settings-master-data/components/WorkPackageTemplateCreateSection', () => ({
  WorkPackageTemplateCreateSection: () => <div data-testid="legacy-work-package-section">Legacy Work Package Section</div>,
}));

describe('AmroWorkPackageTemplateAdapter', () => {
  const baseProps = {
    mode: 'update' as const,
    loading: false,
    formValues: { template_code: 'WP-001', scope_json: '[{"phase":"inspection"}]', tasks_json: '[{"task":"T-1"}]' },
    formErrors: {},
    setFieldValue: vi.fn(),
    firstFieldRef: { current: null },
    modalOpen: true,
    modalMode: 'update' as const,
    selectedTemplateId: 'wpt-1',
    scopedDb: {},
    scope: { tenantId: 'tenant-1', franchiseId: 'franchise-1' },
  };

  it('renders legacy section inside standard template container', () => {
    render(<AmroWorkPackageTemplateAdapter {...baseProps} />);
    expect(screen.getByTestId('amro-standard-form-template')).toBeInTheDocument();
    expect(screen.getByTestId('amro-wpt-standard-template')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-work-package-section')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Code (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Scope JSON (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasks JSON (Standard)')).toBeInTheDocument();
  });

  it('surfaces validation errors from legacy formErrors', () => {
    render(
      <AmroWorkPackageTemplateAdapter
        {...baseProps}
        formErrors={{ template_code: 'Template Code is required' }}
      />,
    );

    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.getAllByText('Template Code is required').length).toBeGreaterThan(0);
  });

  it('updates scope/tasks json through existing setFieldValue handlers and surfaces errors', () => {
    const setFieldValue = vi.fn();
    render(
      <AmroWorkPackageTemplateAdapter
        {...baseProps}
        setFieldValue={setFieldValue}
        formErrors={{
          scope_json: 'Scope JSON is invalid',
          tasks_json: 'Tasks JSON is invalid',
        }}
      />,
    );

    const scopeInput = screen.getByLabelText('Scope JSON (Standard)');
    const tasksInput = screen.getByLabelText('Tasks JSON (Standard)');
    fireEvent.change(scopeInput, { target: { value: '[{"phase":"line"}]' } });
    fireEvent.change(tasksInput, { target: { value: '[{"task":"T-2"}]' } });

    expect(setFieldValue).toHaveBeenCalledWith('scope_json', '[{"phase":"line"}]');
    expect(setFieldValue).toHaveBeenCalledWith('tasks_json', '[{"task":"T-2"}]');
    expect(screen.getAllByText('Scope JSON is invalid').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tasks JSON is invalid').length).toBeGreaterThan(0);
  });

  it('keeps model resolved when model_id is missing but aircraft_model exists', () => {
    render(
      <AmroWorkPackageTemplateAdapter
        {...baseProps}
        formValues={{
          ...baseProps.formValues,
          model_id: '',
          aircraft_model: 'A320-200',
        }}
      />,
    );

    expect(screen.queryByText('Aircraft Model could not be resolved for this template.')).not.toBeInTheDocument();
    expect(screen.getByText(/A320-200 \(current\)/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Aircraft Model (Standard)')).toBeInTheDocument();
  });
});

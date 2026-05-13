import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AmroWorkOrderTemplateAdapter } from './AmroWorkOrderTemplateAdapter';

vi.mock('@/features/module-amro/settings/pages/amro-settings-master-data/components/WorkOrderTemplateCreateSection', () => ({
  WorkOrderTemplateCreateSection: () => <div data-testid="legacy-work-order-section">Legacy Work Package Section</div>,
}));

describe('AmroWorkOrderTemplateAdapter', () => {
  const createScopedDb = (templateRecord?: Record<string, unknown>) => ({
    from: (table: string) => {
      const tenantRows = [{ id: 'tenant-1', name: 'Deccan Airways', is_active: true }];
      const franchiseRows = [{ id: 'franchise-1', name: 'Deccan Delhi', is_active: true, tenant_id: 'tenant-1' }];
      const templateRows = templateRecord ? [templateRecord] : [];
      const rows = table === 'tenants'
        ? tenantRows
        : table === 'franchises'
          ? franchiseRows
          : table === 'work_order_templates'
            ? templateRows
            : [];
      const chain = {
        select: () => chain,
        eq: () => chain,
        limit: () => chain,
        order: () => Promise.resolve({ data: rows, error: null }),
        maybeSingle: () => Promise.resolve({ data: templateRows[0] || null, error: null }),
        then: (resolve: (value: { data: unknown; error: null }) => unknown) => Promise.resolve(resolve({ data: rows, error: null })),
      };
      return chain;
    },
  });

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
    scopedDb: createScopedDb(),
    scope: { tenantId: 'tenant-1', franchiseId: 'franchise-1' },
  };

  it('renders legacy section inside standard template container', () => {
    render(<AmroWorkOrderTemplateAdapter {...baseProps} />);
    expect(screen.getByTestId('amro-standard-form-template')).toBeInTheDocument();
    expect(screen.getByTestId('amro-wpt-standard-template')).toBeInTheDocument();
    expect(screen.getByTestId('legacy-work-order-section')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Code (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Template Name (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Scope JSON (Standard)')).toBeInTheDocument();
    expect(screen.getByLabelText('Tasks JSON (Standard)')).toBeInTheDocument();
  });

  it('surfaces validation errors from legacy formErrors', () => {
    render(
      <AmroWorkOrderTemplateAdapter
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
      <AmroWorkOrderTemplateAdapter
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
      <AmroWorkOrderTemplateAdapter
        {...baseProps}
        formValues={{
          ...baseProps.formValues,
          model_id: '',
          aircraft_model: 'A320-200',
        }}
      />,
    );

    expect(screen.queryByText('Aircraft Model could not be resolved for this template.')).not.toBeInTheDocument();
    expect(screen.getAllByText(/A320-200/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Aircraft Model (Standard)')).toBeInTheDocument();
  });

  it('pre-populates template code and template name on update when missing in form state', async () => {
    const setFieldValue = vi.fn();
    render(
      <AmroWorkOrderTemplateAdapter
        {...baseProps}
        setFieldValue={setFieldValue}
        formValues={{
          ...baseProps.formValues,
          template_code: '',
          template_name: '',
          model_id: '',
          aircraft_model: '',
        }}
        scopedDb={createScopedDb({
          id: 'wpt-1',
          template_code: 'WP-LINE-001',
          template_name: 'Line Check Package',
          model_id: 'amodel-2',
          aircraft_model: 'A320-200',
          tenant_id: 'tenant-1',
          franchise_id: 'franchise-1',
        })}
      />,
    );

    await waitFor(() => {
      expect(setFieldValue).toHaveBeenCalledWith('template_code', 'WP-LINE-001');
      expect(setFieldValue).toHaveBeenCalledWith('template_name', 'Line Check Package');
    });
  });

  it('keeps aircraft model field non-editable on update', () => {
    render(<AmroWorkOrderTemplateAdapter {...baseProps} />);
    expect(screen.getByLabelText('Aircraft Model (Standard)')).toBeDisabled();
    expect(screen.getByText('Aircraft model is locked for update.')).toBeInTheDocument();
  });
});

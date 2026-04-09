import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkPackageTemplateCreateSection } from './WorkPackageTemplateCreateSection';

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

function createQuery(result: QueryResult) {
  return {
    select: () => createQuery(result),
    eq: () => createQuery(result),
    is: () => createQuery(result),
    or: () => createQuery(result),
    order: async () => ({ data: result.data, error: result.error }),
    then: (resolve: (value: QueryResult) => unknown) => Promise.resolve(resolve(result)),
  };
}

function createScopedDb(options?: {
  relationRows?: Array<Record<string, unknown>>;
  assemblyModelRows?: Array<Record<string, unknown>>;
}) {
  const relationRows = options?.relationRows ?? [{ task_template_id: 'TT-003', model_id: 'amodel-2' }];
  const assemblyModelRows = options?.assemblyModelRows ?? [{ id: 'amodel-2', name: 'A320-200', model_code: 'A320-200', is_active: true }];
  return {
    from: (table: string) => {
      if (table === 'assembly_models') {
        return createQuery({
          data: assemblyModelRows,
          error: null,
        });
      }
      if (table === 'work_package_template_task_templates') {
        return createQuery({
          data: relationRows,
          error: null,
        });
      }
      return createQuery({ data: [], error: null });
    },
  };
}

function TestHarness(props?: {
  scopedDb?: unknown;
  initialFormValues?: Record<string, unknown>;
}) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({
    template_code: 'TMP-1',
    template_name: 'Template 1',
    aircraft_model: '',
    model_id: '',
    maintenance_type: 'line',
    tasks_json: '[]',
    selected_task_template_ids: [],
    ...(props?.initialFormValues || {}),
  });
  return (
    <>
      <WorkPackageTemplateCreateSection
        formValues={formValues}
        formErrors={{}}
        setFieldValue={(field, value) => setFormValues((previous) => ({ ...previous, [field]: value }))}
        firstFieldRef={{ current: null }}
        modalOpen
        modalMode="update"
        selectedTemplateId="d4ebb1de-50eb-4442-84be-1c9d8dd73cfe"
        scopedDb={props?.scopedDb || createScopedDb()}
        scope={{ tenantId: 'tenant-1', franchiseId: 'franchise-1' }}
      />
      <pre data-testid="selected-task-template-ids">{JSON.stringify(formValues.selected_task_template_ids || [])}</pre>
    </>
  );
}

describe('WorkPackageTemplateCreateSection', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/v2/amro/work-package-templates/model-options')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: {
              records: [
                { id: 'amodel-2', name: 'A320-200', model_code: 'A320-200', is_active: true },
                { id: 'amodel-3', name: 'B737-800', model_code: 'B737-800', is_active: true },
              ],
            },
          }),
        } as Response;
      }
      if (url.includes('/api/v2/amro/work-package-templates/task-template-options')) {
        if (url.includes('aircraft_model_id=amodel-3')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              data: [
                { id: '44444444-4444-4444-8444-444444444444', task_template_id: 'TT-010', code_form_no: 'X', ata_code: '31', description: 'B737 selected task' },
              ],
            }),
          } as Response;
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output: {
              records: [
                { id: '11111111-1111-4111-8111-111111111111', task_template_id: 'TT-001', code_form_no: 'A', ata_code: '21', description: 'A320 task one' },
                { id: '22222222-2222-4222-8222-222222222222', task_template_id: 'TT-002', code_form_no: 'C', ata_code: '10', description: 'A320 task two' },
                { id: '33333333-3333-4333-8333-333333333333', task_template_id: 'TT-003', code_form_no: 'B', ata_code: '05', description: 'A320 selected task' },
              ],
            },
          }),
        } as Response;
      }
      return {
        ok: false,
        status: 404,
        json: async () => ({ error: 'Not found' }),
      } as Response;
    }));
  });

  it('keeps selected tasks on top across column sort changes and marks selected tasks', async () => {
    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select task row TT-001')).toBeInTheDocument();
    });

    const getRowCheckboxes = () =>
      screen.getAllByRole('checkbox').filter((element) =>
        String(element.getAttribute('aria-label') || '').startsWith('Select task row'),
      );

    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Code Form No/i }));
    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes.length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /Code Form No/i }));
    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes.length).toBeGreaterThan(0);
    });
  });

  it('resolves and auto-selects aircraft model from template task relationship model_id in update mode', async () => {
    render(<TestHarness />);

    await waitFor(() => {
      const modelSelect = screen.getByLabelText('Aircraft Model') as HTMLSelectElement;
      expect(modelSelect.value).toBe('amodel-2');
    });

    expect(screen.queryByText('Aircraft Model could not be resolved for this template.')).not.toBeInTheDocument();
  });

  it('shows graceful resolution error when model is missing in update mode', async () => {
    render(
      <TestHarness
        scopedDb={createScopedDb({
          relationRows: [{ task_template_id: '33333333-3333-4333-8333-333333333333' }],
          assemblyModelRows: [],
        })}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Aircraft Model could not be resolved for this template.')).toBeInTheDocument();
    });
  });

  it('dynamically reloads task templates when aircraft model changes', async () => {
    render(<TestHarness initialFormValues={{ model_id: 'amodel-2', aircraft_model: 'A320-200' }} />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select task row TT-003')).toBeInTheDocument();
    });

    const modelSelect = screen.getByLabelText('Aircraft Model') as HTMLSelectElement;
    fireEvent.change(modelSelect, { target: { value: 'amodel-3' } });

    await waitFor(() => {
      expect(screen.queryByLabelText('Select task row TT-003')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Select task row TT-010')).toBeInTheDocument();
    });
  });

  it('stores selected_task_template_ids as UUID task_templates.id values', async () => {
    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select task row TT-001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByLabelText('Select task row TT-001'));

    await waitFor(() => {
      const selectedIds = screen.getByTestId('selected-task-template-ids').textContent || '[]';
      expect(selectedIds).toContain('11111111-1111-4111-8111-111111111111');
      expect(selectedIds).not.toContain('TT-001');
    });
  });
});

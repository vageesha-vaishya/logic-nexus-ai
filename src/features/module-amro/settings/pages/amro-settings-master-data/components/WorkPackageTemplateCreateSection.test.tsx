import { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
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

function createScopedDb() {
  return {
    from: (table: string) => {
      if (table === 'task_templates') {
        return createQuery({
          data: [
            { id: '11111111-1111-4111-8111-111111111111', task_template_id: 'TT-001', code_form_no: 'A', ata_code: '21', description: 'A320 task one' },
            { id: '22222222-2222-4222-8222-222222222222', task_template_id: 'TT-002', code_form_no: 'C', ata_code: '10', description: 'A320 task two' },
            { id: '33333333-3333-4333-8333-333333333333', task_template_id: 'TT-003', code_form_no: 'B', ata_code: '05', description: 'A320 selected task' },
          ],
          error: null,
        });
      }
      if (table === 'assembly_models') {
        return createQuery({
          data: [{ id: 'model-1', name: 'A320', model_code: 'A320', is_active: true }],
          error: null,
        });
      }
      if (table === 'work_package_template_task_templates') {
        return createQuery({
          data: [{ task_template_id: '33333333-3333-4333-8333-333333333333' }],
          error: null,
        });
      }
      return createQuery({ data: [], error: null });
    },
  };
}

function TestHarness() {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({
    template_code: 'TMP-1',
    template_name: 'Template 1',
    aircraft_model: 'A320',
    maintenance_type: 'line',
    tasks_json: '[]',
    selected_task_template_ids: [],
  });
  return (
    <WorkPackageTemplateCreateSection
      formValues={formValues}
      formErrors={{}}
      setFieldValue={(field, value) => setFormValues((previous) => ({ ...previous, [field]: value }))}
      firstFieldRef={{ current: null }}
      modalOpen
      modalMode="update"
      selectedTemplateId="d4ebb1de-50eb-4442-84be-1c9d8dd73cfe"
      scopedDb={createScopedDb()}
      scope={{ tenantId: 'tenant-1', franchiseId: 'franchise-1' }}
    />
  );
}

describe('WorkPackageTemplateCreateSection', () => {
  it('keeps selected tasks on top across column sort changes and marks selected tasks', async () => {
    render(<TestHarness />);

    await waitFor(() => {
      expect(screen.getByLabelText('Select task row TT-003')).toBeInTheDocument();
    });

    const getRowCheckboxes = () =>
      screen.getAllByRole('checkbox').filter((element) =>
        String(element.getAttribute('aria-label') || '').startsWith('Select task row'),
      );

    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes[0]).toHaveAttribute('aria-label', 'Select task row TT-003');
    });

    expect(screen.getByText('Selected')).toBeInTheDocument();
    expect(screen.getByLabelText('Select task row TT-003')).toBeChecked();

    fireEvent.click(screen.getByRole('button', { name: /Code Form No/i }));
    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes[0]).toHaveAttribute('aria-label', 'Select task row TT-003');
    });

    fireEvent.click(screen.getByRole('button', { name: /Code Form No/i }));
    await waitFor(() => {
      const checkboxes = getRowCheckboxes();
      expect(checkboxes[0]).toHaveAttribute('aria-label', 'Select task row TT-003');
    });
  });
});

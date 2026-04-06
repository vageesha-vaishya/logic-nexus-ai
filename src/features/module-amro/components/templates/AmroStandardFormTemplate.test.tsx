import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AmroStandardFormTemplate, type AmroTemplateFieldDefinition, type AmroTemplateSection } from './AmroStandardFormTemplate';

const fields: AmroTemplateFieldDefinition[] = [
  { key: 'record_id', label: 'Record ID', required: true },
  { key: 'status', label: 'Status', required: true },
  { key: 'requires_qa', label: 'Requires QA', visibleWhen: (values) => String(values.status || '').toLowerCase() !== 'draft' },
];

const sections: AmroTemplateSection[] = [
  { id: 'identity', title: 'Identity', fieldKeys: ['record_id', 'status', 'requires_qa'] },
];

function renderField(field: AmroTemplateFieldDefinition) {
  return (
    <div>
      <Label htmlFor={field.key}>{field.label}</Label>
      <Input id={field.key} defaultValue="" />
    </div>
  );
}

describe('AmroStandardFormTemplate', () => {
  it('renders conditional fields based on visibleWhen', () => {
    const { rerender } = render(
      <AmroStandardFormTemplate
        moduleKey="test"
        title="Test"
        mode="edit"
        state="ready"
        values={{ record_id: 'A', status: 'draft' }}
        fields={fields}
        sections={sections}
        renderField={renderField}
      />,
    );

    expect(screen.queryByLabelText('Requires QA')).not.toBeInTheDocument();

    rerender(
      <AmroStandardFormTemplate
        moduleKey="test"
        title="Test"
        mode="edit"
        state="ready"
        values={{ record_id: 'A', status: 'active' }}
        fields={fields}
        sections={sections}
        renderField={renderField}
      />,
    );

    expect(screen.getByLabelText('Requires QA')).toBeInTheDocument();
  });

  it('renders workflow and validation states', () => {
    render(
      <AmroStandardFormTemplate
        moduleKey="workflow"
        title="Workflow"
        mode="edit"
        state="ready"
        values={{ record_id: 'A', status: 'active' }}
        fields={fields}
        sections={sections}
        renderField={renderField}
        steps={[
          { id: 'draft', title: 'Draft', completed: true },
          { id: 'review', title: 'Review' },
        ]}
        activeStepId="review"
        validation={{ level: 'error', messages: ['Invalid due date'] }}
      />,
    );

    expect(screen.getByRole('tab', { name: 'Draft' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Review' })).toBeInTheDocument();
    expect(screen.getByText('Validation Errors')).toBeInTheDocument();
    expect(screen.getByText('Invalid due date')).toBeInTheDocument();
  });
});

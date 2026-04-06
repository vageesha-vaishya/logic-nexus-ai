import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AmroStandardFormTemplate,
  type AmroTemplateFieldDefinition,
  type AmroTemplateSection,
} from './AmroStandardFormTemplate';

const noop = () => undefined;

const baseFields: AmroTemplateFieldDefinition[] = [
  { key: 'record_id', label: 'Record ID', required: true },
  { key: 'title', label: 'Title', required: true },
  { key: 'status', label: 'Status', required: true },
  { key: 'priority', label: 'Priority' },
  { key: 'owner', label: 'Owner' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'instructions', label: 'Instructions', span: 2 },
  { key: 'requires_qa', label: 'Requires QA', visibleWhen: (values) => String(values.status || '').toLowerCase() !== 'draft' },
];

const baseSections: AmroTemplateSection[] = [
  {
    id: 'identity',
    title: 'Record Identity',
    description: 'Primary identifiers and status controls.',
    fieldKeys: ['record_id', 'title', 'status', 'priority'],
  },
  {
    id: 'ownership',
    title: 'Ownership',
    description: 'Assignment and due-date management.',
    fieldKeys: ['owner', 'due_date'],
  },
  {
    id: 'execution',
    title: 'Execution',
    description: 'Execution rules and instructions.',
    fieldKeys: ['requires_qa', 'instructions'],
  },
];

const meta: Meta<typeof AmroStandardFormTemplate> = {
  title: 'AMRO/Templates/AmroStandardFormTemplate',
  component: AmroStandardFormTemplate,
  parameters: { layout: 'padded' },
  args: {
    moduleKey: 'aircraft',
    title: 'AMRO Standard Template',
    subtitle: 'Adapter-first standardized AMRO form template',
    mode: 'edit',
    state: 'ready',
    breadcrumbs: ['AMRO', 'Master Data', 'Aircraft'],
    statusBadges: ['Canonical', 'WCAG 2.1 AA'],
    values: {
      record_id: 'AC-001',
      title: 'A320 Fleet Record',
      status: 'active',
      priority: 'high',
      owner: 'MRO Planner',
      due_date: '2026-04-15',
      instructions: 'Verify all maintenance references before release.',
      requires_qa: 'true',
    },
    fields: baseFields,
    sections: baseSections,
    renderField: (field) => (
      <div className="space-y-1">
        <Label htmlFor={field.key}>{field.label}{field.required ? ' *' : ''}</Label>
        <Input id={field.key} defaultValue="" placeholder={field.label} />
      </div>
    ),
    listSlot: {
      title: 'Related Records',
      description: 'Slot for module list/table component',
      content: <div className="text-sm text-muted-foreground">Inject existing AMRO list component here.</div>,
    },
    sidePanelSlot: <div className="text-sm text-muted-foreground">Inject activity/audit panel here.</div>,
    primaryActions: [{ id: 'save', label: 'Save', onClick: noop }],
    secondaryActions: [{ id: 'cancel', label: 'Cancel', onClick: noop }],
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit', 'readonly'] },
    state: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'success'] },
    validation: { control: 'object' },
    values: { control: 'object' },
    fields: { control: 'object' },
    sections: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof AmroStandardFormTemplate>;

export const AircraftRecordsVariant: Story = {
  args: {
    moduleKey: 'aircraft-records',
    title: 'Aircraft Records',
    breadcrumbs: ['AMRO', 'Aircraft', 'Records'],
    statusBadges: ['Operational'],
  },
};

export const PartsInventoryVariant: Story = {
  args: {
    moduleKey: 'parts-inventory',
    title: 'Parts Inventory',
    breadcrumbs: ['AMRO', 'Inventory', 'Parts'],
    values: {
      record_id: 'PART-0001',
      title: 'Hydraulic Pump',
      status: 'available',
      priority: 'critical',
      owner: 'Stores Lead',
      due_date: '2026-04-12',
      instructions: 'Confirm rotable eligibility before issue.',
      requires_qa: 'true',
    },
  },
};

export const WorkPackageVariant: Story = {
  args: {
    moduleKey: 'work-packages',
    title: 'Work Package',
    breadcrumbs: ['AMRO', 'Maintenance', 'Work Packages'],
    values: {
      record_id: 'WP-0291',
      title: 'A-check Batch',
      status: 'in_progress',
      priority: 'high',
      owner: 'Line Maintenance',
      due_date: '2026-04-17',
      instructions: 'Validate AMP references per task row.',
      requires_qa: 'true',
    },
    steps: [
      { id: 'scope', title: 'Scope', completed: true },
      { id: 'tasks', title: 'Tasks', completed: true },
      { id: 'resources', title: 'Resources' },
      { id: 'approval', title: 'Approval' },
    ],
    activeStepId: 'resources',
  },
};

export const DynamicFieldGenerationVariant: Story = {
  args: {
    moduleKey: 'dynamic-field-form',
    title: 'Dynamic Field Generation',
    values: {
      record_id: 'DY-001',
      title: 'Conditional Workflow',
      status: 'draft',
      priority: 'medium',
      owner: 'QA',
      due_date: '2026-04-20',
      instructions: 'Requires QA field hidden while status is draft.',
      requires_qa: 'false',
    },
  },
};

export const MultiStepWorkflowVariant: Story = {
  args: {
    moduleKey: 'multistep',
    title: 'Multi-step Workflow',
    steps: [
      { id: 'draft', title: 'Draft', completed: true },
      { id: 'review', title: 'Review', completed: true },
      { id: 'approve', title: 'Approve', completed: false },
      { id: 'publish', title: 'Publish', completed: false },
    ],
    activeStepId: 'approve',
  },
};

export const ValidationErrorVariant: Story = {
  args: {
    moduleKey: 'validation',
    title: 'Validation State',
    state: 'ready',
    validation: {
      level: 'error',
      messages: [
        'Record ID is required.',
        'Due Date cannot be earlier than today.',
      ],
    },
  },
};

export const LoadingErrorSuccessStates: Story = {
  render: () => (
    <div className="space-y-4">
      <AmroStandardFormTemplate
        moduleKey="loading-state"
        title="Loading State"
        mode="edit"
        state="loading"
        values={{}}
        fields={[]}
        sections={[]}
        renderField={() => null}
      />
      <AmroStandardFormTemplate
        moduleKey="error-state"
        title="Error State"
        mode="edit"
        state="error"
        values={{}}
        fields={[]}
        sections={[]}
        renderField={() => null}
      />
      <AmroStandardFormTemplate
        moduleKey="success-state"
        title="Success State"
        mode="edit"
        state="success"
        values={{}}
        fields={[]}
        sections={[]}
        renderField={() => null}
      />
    </div>
  ),
};

export const FormStandardContract: Story = {
  args: {
    moduleKey: 'contract',
    title: 'AMRO Form Standard Contract',
    subtitle: 'Enforces cross-module consistency without breaking existing integrations.',
    breadcrumbs: ['AMRO', 'Standards', 'Form Contract'],
    statusBadges: ['Backward Compatible', 'Config-Driven'],
    validation: {
      level: 'warning',
      messages: [
        'Template must remain API-agnostic; adapters own data integration.',
        'No module-specific layout forks allowed.',
        'All variants must pass WCAG 2.1 AA baseline checks.',
      ],
    },
    footerSlot: (
      <div className="rounded-md border border-border/70 bg-muted/20 p-3 text-sm">
        Contract checklist: naming conventions, slot usage, state handling, validation parity, and regression tests.
      </div>
    ),
  },
};

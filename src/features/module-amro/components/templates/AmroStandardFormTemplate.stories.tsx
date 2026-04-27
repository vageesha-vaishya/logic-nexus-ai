import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AmroStandardFormTemplate,
  type AmroTemplateFieldDefinition,
  type AmroTemplateSection,
} from './AmroStandardFormTemplate';
import {
  amroPartsEnterpriseDecorator,
  amroPartsEnterpriseParameters,
  buildAmroPartsEnterpriseDocsDescription,
} from '../parts/storybook/amroPartsEnterpriseStoryTemplate';

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
  parameters: {
    ...amroPartsEnterpriseParameters,
    docs: {
      ...(amroPartsEnterpriseParameters.docs || {}),
      description: {
        component: buildAmroPartsEnterpriseDocsDescription({
          componentId: 'AMRO-STANDARD-FORM-TEMPLATE',
          ownerTeam: 'AMRO Platform Team',
          releaseRing: 'production',
          dataClassification: 'internal',
          approvalPolicy: 'two_person_review_required',
          auditReference: 'SCR-AMRO-STANDARD-FORM-TEMPLATE',
        }),
      },
    },
  },
  decorators: [amroPartsEnterpriseDecorator],
  tags: ['autodocs', 'amro', 'parts', 'enterprise'],
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

const wptFields: AmroTemplateFieldDefinition[] = [
  { key: 'template_code', label: 'Template Code (Standard)', required: true },
  { key: 'template_name', label: 'Template Name (Standard)', required: true },
  { key: 'version', label: 'Version (Standard)', required: true },
  { key: 'maintenance_type', label: 'Maintenance Type (Standard)', required: true },
  { key: 'policy_snapshot_id', label: 'Policy Snapshot ID (Standard)' },
  { key: 'active', label: 'Active (Standard)' },
];

const wptSections: AmroTemplateSection[] = [
  {
    id: 'wpt-standard-core',
    title: 'Standardized Core Fields',
    description: 'Exact adapter field parity for production sign-off.',
    fieldKeys: [
      'template_code',
      'template_name',
      'version',
      'maintenance_type',
      'policy_snapshot_id',
      'active',
    ],
  },
];

function renderWptField(field: AmroTemplateFieldDefinition, values: Record<string, unknown>) {
  const value = values[field.key];
  return (
    <div className="space-y-1">
      <Label htmlFor={`wpt-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
      <Input
        id={`wpt-${field.key}`}
        defaultValue={String(value ?? '')}
        placeholder={field.label}
      />
    </div>
  );
}

function buildWptLegacyParitySlot(options?: {
  tasks?: string[];
  scopeValues?: { threshold?: string; planning_horizon_days?: string };
  policySnapshotLabel?: string;
  reorderHint?: string;
}) {
  const tasks = options?.tasks || ['TASK-1001 A-check visual inspection', 'TASK-2004 hydraulic pressure check'];
  const scopeThreshold = options?.scopeValues?.threshold || '10';
  const planningHorizon = options?.scopeValues?.planning_horizon_days || '45';
  const policySnapshot = options?.policySnapshotLabel || 'POL-2026-Q2';
  const reorderHint = options?.reorderHint || 'Simulated reorder: drag TASK-2004 above TASK-1001';
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3 text-sm" data-testid="wpt-production-parity-legacy-slot">
      <div>
        <p className="font-medium">Work Package Details</p>
        <p className="text-xs text-muted-foreground">Policy Snapshot: {policySnapshot}</p>
      </div>
      <div>
        <p className="font-medium">Selected Tasks</p>
        <ul className="list-disc pl-4 text-xs text-muted-foreground">
          {tasks.map((task) => <li key={task}>{task}</li>)}
        </ul>
        <p className="mt-1 text-xs text-muted-foreground">Task remove simulation: remove first task action available.</p>
        <p className="text-xs text-muted-foreground">{reorderHint}</p>
      </div>
      <div>
        <p className="font-medium">Scope Definition</p>
        <p className="text-xs text-muted-foreground">
          Threshold: {scopeThreshold}% | Planning Horizon: {planningHorizon} days
        </p>
      </div>
    </div>
  );
}

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

export const WorkOrderVariant: Story = {
  args: {
    moduleKey: 'work-orders',
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

export const WorkOrderTemplates_ProductionParity: Story = {
  name: 'WorkOrderTemplates_ProductionParity',
  parameters: {
    docs: {
      description: {
        story: `
**State Switch Guide**
- \`WorkOrderTemplates_ProductionParity\` = ready state (no validation errors expected)
- \`WorkOrderTemplates_ProductionParity_ValidationError\` = validation state (error summary + 2 expected messages)
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Visual Sign-off Checklist (QA)**
1. Confirm all 6 standardized fields are visible with exact labels.
2. Confirm legacy parity blocks are visible: Work Package Details, Selected Tasks, Scope Definition.
3. Confirm task interaction simulation notes are present: add/remove/reorder.
4. Confirm policy snapshot and scope values are visible.
5. Confirm keyboard navigation reaches field inputs and error summary container.
6. Confirm validation state surfaces both summary and contextual messaging.

**Accessibility Notes**
- Keyboard path: header actions -> standard fields -> legacy parity blocks.
- Error summary behavior: validation alert remains visible at top and should be announced by assistive tech in runtime app.
`,
      },
    },
  },
  render: (args) => {
    const values = args.values as Record<string, unknown>;
    return (
      <AmroStandardFormTemplate
        {...args}
        fields={wptFields}
        sections={wptSections}
        renderField={(field) => renderWptField(field, values)}
        formBodySlot={buildWptLegacyParitySlot({
          tasks: ['TASK-1001 A-check visual inspection', 'TASK-2004 hydraulic pressure check', 'TASK-3020 avionics health check'],
          scopeValues: { threshold: '12', planning_horizon_days: '60' },
          policySnapshotLabel: String(values.policy_snapshot_id || 'POL-2026-Q2'),
          reorderHint: 'Reorder simulation: TASK-3020 moved above TASK-1001',
        })}
      />
    );
  },
  args: {
    moduleKey: 'work_order_templates',
    title: 'Work Package Templates - Production Parity',
    subtitle: 'Exact visual parity contract for adapter-standardized rollout path.',
    mode: 'edit',
    state: 'ready',
    breadcrumbs: ['AMRO', 'Master Data', 'Work Package Templates'],
    statusBadges: ['Feature Flag ON', 'Production Parity'],
    values: {
      template_code: 'WPT-1001',
      template_name: 'A320 A-CHECK BASE',
      version: '3',
      maintenance_type: 'base',
      policy_snapshot_id: 'POL-2026-Q2',
      active: 'true',
    },
    primaryActions: [{ id: 'save', label: 'Save', onClick: noop }],
    secondaryActions: [{ id: 'cancel', label: 'Cancel', onClick: noop }],
  },
  play: async ({ canvasElement }) => {
    const labels = Array.from(canvasElement.querySelectorAll('label')).map((node) => node.textContent || '');
    const pageText = canvasElement.textContent || '';
    const requiredLabels = [
      'Template Code (Standard) *',
      'Template Name (Standard) *',
      'Version (Standard) *',
      'Maintenance Type (Standard) *',
      'Policy Snapshot ID (Standard)',
      'Active (Standard)',
    ];
    for (const label of requiredLabels) {
      if (!labels.some((candidate) => candidate.includes(label))) {
        throw new Error(`Production parity assertion failed: missing label "${label}"`);
      }
    }
    for (const section of ['Work Package Details', 'Selected Tasks', 'Scope Definition']) {
      if (!pageText.includes(section)) {
        throw new Error(`Production parity assertion failed: missing legacy block "${section}"`);
      }
    }
  },
};

export const WorkOrderTemplates_ProductionParity_ValidationError: Story = {
  name: 'WorkOrderTemplates_ProductionParity_ValidationError',
  parameters: {
    docs: {
      description: {
        story: `
**State Switch Guide**
- \`WorkOrderTemplates_ProductionParity\` = ready state (no validation errors expected)
- \`WorkOrderTemplates_ProductionParity_ValidationError\` = expected validation summary state
- QA rule: both stories must keep the same field/block layout; only validation state should differ.

**Expected Validation Output**
- Validation Errors
- Template Code (Standard) is required.
- Version (Standard) must be greater than zero.
`,
      },
    },
  },
  render: WorkOrderTemplates_ProductionParity.render,
  args: {
    ...WorkOrderTemplates_ProductionParity.args,
    state: 'ready',
    validation: {
      level: 'error',
      messages: [
        'Template Code (Standard) is required.',
        'Version (Standard) must be greater than zero.',
      ],
    },
  },
  play: async ({ canvasElement }) => {
    const labels = Array.from(canvasElement.querySelectorAll('label')).map((node) => node.textContent || '');
    const pageText = canvasElement.textContent || '';

    // Error summary + expected messages
    for (const expected of [
      'Validation Errors',
      'Template Code (Standard) is required.',
      'Version (Standard) must be greater than zero.',
    ]) {
      if (!pageText.includes(expected)) {
        throw new Error(`Validation parity assertion failed: missing "${expected}"`);
      }
    }

    // 6 standard fields should still render in error state
    const requiredLabels = [
      'Template Code (Standard) *',
      'Template Name (Standard) *',
      'Version (Standard) *',
      'Maintenance Type (Standard) *',
      'Policy Snapshot ID (Standard)',
      'Active (Standard)',
    ];
    for (const label of requiredLabels) {
      if (!labels.some((candidate) => candidate.includes(label))) {
        throw new Error(`Validation parity assertion failed: missing label "${label}"`);
      }
    }

    // Legacy parity blocks should still render in error state
    for (const section of ['Work Package Details', 'Selected Tasks', 'Scope Definition']) {
      if (!pageText.includes(section)) {
        throw new Error(`Validation parity assertion failed: missing legacy block "${section}"`);
      }
    }
  },
};

export const WorkOrderTemplates_ProductionParity_Loading: Story = {
  name: 'WorkOrderTemplates_ProductionParity_Loading',
  render: WorkOrderTemplates_ProductionParity.render,
  args: {
    ...WorkOrderTemplates_ProductionParity.args,
    state: 'loading',
  },
};

export const WorkOrderTemplates_ProductionParity_FeatureFlagOffFallback: Story = {
  name: 'WorkOrderTemplates_ProductionParity_FeatureFlagOffFallback',
  parameters: {
    docs: {
      description: {
        story: 'Represents legacy fallback visualization when `VITE_AMRO_WPT_STANDARD_TEMPLATE=false`.',
      },
    },
  },
  render: (args) => (
    <div className="space-y-3">
      <AmroStandardFormTemplate
        {...args}
        fields={[]}
        sections={[]}
        renderField={() => null}
        formBodySlot={buildWptLegacyParitySlot({
          tasks: ['TASK-1001 A-check visual inspection', 'TASK-2004 hydraulic pressure check'],
          scopeValues: { threshold: '10', planning_horizon_days: '45' },
          policySnapshotLabel: 'Legacy policy snapshot binding',
          reorderHint: 'Legacy drag/drop reorder behavior retained',
        })}
      />
      <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
        Feature flag fallback mode: standard fields hidden, legacy section path only.
      </div>
    </div>
  ),
  args: {
    moduleKey: 'work_order_templates',
    title: 'Work Package Templates - Legacy Fallback',
    subtitle: 'Feature flag OFF fallback reference',
    mode: 'edit',
    state: 'ready',
    breadcrumbs: ['AMRO', 'Master Data', 'Work Package Templates'],
    statusBadges: ['Feature Flag OFF'],
    values: {},
    primaryActions: [{ id: 'save', label: 'Save', onClick: noop }],
    secondaryActions: [{ id: 'cancel', label: 'Cancel', onClick: noop }],
  },
};

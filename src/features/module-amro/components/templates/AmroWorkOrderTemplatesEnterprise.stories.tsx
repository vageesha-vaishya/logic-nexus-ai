import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
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

const wptFields: AmroTemplateFieldDefinition[] = [
  { key: 'template_code', label: 'Template Code', required: true },
  { key: 'template_name', label: 'Template Name', required: true, span: 2 },
  { key: 'version', label: 'Version', required: true },
  { key: 'maintenance_type', label: 'Maintenance Type', required: true },
  { key: 'aircraft_model', label: 'Aircraft Model', required: true },
  { key: 'policy_snapshot_id', label: 'Policy Snapshot ID' },
  { key: 'active', label: 'Active' },
];

const wptSections: AmroTemplateSection[] = [
  {
    id: 'identity',
    title: 'Work Package Details',
    description: 'Core template identity and maintenance classification.',
    fieldKeys: ['template_code', 'template_name', 'version', 'maintenance_type', 'aircraft_model', 'policy_snapshot_id', 'active'],
  },
];

function renderField(field: AmroTemplateFieldDefinition, values: Record<string, unknown>) {
  return (
    <div className="space-y-1">
      <Label htmlFor={`enterprise-${field.key}`}>{field.label}{field.required ? ' *' : ''}</Label>
      <Input id={`enterprise-${field.key}`} defaultValue={String(values[field.key] ?? '')} />
    </div>
  );
}

function legacySlot(options?: {
  taskCount?: number;
  selectedCount?: number;
  threshold?: string;
  horizon?: string;
  note?: string;
}) {
  const taskCount = options?.taskCount ?? 12;
  const selectedCount = options?.selectedCount ?? 4;
  const threshold = options?.threshold ?? '12';
  const horizon = options?.horizon ?? '60';
  const note = options?.note ?? 'Simulates add/remove/reorder controls from legacy handlers.';
  return (
    <div className="space-y-3 rounded-md border border-border/70 bg-muted/10 p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">Selected Tasks</p>
        <Badge variant="secondary">Records: {taskCount}</Badge>
        <Badge variant="outline">Checked: {selectedCount}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">{note}</p>
      <div className="rounded border border-border/70 bg-background p-2 text-xs">
        Scope Definition: threshold {threshold}% | planning horizon {horizon} days
      </div>
    </div>
  );
}

const meta: Meta<typeof AmroStandardFormTemplate> = {
  title: 'AMRO/Templates/WorkOrderTemplatesEnterprise',
  component: AmroStandardFormTemplate,
  tags: ['autodocs', 'amro', 'parts', 'enterprise'],
  decorators: [amroPartsEnterpriseDecorator],
  parameters: {
    ...amroPartsEnterpriseParameters,
    docs: {
      ...(amroPartsEnterpriseParameters.docs || {}),
      description: {
        component: `${buildAmroPartsEnterpriseDocsDescription({
          componentId: 'AMRO-WPT-ENTERPRISE-TEMPLATES',
          ownerTeam: 'AMRO Platform Team',
          releaseRing: 'uat',
          dataClassification: 'internal',
          approvalPolicy: 'two_person_review_required',
          auditReference: 'SCR-AMRO-WPT-ENTERPRISE',
        })}

Enterprise-grade reference templates for AMRO Work Package Templates.

Usage Guidance:
- Use adapter-first integration to preserve existing API and handlers.
- Keep "Work Package Details", "Selected Tasks", and "Scope Definition" visible during migration.
- Validate parity with feature flag ON/OFF before promoting to wider rollout.

Implementation Best Practices:
- Keep fields config-driven and section-based.
- Keep task-row interactions keyboard accessible.
- Keep validation summary and field-level errors synchronized.
`,
      },
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit', 'readonly'] },
    state: { control: 'inline-radio', options: ['ready', 'loading', 'error', 'success'] },
    title: { control: 'text' },
    subtitle: { control: 'text' },
    breadcrumbs: { control: 'object' },
    statusBadges: { control: 'object' },
    validation: { control: 'object' },
    values: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof AmroStandardFormTemplate>;

const baseArgs = {
  moduleKey: 'work_order_templates',
  title: 'AMRO Work Package Templates - Enterprise Reference',
  subtitle: 'Scalable template pattern for production migration decisions.',
  mode: 'edit' as const,
  state: 'ready' as const,
  breadcrumbs: ['AMRO', 'Master Data', 'Work Package Templates'],
  statusBadges: ['Enterprise UI', 'WCAG 2.1 AA Baseline'],
  values: {
    template_code: 'WPT-ENT-001',
    template_name: 'A320 Base Check Package',
    version: '3',
    maintenance_type: 'base',
    aircraft_model: 'A320-200',
    policy_snapshot_id: 'POL-2026-Q2',
    active: 'true',
  },
  fields: wptFields,
  sections: wptSections,
  renderField: (field: AmroTemplateFieldDefinition) => renderField(field, baseArgs.values),
  formBodySlot: legacySlot(),
  primaryActions: [{ id: 'save', label: 'Save', onClick: noop }],
  secondaryActions: [{ id: 'cancel', label: 'Cancel', onClick: noop }],
};

export const DesktopOperations: Story = {
  name: 'DesktopOperations',
  args: {
    ...baseArgs,
  },
};

export const TabletGlovedHandMode: Story = {
  name: 'TabletGlovedHandMode',
  parameters: {
    viewport: { defaultViewport: 'tablet' },
    docs: {
      description: {
        story: 'Optimized spacing and larger control targets for tablet and gloved-hand interaction contexts.',
      },
    },
  },
  args: {
    ...baseArgs,
    statusBadges: ['Tablet', 'High-Touch Targets'],
    formBodySlot: legacySlot({ taskCount: 9, selectedCount: 3, threshold: '10', horizon: '45' }),
  },
};

export const HighContrastLowLight: Story = {
  name: 'HighContrastLowLight',
  parameters: {
    docs: {
      description: {
        story: 'Reference for high-contrast operation in low-light hangar/line environments.',
      },
    },
  },
  args: {
    ...baseArgs,
    statusBadges: ['High Contrast', 'Low Light'],
    footerSlot: (
      <div className="rounded-md border border-foreground/40 bg-background p-3 text-sm">
        Contrast guidance: maintain &gt;= 4.5:1 for body text and visible focus indicators.
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    if (!text.includes('Contrast guidance: maintain >= 4.5:1')) {
      throw new Error('High-contrast gate failed: contrast guidance note not visible.');
    }
    if (!text.includes('High Contrast')) {
      throw new Error('High-contrast gate failed: high-contrast badge not visible.');
    }
  },
};

export const InternationalizationAndRTL: Story = {
  name: 'InternationalizationAndRTL',
  parameters: {
    docs: {
      description: {
        story: 'Reference for localization, translated labels, and right-to-left layout readiness.',
      },
    },
  },
  render: (args) => (
    <div dir="rtl">
      <AmroStandardFormTemplate {...args} />
    </div>
  ),
  args: {
    ...baseArgs,
    title: 'Plantilla de Paquetes de Trabajo - Referencia',
    subtitle: 'Localization and RTL-ready reference state.',
    statusBadges: ['i18n Ready', 'RTL Ready'],
  },
  play: async ({ canvasElement }) => {
    const rtlRoot = canvasElement.querySelector('[dir="rtl"]');
    if (!rtlRoot) {
      throw new Error('RTL gate failed: RTL wrapper missing.');
    }
    const text = canvasElement.textContent || '';
    if (!text.includes('i18n Ready') || !text.includes('RTL Ready')) {
      throw new Error('RTL gate failed: i18n/RTL badges not visible.');
    }
    if (!text.includes('Plantilla de Paquetes de Trabajo - Referencia')) {
      throw new Error('RTL gate failed: localized title not visible.');
    }
  },
};

export const OfflineSyncConflictState: Story = {
  name: 'OfflineSyncConflictState',
  args: {
    ...baseArgs,
    state: 'error',
    statusBadges: ['Offline Queue', 'Sync Required'],
    validation: {
      level: 'warning',
      messages: [
        'Local draft is newer than server version.',
        'Review conflict before final submit.',
      ],
    },
    footerSlot: (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution.
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    for (const expected of [
      'Offline Queue',
      'Sync Required',
      'Local draft is newer than server version.',
      'Review conflict before final submit.',
      'Offline mode reference: queue mutations, show sync status, and allow manual conflict resolution.',
    ]) {
      if (!text.includes(expected)) {
        throw new Error(`Offline gate failed: missing "${expected}"`);
      }
    }
  },
};

export const ApprovalWorkflowAndAudit: Story = {
  name: 'ApprovalWorkflowAndAudit',
  args: {
    ...baseArgs,
    steps: [
      { id: 'draft', title: 'Draft', completed: true },
      { id: 'review', title: 'Review', completed: true },
      { id: 'approval', title: 'Approval' },
      { id: 'release', title: 'Release' },
    ],
    activeStepId: 'approval',
    sidePanelSlot: (
      <div className="space-y-2 text-xs">
        <p className="font-medium">Approval and Audit</p>
        <p>Pending approver: QA Supervisor</p>
        <p>Audit ref: AUD-2026-04-06-001</p>
        <p>Digital signature status: pending</p>
      </div>
    ),
  },
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    for (const expected of [
      'Draft',
      'Review',
      'Approval',
      'Release',
      'Approval and Audit',
      'Pending approver: QA Supervisor',
      'Audit ref: AUD-2026-04-06-001',
      'Digital signature status: pending',
    ]) {
      if (!text.includes(expected)) {
        throw new Error(`Workflow/audit gate failed: missing "${expected}"`);
      }
    }
  },
};

export const EmptyStateReference: Story = {
  name: 'EmptyStateReference',
  parameters: {
    docs: {
      description: {
        story: 'Reference state for newly initialized templates with no selected tasks yet.',
      },
    },
  },
  args: {
    ...baseArgs,
    state: 'ready',
    values: {
      template_code: '',
      template_name: '',
      version: '',
      maintenance_type: '',
      aircraft_model: '',
      policy_snapshot_id: '',
      active: '',
    },
    formBodySlot: legacySlot({
      taskCount: 0,
      selectedCount: 0,
      threshold: '0',
      horizon: '0',
      note: 'No selected task rows available. Start by selecting Aircraft Model and task templates.',
    }),
    validation: {
      level: 'warning',
      messages: ['Template is in empty draft state. Required fields are not yet complete.'],
    },
  },
};

export const SuccessStateReference: Story = {
  name: 'SuccessStateReference',
  parameters: {
    docs: {
      description: {
        story: 'Reference state for successful save and post-submit confirmation behavior.',
      },
    },
  },
  args: {
    ...baseArgs,
    state: 'success',
  },
};

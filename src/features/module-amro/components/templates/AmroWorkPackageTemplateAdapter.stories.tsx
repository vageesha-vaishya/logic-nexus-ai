import { useRef, useState, type RefObject } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AmroWorkPackageTemplateAdapter } from './AmroWorkPackageTemplateAdapter';
import {
  amroPartsEnterpriseDecorator,
  amroPartsEnterpriseParameters,
  buildAmroPartsEnterpriseDocsDescription,
} from '../parts/storybook/amroPartsEnterpriseStoryTemplate';

type MockRow = Record<string, unknown>;
type MockTables = {
  assembly_models?: MockRow[];
  task_templates?: MockRow[];
  work_package_template_task_templates?: MockRow[];
};

function createScopedDbMock(tables: MockTables) {
  class QueryBuilder {
    private rows: MockRow[];
    constructor(rows: MockRow[]) {
      this.rows = rows;
    }
    select(_columns: string) {
      return this;
    }
    eq(key: string, value: unknown) {
      this.rows = this.rows.filter((row) => row[key] === value);
      return this;
    }
    is(key: string, value: unknown) {
      this.rows = this.rows.filter((row) => (row[key] ?? null) === value);
      return this;
    }
    order(key: string, options?: { ascending?: boolean }) {
      const ascending = options?.ascending !== false;
      const sorted = [...this.rows].sort((a, b) => {
        const left = String(a[key] ?? '');
        const right = String(b[key] ?? '');
        return left.localeCompare(right);
      });
      this.rows = ascending ? sorted : sorted.reverse();
      return Promise.resolve({ data: this.rows, error: null });
    }
    then(resolve: (value: { data: MockRow[]; error: null }) => unknown, reject?: (reason: unknown) => unknown) {
      return Promise.resolve({ data: this.rows, error: null }).then(resolve, reject);
    }
  }

  return {
    from(tableName: string) {
      const rows = (tables[tableName as keyof MockTables] || []) as MockRow[];
      return new QueryBuilder(rows);
    },
  };
}

const baseTables: MockTables = {
  assembly_models: [
    { id: 'mdl-a320', tenant_id: 'tenant-1', franchise_id: 'franchise-1', name: 'Airbus A320', model_code: 'A320-200', is_active: true },
    { id: 'mdl-b737', tenant_id: 'tenant-1', franchise_id: 'franchise-1', name: 'Boeing 737', model_code: 'B737-800', is_active: true },
  ],
  task_templates: [
    {
      id: 'tt-001',
      task_template_id: 'TT-001',
      tenant_id: 'tenant-1',
      franchise_id: 'franchise-1',
      code_form_no: 'CF-001',
      ata_code: '05-20',
      reference_amp: 'AMP-REF-1',
      description: 'General visual inspection',
      category_code: 'INS',
      estimated_man_hours: 2,
      is_mandatory: true,
      task_template_detail_json: { task: 'inspect' },
      task_template_scope_json: { model_ids: ['mdl-a320'] },
    },
    {
      id: 'tt-002',
      task_template_id: 'TT-002',
      tenant_id: 'tenant-1',
      franchise_id: 'franchise-1',
      code_form_no: 'CF-002',
      ata_code: '27-40',
      reference_amp: 'AMP-REF-2',
      description: 'Control surface check',
      category_code: 'OPS',
      estimated_man_hours: 3,
      is_mandatory: false,
      task_template_detail_json: { task: 'check-controls' },
      task_template_scope_json: { model_ids: ['mdl-a320'] },
    },
  ],
  work_package_template_task_templates: [
    { work_package_template_id: 'wpt-1', task_template_id: 'tt-001', model_id: 'mdl-a320', tenant_id: 'tenant-1', franchise_id: 'franchise-1' },
  ],
};

type HarnessProps = {
  loading?: boolean;
  mode?: 'create' | 'update';
  formErrors?: Record<string, string>;
  scopedDb: unknown;
};

function RuntimeAdapterHarness({
  loading = false,
  mode = 'update',
  formErrors = {},
  scopedDb,
}: HarnessProps) {
  const [formValues, setFormValues] = useState<Record<string, unknown>>({
    template_code: 'WPT-1001',
    template_name: 'A320 BASE CHECK',
    version: 3,
    model_id: 'mdl-a320',
    aircraft_model: 'A320-200',
    maintenance_type: 'base',
    policy_snapshot_id: 'POL-2026-Q2',
    active: true,
    scope_json: '[{"phase":"inspection"}]',
    tasks_json: '[{"task_template_id":"tt-001"}]',
    selected_task_template_ids: ['tt-001'],
  });
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const setFieldValue = (fieldKey: string, value: unknown) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  return (
    <AmroWorkPackageTemplateAdapter
      mode={mode}
      loading={loading}
      formValues={formValues}
      formErrors={formErrors}
      setFieldValue={setFieldValue}
      firstFieldRef={firstFieldRef as RefObject<HTMLInputElement>}
      modalOpen
      modalMode={mode}
      selectedTemplateId="wpt-1"
      scopedDb={scopedDb}
      scope={{ tenantId: 'tenant-1', franchiseId: 'franchise-1', isTenantAdmin: false }}
    />
  );
}

const meta: Meta<typeof RuntimeAdapterHarness> = {
  title: 'AMRO/Templates/WorkPackageTemplatesRuntimeAdapter',
  component: RuntimeAdapterHarness,
  tags: ['autodocs', 'amro', 'parts', 'enterprise'],
  decorators: [amroPartsEnterpriseDecorator],
  parameters: {
    ...amroPartsEnterpriseParameters,
    docs: {
      ...(amroPartsEnterpriseParameters.docs || {}),
      description: {
        component: [
          buildAmroPartsEnterpriseDocsDescription({
            componentId: 'AMRO-WPT-RUNTIME-ADAPTER',
            ownerTeam: 'AMRO Platform Team',
            releaseRing: 'uat',
            dataClassification: 'internal',
            approvalPolicy: 'two_person_review_required',
            auditReference: 'SCR-AMRO-WPT-RUNTIME-ADAPTER',
          }),
          '',
          'Runtime-parity Storybook reference for AMRO WPT adapter integration (realistic scopedDb mock + live section rendering contract).',
        ].join('\n'),
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof RuntimeAdapterHarness>;

export const Ready: Story = {
  render: () => <RuntimeAdapterHarness scopedDb={createScopedDbMock(baseTables)} />,
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    for (const expected of [
      'Work Package Templates',
      'Template Code (Standard)',
      'Aircraft Model (Standard)',
      'Selected Tasks',
      'Scope Definition',
      'Tasks JSON',
    ]) {
      if (!text.includes(expected)) {
        throw new Error(`Ready runtime gate failed: missing "${expected}"`);
      }
    }
  },
};

export const Loading: Story = {
  render: () => <RuntimeAdapterHarness scopedDb={createScopedDbMock(baseTables)} loading />,
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    if (!text.includes('Loading')) {
      throw new Error('Loading runtime gate failed: loading state not visible.');
    }
  },
};

export const ValidationError: Story = {
  render: () => (
    <RuntimeAdapterHarness
      scopedDb={createScopedDbMock(baseTables)}
      formErrors={{
        template_code: 'Template Code is required.',
        scope_json: 'Scope JSON is invalid.',
        tasks_json: 'Tasks JSON is invalid.',
      }}
    />
  ),
  play: async ({ canvasElement }) => {
    const text = canvasElement.textContent || '';
    for (const expected of ['Validation Errors', 'Template Code is required.', 'Scope JSON is invalid.', 'Tasks JSON is invalid.']) {
      if (!text.includes(expected)) {
        throw new Error(`Validation runtime gate failed: missing "${expected}"`);
      }
    }
  },
};

export const NoAircraftModels: Story = {
  render: () => {
    const tables = { ...baseTables, assembly_models: [] as MockRow[] };
    return <RuntimeAdapterHarness scopedDb={createScopedDbMock(tables)} />;
  },
  play: async ({ canvasElement }) => {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const text = canvasElement.textContent || '';
    if (!text.includes('No aircraft models available')) {
      throw new Error('No-aircraft-models runtime gate failed: expected guidance not visible.');
    }
  },
};

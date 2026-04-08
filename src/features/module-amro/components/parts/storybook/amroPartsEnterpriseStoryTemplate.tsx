import type { ArgTypes, Decorator, Parameters } from '@storybook/react-vite';

export type AmroPartsStoryGovernance = {
  componentId: string;
  ownerTeam: string;
  releaseRing: 'staging' | 'uat' | 'production';
  dataClassification: 'public' | 'internal' | 'restricted';
  approvalPolicy: string;
  auditReference: string;
};

export const amroPartsEnterpriseDecorator: Decorator = (Story) => {
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto w-full max-w-[1680px] space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span className="rounded-md bg-slate-100 px-2 py-1 font-medium">AMRO Parts Enterprise Story</span>
          <span className="rounded-md bg-slate-100 px-2 py-1">WCAG 2.1 AA target</span>
          <span className="rounded-md bg-slate-100 px-2 py-1">Inventory-only scope</span>
        </div>
        <Story />
      </div>
    </div>
  );
};

export const amroPartsEnterpriseParameters: Parameters = {
  layout: 'fullscreen',
  controls: {
    expanded: true,
    sort: 'requiredFirst',
  },
  options: {
    storySort: {
      order: ['AMRO', ['Parts']],
    },
  },
  backgrounds: {
    default: 'light',
    values: [
      { name: 'light', value: '#f8fafc' },
      { name: 'contrast', value: '#0f172a' },
    ],
  },
  a11y: {
    test: 'error',
    options: {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa'],
      },
    },
  },
  docs: {
    source: { type: 'dynamic' },
  },
};

export const amroPartsEnterpriseArgTypes: ArgTypes = {
  state: {
    description: 'Operational component state in module workflow.',
    table: { category: 'State' },
  },
  viewMode: {
    description: 'Enterprise split behavior for grid/detail productivity.',
    table: { category: 'Layout' },
  },
  density: {
    description: 'Information density profile for operations users.',
    table: { category: 'Layout' },
  },
  scrollBehavior: {
    description: 'Large-catalog rendering behavior.',
    table: { category: 'Performance' },
  },
};

export function buildAmroPartsEnterpriseDocsDescription(governance: AmroPartsStoryGovernance): string {
  return [
    'Enterprise Story Governance',
    `- Component ID: ${governance.componentId}`,
    `- Owner Team: ${governance.ownerTeam}`,
    `- Release Ring: ${governance.releaseRing}`,
    `- Data Classification: ${governance.dataClassification}`,
    `- Approval Policy: ${governance.approvalPolicy}`,
    `- Audit Reference: ${governance.auditReference}`,
    '',
    'This story template is intended for production-grade AMRO Parts operations and aligns with inventory-only scope, accessibility gates, and release governance.',
  ].join('\n');
}

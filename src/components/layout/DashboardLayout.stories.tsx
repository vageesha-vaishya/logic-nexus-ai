import type { Meta, StoryObj } from '@storybook/react-vite';
import { MemoryRouter } from 'react-router-dom';
import { DashboardLayout } from './DashboardLayout';
import { AuthProvider } from '@/hooks/useAuth';
import { CRMProvider } from '@/hooks/useCRM';
import { DomainContextProvider } from '@/contexts/DomainContext';
import { EnterpriseDashboardShell } from '@/components/dashboard/EnterpriseDashboardShell';
import type { EnterpriseFeedRow, EnterpriseKpi, EnterpriseLane } from '@/hooks/useEnterpriseDashboardData';

type EnterpriseReferenceProps = {
  profile: 'operations' | 'executive';
  emphasis: 'throughput' | 'margin';
  compactDensity: boolean;
  showAlerts: boolean;
};

function EnterpriseDashboardReference({ profile, emphasis, compactDensity, showAlerts }: EnterpriseReferenceProps) {
  const kpis: EnterpriseKpi[] =
    profile === 'operations'
      ? [
          { label: 'Active Shipments', value: '1,284', delta: '+8.2%', tone: 'text-emerald-600' },
          { label: 'On-Time Delivery', value: '96.4%', delta: '+1.5%', tone: 'text-emerald-600' },
          { label: 'Open Exceptions', value: '23', delta: '-14.8%', tone: 'text-amber-600' },
          { label: 'Avg Handling Time', value: '2h 18m', delta: '-11.3%', tone: 'text-emerald-600' },
        ]
      : [
          { label: 'Revenue (MTD)', value: '$4.82M', delta: '+12.1%', tone: 'text-emerald-600' },
          { label: 'Gross Margin', value: '24.7%', delta: '+1.9%', tone: 'text-emerald-600' },
          { label: 'Quote Win Rate', value: '37.6%', delta: '+3.2%', tone: 'text-emerald-600' },
          { label: 'Pipeline Coverage', value: '3.4x', delta: '+0.6x', tone: 'text-emerald-600' },
        ];

  const lanes: EnterpriseLane[] =
    emphasis === 'throughput'
      ? [
          { name: 'Intake Queue', value: 132, progress: 72, badge: 'Needs Triage', badgeTone: 'secondary' },
          { name: 'Dispatching', value: 89, progress: 64, badge: 'In Progress', badgeTone: 'default' },
          { name: 'In Transit', value: 406, progress: 88, badge: 'Healthy', badgeTone: 'outline' },
          { name: 'Proof of Delivery', value: 57, progress: 46, badge: 'Review', badgeTone: 'secondary' },
        ]
      : [
          { name: 'High-Margin Opportunities', value: 41, progress: 81, badge: 'Growth', badgeTone: 'default' },
          { name: 'Carrier Cost Variance', value: 18, progress: 58, badge: 'Watchlist', badgeTone: 'secondary' },
          { name: 'Rate Expiry (7d)', value: 12, progress: 37, badge: 'Renew', badgeTone: 'outline' },
          { name: 'Discount Exceptions', value: 9, progress: 24, badge: 'Approval', badgeTone: 'secondary' },
        ];

  const activityRows: EnterpriseFeedRow[] = [
    { account: 'Atlas Industrial', event: 'Shipment ETD changed', owner: 'Ops Team A', status: 'Mitigating', eta: '12m' },
    { account: 'Nordic Retail', event: 'Quote approved by finance', owner: 'Sales AM 03', status: 'Ready', eta: 'Now' },
    { account: 'BluePeak Logistics', event: 'Customs hold released', owner: 'Broker Team', status: 'Resolved', eta: '5m' },
    { account: 'Harbor Foods', event: 'Capacity request pending', owner: 'Procurement', status: 'Escalated', eta: '28m' },
  ];

  return (
    <EnterpriseDashboardShell
      profile={profile}
      compactDensity={compactDensity}
      showAlerts={showAlerts}
      heading="Enterprise Dashboard Reference"
      subheading="Production-grade reference shell for operations, sales, and executive workflows"
      kpis={kpis}
      lanes={lanes}
      activityRows={activityRows}
    />
  );
}

const meta: Meta<typeof EnterpriseDashboardReference> = {
  title: 'Dashboard/Enterprise/LayoutReference',
  component: EnterpriseDashboardReference,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const routePath = context.parameters?.routePath ?? '/dashboard/shipments/pipeline';
      if (typeof document !== 'undefined') {
        document.cookie = 'sidebar:state=true; path=/';
      }
      return (
        <MemoryRouter initialEntries={[routePath]}>
          <AuthProvider>
            <CRMProvider>
              <DomainContextProvider>
                <DashboardLayout>
                  <Story />
                </DashboardLayout>
              </DomainContextProvider>
            </CRMProvider>
          </AuthProvider>
        </MemoryRouter>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
    platformShell: true,
    controls: {
      include: ['profile', 'emphasis', 'compactDensity', 'showAlerts'],
    },
    docs: {
      description: {
        component:
          'Enterprise dashboard shell reference built on the production DashboardLayout with role-oriented KPI bands, execution lanes, SLA markers, and command feed.',
      },
    },
  },
  argTypes: {
    profile: {
      control: 'radio',
      options: ['operations', 'executive'],
    },
    emphasis: {
      control: 'radio',
      options: ['throughput', 'margin'],
    },
    compactDensity: { control: 'boolean' },
    showAlerts: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const OperationsCommandCenter: Story = {
  args: {
    profile: 'operations',
    emphasis: 'throughput',
    compactDensity: false,
    showAlerts: true,
  },
  parameters: {
    routePath: '/dashboard/shipments/pipeline',
    docs: {
      description: {
        story: 'Operations-focused command center with throughput emphasis, alert banner, and execution board visibility.',
      },
    },
  },
};

export const ExecutivePerformanceView: Story = {
  args: {
    profile: 'executive',
    emphasis: 'margin',
    compactDensity: false,
    showAlerts: false,
  },
  parameters: {
    routePath: '/dashboard/quotes/pipeline',
    docs: {
      description: {
        story: 'Executive reference focused on margin health, revenue trajectory, and strategic SLA outcomes.',
      },
    },
  },
};

export const CompactTabletReference: Story = {
  args: {
    profile: 'operations',
    emphasis: 'margin',
    compactDensity: true,
    showAlerts: true,
  },

  parameters: {
    routePath: '/dashboard/leads/pipeline',

    docs: {
      description: {
        story: 'Compact tablet baseline for responsive validation without losing enterprise information density.',
      },
    }
  },

  globals: {
    viewport: {
      value: 'tablet',
      isRotated: false
    }
  }
};

import type { Meta, StoryObj } from '@storybook/react';
import { CustomerSegmentation, Segment } from '../../components/crm/CustomerSegmentation';
import { SkeletonCards } from '@/components/ui/skeleton-table';
import { EmptyState, emptyStates } from '@/components/ui/empty-state';

const meta: Meta<typeof CustomerSegmentation> = {
  title: 'CRM/CustomerSegmentation',
  component: CustomerSegmentation,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Customer segmentation visualization with multiple criteria (demographic, behavioral, geographic), distribution charts, and breakdown analysis.',
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CustomerSegmentation>;

const segments: Segment[] = [
  { id: 's1', name: 'Enterprise Ops', size: 420, color: '#3b82f6', demographic: { industry: 'Logistics', title: 'Ops', company_size: '1000+' }, behavioral: { email_opens: 230, site_visits: 510 }, geographic: { region: 'NA', country: 'US' } },
  { id: 's2', name: 'Growth Startups', size: 280, color: '#10b981', demographic: { industry: 'E-commerce', title: 'Founder', company_size: '1-50' }, behavioral: { email_opens: 180, site_visits: 240 }, geographic: { region: 'EU', country: 'DE' } },
  { id: 's3', name: 'Government', size: 120, color: '#f59e0b', demographic: { industry: 'Gov', title: 'Procurement', company_size: '2000+' }, behavioral: { email_opens: 75, site_visits: 100 }, geographic: { region: 'APAC', country: 'SG' } },
  { id: 's4', name: 'SMB Retail', size: 360, color: '#8b5cf6', demographic: { industry: 'Retail', title: 'Owner', company_size: '50-250' }, behavioral: { email_opens: 210, site_visits: 330 }, geographic: { region: 'LATAM', country: 'BR' } },
];

export const Default: Story = {
  args: {
    segments,
    className: 'h-[600px]',
  },
};

export const Empty: Story = {
  args: {
    segments: [],
    className: 'h-[600px]',
  },
};

export const Loading: Story = {
  render: () => (
    <div className="h-[600px] p-6">
      <SkeletonCards count={6} />
    </div>
  ),
};

export const Error: Story = {
  render: () => (
    <div className="h-[600px] p-6">
      <EmptyState {...emptyStates.error('Unable to load segmentation data')} />
    </div>
  ),
};

export const RTL: Story = {
  render: () => (
    <div dir="rtl" className="h-[600px] p-6">
      <CustomerSegmentation segments={segments} />
    </div>
  ),
};


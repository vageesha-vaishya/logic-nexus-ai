import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { PipelineAnalytics } from '@/components/analytics/PipelineAnalytics';
import { mockLeads } from './mock-data';
import { Lead } from '@/pages/dashboard/leads-data';

const meta: Meta<typeof PipelineAnalytics> = {
  title: 'CRM/Analytics Dashboard',
  component: PipelineAnalytics,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof PipelineAnalytics>;

export const Default: Story = {
  args: {
    leads: mockLeads,
  },
  render: (args) => (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics</h1>
      <PipelineAnalytics {...args} />
    </div>
  ),
};

export const EmptyState: Story = {
  args: {
    leads: [],
  },
  render: (args) => (
    <div className="p-6 bg-slate-50 min-h-screen">
      <h1 className="text-2xl font-bold mb-6">Pipeline Analytics (Empty)</h1>
      <PipelineAnalytics {...args} />
    </div>
  ),
};

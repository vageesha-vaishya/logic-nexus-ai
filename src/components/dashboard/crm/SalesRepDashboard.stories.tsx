import type { Meta, StoryObj } from '@storybook/react';
import { SalesRepDashboard } from './SalesRepDashboard';
import { BrowserRouter } from 'react-router-dom';

const meta: Meta<typeof SalesRepDashboard> = {
  title: 'Dashboard/CRM/SalesRepDashboard',
  component: SalesRepDashboard,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <BrowserRouter>
        <div className="p-6 bg-gray-50 min-h-screen">
          <Story />
        </div>
      </BrowserRouter>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FullWidth: Story = {
  args: {},
  parameters: {
    layout: 'fullscreen',
  },
};

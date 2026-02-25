import type { Meta, StoryObj } from '@storybook/react';
import { DispatcherDashboard } from './DispatcherDashboard';
import { BrowserRouter } from 'react-router-dom';

const meta: Meta<typeof DispatcherDashboard> = {
  title: 'Dashboard/Logistics/DispatcherDashboard',
  component: DispatcherDashboard,
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

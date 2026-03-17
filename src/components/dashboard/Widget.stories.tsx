import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { WidgetContainer } from './WidgetContainer';

const meta: Meta<typeof WidgetContainer> = {
  title: 'Dashboard/Widget',
  component: WidgetContainer,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    controls: {
      expanded: true,
    },
  },
  argTypes: {
    title: {
      control: 'text',
      description: 'Widget title',
    },
    children: {
      description: 'Widget content',
    },
    className: {
      control: 'text',
      description: 'Custom CSS classes for the card',
    },
  },
};

export default meta;
type Story = StoryObj<typeof WidgetContainer>;

const WidgetBody = ({ children }: { children: React.ReactNode }) => (
  <div className="p-4 text-center text-gray-600">{children}</div>
);

export const Small: Story = {
  args: {
    title: 'Small Widget',
    children: <WidgetBody>Small widget content here</WidgetBody>,
    className: 'w-48',
  },
};

export const Medium: Story = {
  args: {
    title: 'Medium Widget',
    children: <WidgetBody>Medium widget content here</WidgetBody>,
    className: 'w-96',
  },
};

export const Large: Story = {
  args: {
    title: 'Large Widget',
    children: <WidgetBody>Large widget content here with more space for displaying data</WidgetBody>,
    className: 'w-full',
  },
};

export const Full: Story = {
  args: {
    title: 'Full Width Widget',
    children: <WidgetBody>Full width widget content spanning the entire width</WidgetBody>,
    className: 'w-full',
  },
};

export const WithActions: Story = {
  args: {
    title: 'Widget with Actions',
    children: <WidgetBody>Widget content with action buttons</WidgetBody>,
    action: (
      <div className="flex gap-2">
        <button className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600">
          Action 1
        </button>
        <button className="px-3 py-1 text-sm bg-gray-300 text-gray-700 rounded hover:bg-gray-400">
          Action 2
        </button>
      </div>
    ),
    className: 'w-96',
  },
};

export const WithoutTitle: Story = {
  args: {
    children: <WidgetBody>Widget without a title bar</WidgetBody>,
    className: 'w-96',
  },
};

export const WithComplexContent: Story = {
  args: {
    title: 'Complex Widget',
    children: (
      <div className="space-y-3">
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 1</span>
          <span className="text-lg font-bold text-blue-600">$45,000</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 2</span>
          <span className="text-lg font-bold text-green-600">82%</span>
        </div>
        <div className="flex justify-between items-center p-2 bg-gray-50 rounded">
          <span className="font-medium">Metric 3</span>
          <span className="text-lg font-bold text-purple-600">1,234</span>
        </div>
      </div>
    ),
    className: 'w-96',
  },
};

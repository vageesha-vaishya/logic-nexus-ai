import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Sidebar Workspace',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Workspace tone with balanced navigation and content density; suited for daily operations.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-violet-50" themePreset="Slate Aurora" />
};


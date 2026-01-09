import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Sidebar Workspace 2',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Alternative workspace theme emphasizing sidebar accents and neutral backgrounds.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-neutral-50" themePreset="Original Logistics" />
};


import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Minimalist',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Minimalist design emphasizing clarity, whitespace, and straightforward navigation.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-slate-50" themePreset="Azure Minimal" />
};


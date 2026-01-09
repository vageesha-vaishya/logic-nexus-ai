import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Compliance Mode',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Compliance-conscious visuals with strong contrasts, explicit states, and WCAG emphasis.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-zinc-50" themePreset="Accessible Cool" />
};


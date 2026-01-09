import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Assistive AI',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Assistive flavor with predictive segments; highlights leads most likely to convert.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-cyan-50" themePreset="Teal Drift" />
};


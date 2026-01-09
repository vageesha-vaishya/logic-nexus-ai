import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Card Driven',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Card-driven visuals with pronounced elevation and micro-interactions on hover/drag.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-emerald-50" themePreset="Forest Night" />
};


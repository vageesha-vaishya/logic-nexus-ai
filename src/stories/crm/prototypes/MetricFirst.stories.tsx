import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Metric First',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Metric-first overview prioritizing KPIs and quick trend checks before diving deeper.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-amber-50" themePreset="Golden Hour" />
};


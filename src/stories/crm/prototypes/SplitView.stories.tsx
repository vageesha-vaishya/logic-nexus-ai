import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Split View',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Split-view emphasis with pipeline and analytics side-by-side, suitable for tablet workflows.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-sky-50" themePreset="Nordic Frost" />
};


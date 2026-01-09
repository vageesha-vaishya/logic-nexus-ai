import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Data Dense',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Data-dense layout for power users; tighter spacing and more on-screen information.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-neutral-50" themePreset="Solarized Dark" />
};


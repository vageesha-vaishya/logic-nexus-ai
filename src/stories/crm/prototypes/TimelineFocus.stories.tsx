import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/Timeline Focus',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'Focus on recent activities and chronology; quick discovery of next actions.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => <PrototypeLayout themeClass="bg-indigo-50" themePreset="Midnight Aurora" />
};


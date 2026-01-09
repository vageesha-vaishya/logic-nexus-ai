import type { Meta, StoryObj } from '@storybook/react';
import { PrototypeLayout } from './Layout';

const meta: Meta = {
  title: 'CRM/Prototypes/RTL Global',
  parameters: {
    layout: 'fullscreen',
    docs: { description: { component: 'RTL-first global layout showcasing mirrored flow and direction-aware components.' } }
  },
};
export default meta;
type Story = StoryObj;

export const Prototype: Story = {
  render: () => (
    <div dir="rtl" className="rtl">
      <PrototypeLayout themeClass="bg-rose-50" themePreset="Sunset Canyon" />
    </div>
  )
};


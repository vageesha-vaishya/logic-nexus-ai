import type { Meta, StoryObj } from "@storybook/react";
import { FormStepper } from "./FormStepper";

const meta: Meta<typeof FormStepper> = {
  title: "System/FormStepper",
  component: FormStepper,
  parameters: {
    a11y: { disable: false },
    viewport: { defaultViewport: "desktop" },
  },
  argTypes: {
    activeId: { control: "text", description: "Active step id" },
  },
};

export default meta;
type Story = StoryObj<typeof FormStepper>;

const steps = [
  { id: "basics", label: "Basics" },
  { id: "contact", label: "Contact" },
  { id: "review", label: "Review" },
];

export const Basic: Story = {
  args: {
    steps,
    activeId: "basics",
  },
};

export const WithActions: Story = {
  args: {
    steps,
    activeId: "contact",
    onPrev: () => {},
    onNext: () => {},
  },
};

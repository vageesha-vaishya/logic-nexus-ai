import type { Meta, StoryObj } from "@storybook/react";
import { FormSection, FormGrid } from "./FormLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof FormSection> = {
  title: "Forms/FormSection",
  component: FormSection,
  parameters: {
    a11y: { disable: false },
  },
  argTypes: {
    title: { control: "text", description: "Section title" },
    description: { control: "text", description: "Section description" },
    actions: { control: "object", description: "Header actions node" },
  },
};

export default meta;
type Story = StoryObj<typeof FormSection>;

export const Basic: Story = {
  args: {
    title: "Details",
    description: "Provide information below",
  },
  render: (args) => (
    <div className="p-4">
      <FormSection {...args}>
        <FormGrid columns={2}>
          <div className="space-y-1">
            <Label>Field A</Label>
            <Input placeholder="Value A" />
          </div>
          <div className="space-y-1">
            <Label>Field B</Label>
            <Input placeholder="Value B" />
          </div>
        </FormGrid>
      </FormSection>
    </div>
  ),
};

export const WithActions: Story = {
  args: {
    ...Basic.args,
    actions: <Button size="sm" variant="outline">Action</Button>,
  },
  render: Basic.render,
};


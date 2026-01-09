import type { Meta, StoryObj } from "@storybook/react";
import { CrudFormLayout } from "./CrudFormLayout";
import { FormSection, FormGrid } from "@/components/forms/FormLayout";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

const meta: Meta<typeof CrudFormLayout> = {
  title: "System/CrudFormLayout",
  component: CrudFormLayout,
  parameters: {
    a11y: { disable: false },
  },
  argTypes: {
    title: { control: "text", description: "Form title" },
    description: { control: "text", description: "Form description" },
    onCancel: { action: "cancel", description: "Cancel handler" },
    onSave: { action: "save", description: "Save handler" },
    saveDisabled: { control: "boolean", description: "Disable Save button" },
  },
};

export default meta;
type Story = StoryObj<typeof CrudFormLayout>;

function SampleFields() {
  return (
    <>
      <FormSection title="Basics" description="Primary identification fields">
        <FormGrid columns={2}>
          <div className="space-y-1">
            <Label>Name</Label>
            <Input placeholder="Enter name" />
          </div>
          <div className="space-y-1">
            <Label>Code</Label>
            <Input placeholder="Enter code" />
          </div>
        </FormGrid>
      </FormSection>
      <FormSection title="Contact" description="Communication details">
        <FormGrid columns={3}>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input type="email" placeholder="user@example.com" />
          </div>
          <div className="space-y-1">
            <Label>Phone</Label>
            <Input placeholder="+1 555-1234" />
          </div>
          <div className="space-y-1">
            <Label>Website</Label>
            <Input placeholder="example.com" />
          </div>
        </FormGrid>
      </FormSection>
    </>
  );
}

export const Basic: Story = {
  args: {
    title: "Create Entity",
    description: "Provide required details and save",
    footerExtra: <Button variant="ghost" size="sm">Help</Button>,
  },
  render: (args) => (
    <div className="p-4">
      <CrudFormLayout {...args}>
        <SampleFields />
      </CrudFormLayout>
    </div>
  ),
};

export const SaveDisabled: Story = {
  ...Basic,
  args: {
    ...Basic.args,
    saveDisabled: true,
  },
};


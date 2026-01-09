import type { Meta, StoryObj } from '@storybook/react';
import { FormGrid, FormItem, FormSection } from './FormLayout';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '../ui/select';

const meta: Meta<typeof FormGrid> = {
  title: 'Forms/FormGrid',
  component: FormGrid,
  tags: ['autodocs'],
  argTypes: {
    columns: {
      control: 'select',
      options: [1, 2, 3, 4],
      description: 'Number of columns at md/lg breakpoints',
    },
  },
};

export default meta;
type Story = StoryObj<typeof FormGrid>;

const Field = ({ label, placeholder, span }: { label: string; placeholder?: string; span?: any }) => (
  <FormItem span={span}>
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input placeholder={placeholder || `Enter ${label.toLowerCase()}...`} />
    </div>
  </FormItem>
);

export const FourColumnLayout: Story = {
  args: {
    columns: 4,
  },
  render: (args) => (
    <FormSection title="Complex Entity Form" description="Example of a complex form with mixed column spans">
      <FormGrid {...args}>
        <Field label="Organization Name" span={2} />
        <Field label="Tax ID" />
        <Field label="Status" />
        
        <Field label="Full Address" span="full" placeholder="123 Main St, Suite 100" />
        
        <Field label="City" />
        <Field label="State" />
        <Field label="Zip Code" />
        <Field label="Country" />

        <FormItem span={4}>
          <div className="p-4 border rounded bg-muted/20 text-center text-muted-foreground">
            Full width section (span 4)
          </div>
        </FormItem>

        <Field label="Contact Person" span={2} />
        <Field label="Email" span={2} />
      </FormGrid>
    </FormSection>
  ),
};

export const ThreeColumnLayout: Story = {
  args: {
    columns: 3,
  },
  render: (args) => (
    <FormSection title="3-Column Grid" description="Standard desktop layout">
      <FormGrid {...args}>
        <Field label="First Name" />
        <Field label="Middle Name" />
        <Field label="Last Name" />
        
        <Field label="Address" span={2} />
        <Field label="Zip" />
        
        <Field label="Notes" span="full" />
      </FormGrid>
    </FormSection>
  ),
};

export const TwoColumnLayout: Story = {
  args: {
    columns: 2,
  },
  render: (args) => (
    <FormSection title="2-Column Grid" description="Compact layout">
      <FormGrid {...args}>
        <Field label="Username" />
        <Field label="Role" />
        <Field label="Email" span="full" />
        <Field label="Password" />
        <Field label="Confirm Password" />
      </FormGrid>
    </FormSection>
  ),
};

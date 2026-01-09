import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { FormGrid, FormItem, FormSection } from './FormLayout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const meta: Meta<typeof FormGrid> = {
  title: 'Forms/FormLayout',
  component: FormGrid,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof FormGrid>;

export const ComplexEntityForm: Story = {
  render: () => (
    <FormSection 
      title="Complex Entity Form" 
      description="Example of a complex form with mixed column spans"
      className="max-w-4xl"
    >
      <FormGrid columns={4}>
        <FormItem span={2}>
          <Label>Status</Label>
          <Select>
            <SelectTrigger>
              <SelectValue placeholder="...Enter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FormItem>
        <FormItem span={2}>
          <Label>Tax ID</Label>
          <Input placeholder="...Enter tax id" />
        </FormItem>

        <FormItem span={4}>
          <Label>Organization Name</Label>
          <Input placeholder="...Enter organization name" />
        </FormItem>

        <FormItem span={4}>
          <Label>Full Address</Label>
          <Input defaultValue="Main St, Suite 100 123" />
        </FormItem>

        <FormItem span={1}>
          <Label>Country</Label>
          <Input placeholder="...Enter country" />
        </FormItem>
        <FormItem span={1}>
          <Label>Zip Code</Label>
          <Input placeholder="...Enter zip code" />
        </FormItem>
        <FormItem span={1}>
          <Label>State</Label>
          <Input placeholder="...Enter state" />
        </FormItem>
        <FormItem span={1}>
          <Label>City</Label>
          <Input placeholder="...Enter city" />
        </FormItem>

        <FormItem span={4} className="p-4 bg-muted rounded-md border border-dashed text-center text-muted-foreground">
          Full width section (span 4)
        </FormItem>

        <FormItem span={2}>
          <Label>Email</Label>
          <Input placeholder="...Enter email" />
        </FormItem>
        <FormItem span={2}>
          <Label>Contact Person</Label>
          <Input placeholder="...Enter contact person" />
        </FormItem>
        
        <FormItem span={4} className="flex justify-end pt-4">
          <div className="flex gap-2">
            <Button variant="outline">Cancel</Button>
            <Button>Save Changes</Button>
          </div>
        </FormItem>
      </FormGrid>
    </FormSection>
  ),
};

export const FourColumnLayout: Story = {
  render: () => (
    <FormGrid columns={4}>
      <FormItem span={1}>
        <Label>Column 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 2</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 3</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      <FormItem span={1}>
        <Label>Column 4</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      <FormItem span={2}>
        <Label>Span 2</Label>
        <Input placeholder="Span 2" />
      </FormItem>
      
      <FormItem span={3}>
        <Label>Span 3</Label>
        <Input placeholder="Span 3" />
      </FormItem>
      <FormItem span={1}>
        <Label>Span 1</Label>
        <Input placeholder="Span 1" />
      </FormItem>
      
      <FormItem span={4}>
        <Label>Span 4 (Full Width)</Label>
        <Input placeholder="Span 4" />
      </FormItem>
    </FormGrid>
  )
};

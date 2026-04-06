import type { Meta, StoryObj } from '@storybook/react-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import {
  CRMBadge,
  CRMButton,
  CRMContactListPage,
  CRMCRUDLayout,
  CRMDataTable,
  CRMDatePicker,
  CRMDealPipelinePage,
  CRMFilterBar,
  CRMFormField,
  CRMIcon,
  CRMLink,
  CRMModal,
  CRMNavigation,
  CRMPageShell,
  CRMSearchBar,
  CRMToast
} from '@/design-system/components';

const meta: Meta<typeof CRMButton> = {
  title: 'CRM Design System/Atomic Library',
  component: CRMButton,
  tags: ['autodocs'],
  args: {
    variant: 'primary',
    viewport: 'desktop',
    children: 'Create Contact',
    onClick: fn()
  },
  argTypes: {
    variant: { control: 'radio', options: ['primary', 'secondary', 'danger'] },
    viewport: { control: 'radio', options: ['mobile', 'tablet', 'desktop'] },
    disabled: { control: 'boolean' },
    children: { control: 'text' }
  },
  parameters: {
    design: {
      type: 'figma',
      url: 'https://www.figma.com/file/7rVZtP0crmCanonical/CRM-Design-System'
    }
  }
};

export default meta;
type Story = StoryObj<typeof CRMButton>;

export const AtomButtonVariants: Story = {
  render: (args) => (
    <div className="flex flex-wrap gap-3">
      <CRMButton {...args} variant="primary">Primary</CRMButton>
      <CRMButton {...args} variant="secondary">Secondary</CRMButton>
      <CRMButton {...args} variant="danger">Danger</CRMButton>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: 'Primary' }));
    await expect(canvas.getByRole('button', { name: 'Danger' })).toBeVisible();
  }
};

export const AtomIconLinkBadge: Story = {
  render: (args) => (
    <div className="flex items-center gap-4">
      <CRMIcon name="info" variant={args.variant} aria-label="Info icon" />
      <CRMLink href="#accounts" variant={args.variant} viewport={args.viewport}>Open Account</CRMLink>
      <CRMBadge variant={args.variant} viewport={args.viewport}>Active</CRMBadge>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('img', { name: 'Info icon' })).toBeVisible();
    await expect(canvas.getByRole('link', { name: 'Open Account' })).toBeVisible();
  }
};

export const MoleculeInputs: Story = {
  render: () => (
    <div className="grid max-w-2xl gap-4">
      <CRMFormField id="dealName" label="Deal Name" helperText="Use customer-facing wording." inputProps={{ placeholder: 'Enterprise renewal' }} />
      <CRMSearchBar placeholder="Search deals..." />
      <CRMDatePicker />
      <CRMToast title="Saved" message="Contact record has been updated." />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText('Search'), 'acme');
    await expect(canvas.getByRole('status')).toBeVisible();
  }
};

export const OrganismSet: Story = {
  render: () => (
    <div className="space-y-4">
      <CRMNavigation items={[{ id: 'contacts', label: 'Contacts', href: '#contacts', badge: '12' }, { id: 'deals', label: 'Deals', href: '#deals' }]} activeId="contacts" />
      <CRMFilterBar filters={[{ label: 'Owner', value: 'Alicia' }, { label: 'Stage', value: 'Proposal' }]} />
      <CRMDataTable
        columns={[
          { key: 'account', label: 'Account' },
          { key: 'owner', label: 'Owner' },
          { key: 'value', label: 'Value' }
        ]}
        rows={[
          { account: 'Acme Industrial', owner: 'Alicia', value: '$120,000' },
          { account: 'Blue Freight', owner: 'Dev', value: '$42,000' }
        ]}
      />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('navigation', { name: 'CRM navigation' })).toBeVisible();
    await expect(canvas.getByRole('table', { name: 'CRM data table' })).toBeVisible();
  }
};

export const ModalFlow: Story = {
  render: () => (
    <CRMModal
      open
      title="Delete Contact"
      description="This action is permanent."
      variant="danger"
      onOpenChange={fn()}
      onConfirm={fn()}
    >
      Remove the selected contact and related activity history.
    </CRMModal>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('dialog')).toBeVisible();
    await userEvent.click(canvas.getByRole('button', { name: 'Confirm' }));
  }
};

export const Templates: Story = {
  render: () => (
    <div className="space-y-6">
      <CRMPageShell
        title="CRM Workspace"
        subtitle="Template-level layout for module pages."
        navigationItems={[{ id: 'contacts', label: 'Contacts', href: '#contacts' }]}
        activeNavId="contacts"
      >
        <CRMCRUDLayout
          title="Contacts"
          table={
            <CRMDataTable
              columns={[{ key: 'name', label: 'Name' }]}
              rows={[{ name: 'Alicia Morgan' }]}
            />
          }
        />
      </CRMPageShell>
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'CRM Workspace' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Contacts' })).toBeVisible();
  }
};

export const Pages: Story = {
  render: () => (
    <div className="space-y-8">
      <CRMContactListPage />
      <CRMDealPipelinePage />
    </div>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('heading', { name: 'Contacts' })).toBeVisible();
    await expect(canvas.getByRole('heading', { name: 'Deal Pipeline' })).toBeVisible();
  }
};

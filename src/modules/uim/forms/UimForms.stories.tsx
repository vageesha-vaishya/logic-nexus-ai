import type { Meta, StoryObj } from '@storybook/react-vite';
import {
  UimAnalyticsForm,
  UimIssueConsumeForm,
  UimItemMasterForm,
  UimLocationsForm,
  UimOverviewForm,
  UimReservationsForm,
  UimRestockForm,
  UimStockLedgerForm,
} from './UimForms';

const meta: Meta = {
  title: 'UIM/Forms',
  parameters: {
    layout: 'padded',
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
  argTypes: {
    existingEntity: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<{ existingEntity?: Record<string, unknown> }>;

export const Overview: Story = {
  render: (args) => <UimOverviewForm existingEntity={args.existingEntity || null} />,
};

export const ItemMaster: Story = {
  render: (args) => <UimItemMasterForm existingEntity={args.existingEntity || null} />,
};

export const StockLedger: Story = {
  render: (args) => <UimStockLedgerForm existingEntity={args.existingEntity || null} />,
};

export const Reservations: Story = {
  render: (args) => <UimReservationsForm existingEntity={args.existingEntity || null} />,
};

export const IssueConsume: Story = {
  render: (args) => <UimIssueConsumeForm existingEntity={args.existingEntity || null} />,
};

export const Restock: Story = {
  render: (args) => <UimRestockForm existingEntity={args.existingEntity || null} />,
};

export const Locations: Story = {
  render: (args) => <UimLocationsForm existingEntity={args.existingEntity || null} />,
};

export const Analytics: Story = {
  render: (args) => <UimAnalyticsForm existingEntity={args.existingEntity || null} />,
};

export const OverviewDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimOverviewForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const ItemMasterDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimItemMasterForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const StockLedgerDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimStockLedgerForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const ReservationsDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimReservationsForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const IssueConsumeDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimIssueConsumeForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const RestockDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimRestockForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const LocationsDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimLocationsForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

export const AnalyticsDark: Story = {
  render: (args) => (
    <div className="dark bg-background p-4">
      <UimAnalyticsForm existingEntity={args.existingEntity || null} />
    </div>
  ),
};

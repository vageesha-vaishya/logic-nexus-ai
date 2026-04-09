import type { Meta, StoryObj } from '@storybook/react';
import {
  AnalyticsPanel,
  IssueConsumePanel,
  LocationsPanel,
  ReservationsPanel,
  RestockPanel,
} from './AmroPartsModulePanels';
import { generatePartInventoryRecords } from './mockPartsInventoryData';

const records = generatePartInventoryRecords({ seed: 424242, count: 32 });

const meta: Meta = {
  title: 'AMRO/Parts/Operational Panels',
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj;

export const Reservations: Story = {
  render: () => <ReservationsPanel records={records} />,
};

export const IssueAndConsume: Story = {
  render: () => <IssueConsumePanel records={records} />,
};

export const Restock: Story = {
  render: () => <RestockPanel records={records} />,
};

export const Locations: Story = {
  render: () => <LocationsPanel records={records} />,
};

export const Analytics: Story = {
  render: () => <AnalyticsPanel records={records} />,
};

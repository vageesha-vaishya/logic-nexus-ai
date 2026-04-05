import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/components/ui/badge';
import type { UimDataListColumn } from '@/modules/uim/components/UimDataList';
import {
  UimStandardFormTemplate,
} from './UimStandardFormTemplate';

type Row = Record<string, unknown>;

function makeColumns(keys: string[]): UimDataListColumn<Row>[] {
  return keys.map((key) => ({
    key,
    header: key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()),
    sortable: true,
    render: (record) => {
      const payload = (record.payload || {}) as Record<string, unknown>;
      const value = payload[key];
      return value === undefined || value === null || value === '' ? '-' : String(value);
    },
  }));
}

function makeRecord(id: string, payload: Record<string, unknown>): Row {
  return {
    id,
    updated_at: payload.updated_at || '2026-04-05T00:00:00.000Z',
    payload,
  };
}

const meta: Meta<typeof UimStandardFormTemplate> = {
  title: 'UIM/Templates/UimStandardFormTemplate',
  component: UimStandardFormTemplate,
  parameters: {
    layout: 'padded',
  },
  args: {
    moduleTitle: 'UIM Template',
    moduleDescription: 'Standardized form/list template for UIM modules',
    moduleKey: 'template',
    mode: 'edit',
    state: 'ready',
    statusBadge: 'Canonical',
    breadcrumbs: ['UIM', 'Template'],
    validation: { status: 'ok', messages: [] },
    formSlot: <div className="text-sm">Form fields slot</div>,
    sidePanelSlot: <Badge variant="outline">Activity / Side Panel</Badge>,
    list: {
      records: [],
      total: 0,
      columns: [],
      exportFileName: 'uim-template.csv',
      defaultVisibleColumnKeys: [],
      showFieldSelector: true,
      statusOptions: [
        { value: 'all', label: 'All' },
        { value: 'active', label: 'Active' },
        { value: 'pending', label: 'Pending' },
      ],
    },
  },
  argTypes: {
    mode: { control: 'inline-radio', options: ['create', 'edit', 'readonly'] },
    state: { control: 'inline-radio', options: ['ready', 'loading', 'empty', 'error'] },
    validation: { control: 'object' },
    list: { control: 'object' },
  },
};

export default meta;
type Story = StoryObj<typeof UimStandardFormTemplate>;

export const OverviewModule: Story = {
  args: {
    moduleTitle: 'UIM Overview',
    moduleKey: 'overview',
    list: {
      records: [makeRecord('ov-1', {
        module_name: 'Universal Inventory Management',
        owner_email: 'owner@logicnexus.ai',
        rollout_phase: 'phase_4',
        target_go_live_date: '2026-05-15',
        status: 'active',
        updated_at: '2026-04-05T11:00:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['module_name', 'owner_email', 'rollout_phase', 'target_go_live_date', 'status', 'updated_at']),
      exportFileName: 'uim-overview.csv',
      defaultVisibleColumnKeys: ['module_name', 'owner_email', 'rollout_phase', 'target_go_live_date', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const ItemMasterModule: Story = {
  args: {
    moduleTitle: 'UIM Item Master',
    moduleKey: 'item-master',
    list: {
      records: [makeRecord('im-1', {
        sku: 'UIM-MRO-000101',
        part_number: 'MRO-PN-70000101',
        item_name: 'Fuel Pump',
        category: 'rotable',
        status: 'active',
        updated_at: '2026-04-05T11:05:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['sku', 'part_number', 'item_name', 'category', 'status', 'updated_at', 'manufacturer_name']),
      exportFileName: 'uim-item-master.csv',
      defaultVisibleColumnKeys: ['sku', 'part_number', 'item_name', 'category', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const StockLedgerModule: Story = {
  args: {
    moduleTitle: 'UIM Stock Ledger',
    moduleKey: 'stock-ledger',
    list: {
      records: [makeRecord('sl-1', {
        item_id: 'inv-1001',
        transaction_type: 'RECEIVE',
        quantity_delta: '12',
        referenced_module: 'procurement',
        status: 'posted',
        updated_at: '2026-04-05T11:10:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'referenced_module', 'status', 'updated_at']),
      exportFileName: 'uim-stock-ledger.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'referenced_module', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const ReservationsModule: Story = {
  args: {
    moduleTitle: 'UIM Reservations',
    moduleKey: 'reservations',
    list: {
      records: [makeRecord('rsv-1', {
        reservation_token: 'RSV-900001',
        item_id: 'inv-1001',
        requested_quantity: '2',
        reservation_status: 'active',
        expected_use_date: '2026-04-12',
        updated_at: '2026-04-05T11:15:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['reservation_token', 'item_id', 'requested_quantity', 'reservation_status', 'expected_use_date', 'updated_at']),
      exportFileName: 'uim-reservations.csv',
      defaultVisibleColumnKeys: ['reservation_token', 'item_id', 'requested_quantity', 'reservation_status', 'expected_use_date', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const IssueConsumeModule: Story = {
  args: {
    moduleTitle: 'UIM Issue & Consume',
    moduleKey: 'issue-consume',
    list: {
      records: [makeRecord('ic-1', {
        item_id: 'inv-1002',
        transaction_type: 'CONSUME',
        quantity_delta: '1',
        reference: 'WO-7781',
        status: 'posted',
        updated_at: '2026-04-05T11:20:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at']),
      exportFileName: 'uim-issue-consume.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const RestockModule: Story = {
  args: {
    moduleTitle: 'UIM Restock',
    moduleKey: 'restock',
    list: {
      records: [makeRecord('rs-1', {
        item_id: 'inv-1003',
        transaction_type: 'RECEIVE',
        quantity_delta: '8',
        reference: 'PO-5588',
        status: 'posted',
        updated_at: '2026-04-05T11:25:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at']),
      exportFileName: 'uim-restock.csv',
      defaultVisibleColumnKeys: ['item_id', 'transaction_type', 'quantity_delta', 'reference', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const LocationsModule: Story = {
  args: {
    moduleTitle: 'UIM Locations',
    moduleKey: 'locations',
    list: {
      records: [makeRecord('loc-1', {
        location_code: 'HGR-MAIN',
        location_name: 'Hangar Main Stores',
        location_type: 'warehouse',
        quantity: '188',
        status: 'available',
        updated_at: '2026-04-05T11:30:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['location_code', 'location_name', 'location_type', 'quantity', 'status', 'updated_at']),
      exportFileName: 'uim-locations.csv',
      defaultVisibleColumnKeys: ['location_code', 'location_name', 'location_type', 'quantity', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const AnalyticsModule: Story = {
  args: {
    moduleTitle: 'UIM Analytics',
    moduleKey: 'analytics',
    list: {
      records: [makeRecord('an-1', {
        report_name: 'Inventory Snapshot',
        metric_group: 'inventory_health',
        catalog_items: '900',
        inventory_items: '900',
        projection_snapshots: '900',
        updated_at: '2026-04-05T11:35:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['report_name', 'metric_group', 'catalog_items', 'inventory_items', 'projection_snapshots', 'updated_at']),
      exportFileName: 'uim-analytics.csv',
      defaultVisibleColumnKeys: ['report_name', 'metric_group', 'catalog_items', 'inventory_items', 'projection_snapshots', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

export const FormStandardContract: Story = {
  args: {
    moduleTitle: 'UIM Form Standard Contract',
    moduleKey: 'contract',
    state: 'ready',
    validation: {
      status: 'warning',
      messages: [
        'Default visible fields must include exactly 6 business-critical columns.',
        'Field selector must allow users to add/remove extra columns.',
      ],
    },
    formSlot: (
      <div className="space-y-2 text-sm">
        <div><strong>Contract Rule:</strong> No module-level layout forks.</div>
        <div>Use config to define fields, defaults, status options, and validation states.</div>
      </div>
    ),
    list: {
      records: [makeRecord('contract-1', {
        rule_id: 'STD-001',
        rule_name: 'Six default business fields',
        owner: 'UIM Architecture',
        compliance: 'required',
        status: 'active',
        updated_at: '2026-04-05T11:40:00.000Z',
      })],
      total: 1,
      columns: makeColumns(['rule_id', 'rule_name', 'owner', 'compliance', 'status', 'updated_at']),
      exportFileName: 'uim-form-standard-contract.csv',
      defaultVisibleColumnKeys: ['rule_id', 'rule_name', 'owner', 'compliance', 'status', 'updated_at'],
      showFieldSelector: true,
    },
  },
};

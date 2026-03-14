import type { Meta, StoryObj } from '@storybook/react';
import { SalesRepDashboard } from './SalesRepDashboard';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { CRMProvider } from '@/hooks/useCRM';

type StoryRow = Record<string, any>;
type SelectOptions = { count?: 'exact'; head?: boolean };
type DatasetName =
  | 'leads'
  | 'activities'
  | 'accounts'
  | 'contacts'
  | 'opportunities'
  | 'dashboard_preferences';

const now = new Date();
const thisYear = now.getFullYear();
const toIsoDate = (date: Date) => date.toISOString().split('T')[0];

const createStoryDataset = (): Record<DatasetName, StoryRow[]> => ({
  leads: [
    { id: 'lead-1', company_name: 'Apex Freight', status: 'new', source: 'web' },
    { id: 'lead-2', company_name: 'BlueWave Cargo', status: 'qualified', source: 'email' },
    { id: 'lead-3', company_name: 'NorthStar Imports', status: 'new', source: 'referral' },
  ],
  activities: [
    { id: 'act-1', type: 'call', status: 'completed', occurred_at: `${thisYear}-03-01T10:30:00.000Z` },
    { id: 'act-2', type: 'meeting', status: 'scheduled', occurred_at: `${thisYear}-03-03T14:00:00.000Z` },
    { id: 'act-3', type: 'email', status: 'completed', occurred_at: `${thisYear}-03-05T09:15:00.000Z` },
  ],
  accounts: [
    { id: 'acc-1', name: 'Global Trade Inc', annual_revenue: 3200000, industry: 'Logistics' },
    { id: 'acc-2', name: 'Oceanic Retail', annual_revenue: 1800000, industry: 'Retail' },
  ],
  contacts: [
    { id: 'con-1', first_name: 'Ava', last_name: 'Martinez', email: 'ava@globaltrade.com' },
    { id: 'con-2', first_name: 'Noah', last_name: 'Patel', email: 'noah@oceanicretail.com' },
  ],
  opportunities: [
    { id: 'opp-1', stage: 'prospecting', amount: 45000, probability: 25, close_date: toIsoDate(new Date(thisYear, now.getMonth(), 20)) },
    { id: 'opp-2', stage: 'proposal', amount: 110000, probability: 55, close_date: toIsoDate(new Date(thisYear, now.getMonth() + 1, 8)) },
    { id: 'opp-3', stage: 'negotiation', amount: 76000, probability: 70, close_date: toIsoDate(new Date(thisYear, now.getMonth() + 2, 14)) },
    { id: 'opp-4', stage: 'closed_won', amount: 98000, probability: 100, close_date: toIsoDate(new Date(thisYear, 1, 15)) },
    { id: 'opp-5', stage: 'closed_won', amount: 67000, probability: 100, close_date: toIsoDate(new Date(thisYear, 2, 11)) },
    { id: 'opp-6', stage: 'closed_lost', amount: 52000, probability: 0, close_date: toIsoDate(new Date(thisYear, 0, 29)) },
  ],
  dashboard_preferences: [],
});

const parseSelectedColumns = (selection: string) => {
  if (!selection || selection === '*') return null;
  return selection
    .split(',')
    .map((column) => column.trim())
    .map((column) => column.split(':')[0].trim())
    .map((column) => column.split('(')[0].trim())
    .filter(Boolean);
};

const normalizeComparableValue = (value: any) => {
  if (typeof value === 'string' && value.includes('T')) {
    const timestamp = Date.parse(value);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    if (!Number.isNaN(timestamp)) {
      return timestamp;
    }
  }
  return value;
};

const createSelectQuery = (
  table: DatasetName,
  selection: string,
  options: SelectOptions | undefined,
  dataSet: Record<DatasetName, StoryRow[]>
) => {
  const sourceRows = [...dataSet[table]];
  const filters: Array<(row: StoryRow) => boolean> = [];
  let limitCount: number | null = null;
  let orderBy: { column: string; ascending: boolean } | null = null;

  const execute = async () => {
    let filteredRows = sourceRows.filter((row) => filters.every((predicate) => predicate(row)));

    if (orderBy) {
      filteredRows = [...filteredRows].sort((a, b) => {
        const aValue = a[orderBy.column];
        const bValue = b[orderBy.column];
        if (aValue === bValue) return 0;
        if (aValue === undefined || aValue === null) return orderBy.ascending ? 1 : -1;
        if (bValue === undefined || bValue === null) return orderBy.ascending ? -1 : 1;
        if (aValue > bValue) return orderBy.ascending ? 1 : -1;
        return orderBy.ascending ? -1 : 1;
      });
    }

    if (typeof limitCount === 'number') {
      filteredRows = filteredRows.slice(0, limitCount);
    }

    const selectedColumns = parseSelectedColumns(selection);
    const selectedData = selectedColumns
      ? filteredRows.map((row) =>
          selectedColumns.reduce((result, column) => {
            result[column] = row[column];
            return result;
          }, {} as StoryRow)
        )
      : filteredRows;

    const count = options?.count === 'exact' ? filteredRows.length : null;
    const data = options?.head ? null : selectedData;
    return { data, error: null, count };
  };

  const query: any = {
    eq: (column: string, value: any) => {
      filters.push((row) => row[column] === value);
      return query;
    },
    not: (column: string, operator: string, value: any) => {
      if (operator === 'is' && value === null) {
        filters.push((row) => row[column] !== null && row[column] !== undefined);
      } else {
        filters.push((row) => row[column] !== value);
      }
      return query;
    },
    gte: (column: string, value: any) => {
      const comparableValue = normalizeComparableValue(value);
      filters.push((row) => normalizeComparableValue(row[column]) >= comparableValue);
      return query;
    },
    lte: (column: string, value: any) => {
      const comparableValue = normalizeComparableValue(value);
      filters.push((row) => normalizeComparableValue(row[column]) <= comparableValue);
      return query;
    },
    order: (column: string, sortOptions?: { ascending?: boolean }) => {
      orderBy = { column, ascending: sortOptions?.ascending ?? true };
      return query;
    },
    limit: (count: number) => {
      limitCount = count;
      return query;
    },
    maybeSingle: async () => {
      const result = await execute();
      const row = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
      return { data: row, error: null };
    },
    single: async () => {
      const result = await execute();
      const row = Array.isArray(result.data) ? result.data[0] ?? null : result.data;
      if (!row) {
        return { data: null, error: new Error('No rows returned') };
      }
      return { data: row, error: null };
    },
    then: (resolve: (value: any) => any, reject?: (reason: any) => any) => execute().then(resolve, reject),
  };

  return query;
};

const createStoryScopedDb = (dataSet: Record<DatasetName, StoryRow[]>) => ({
  from: (table: string) => {
    const dataset = table as DatasetName;
    return {
      select: (selection: string, options?: SelectOptions) => createSelectQuery(dataset, selection, options, dataSet),
      upsert: async (payload: StoryRow | StoryRow[]) => {
        if (dataset === 'dashboard_preferences') {
          const rows = Array.isArray(payload) ? payload : [payload];
          rows.forEach((row) => {
            const idx = dataSet.dashboard_preferences.findIndex((pref) => pref.user_id === row.user_id);
            if (idx >= 0) {
              dataSet.dashboard_preferences[idx] = { ...dataSet.dashboard_preferences[idx], ...row };
            } else {
              dataSet.dashboard_preferences.push(row);
            }
          });
        }
        return { data: payload, error: null };
      },
    };
  },
});

const createStorybookCRMContext = () => {
  const dataSet = createStoryDataset();
  return {
    user: { id: 'storybook-user-1' },
    context: {
      isPlatformAdmin: false,
      isTenantAdmin: true,
      isFranchiseAdmin: false,
      isUser: true,
      tenantId: 'tenant-story-1',
      franchiseId: 'franchise-story-1',
      adminOverrideEnabled: false,
      userId: 'storybook-user-1',
      _version: 1,
    },
    supabase: {},
    scopedDb: createStoryScopedDb(dataSet),
    preferences: {
      tenant_id: 'tenant-story-1',
      franchise_id: 'franchise-story-1',
      admin_override_enabled: false,
    },
    loadingPreferences: false,
    setScopePreference: async () => {},
    setAdminOverride: async () => {},
    setFranchisePreference: async () => {},
  };
};

const meta: Meta<typeof SalesRepDashboard> = {
  title: 'Dashboard/CRM/SalesRepDashboard',
  component: SalesRepDashboard,
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const useMockData = context.parameters?.useMockData === true;
      if (typeof window !== 'undefined') {
        if (useMockData) {
          (window as any).__STORYBOOK_CRM_MOCK__ = createStorybookCRMContext();
        } else {
          delete (window as any).__STORYBOOK_CRM_MOCK__;
        }
      }

      if (useMockData) {
        return (
          <BrowserRouter>
            <div className="p-6 bg-gray-50 min-h-screen">
              <Story />
            </div>
          </BrowserRouter>
        );
      }

      return (
        <BrowserRouter>
          <AuthProvider>
            <CRMProvider>
              <div className="p-6 bg-gray-50 min-h-screen">
                <Story />
              </div>
            </CRMProvider>
          </AuthProvider>
        </BrowserRouter>
      );
    },
  ],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {},
};

export const FullWidth: Story = {
  args: {},
  parameters: {
    layout: 'fullscreen',
  },
};

export const MockData: Story = {
  name: 'MockData',
  args: {},
  parameters: {
    useMockData: true,
    layout: 'fullscreen',
  },
};

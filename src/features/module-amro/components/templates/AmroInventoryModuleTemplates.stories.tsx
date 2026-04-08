import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { AlertTriangle, Plus, Search, SlidersHorizontal, Trash2, Upload } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AmroPartsInventoryWorkbench, type PartsInventoryViewState } from '../parts/AmroPartsInventoryWorkbench';
import { generatePartInventoryRecords, type PartInventoryRecord } from '../parts/mockPartsInventoryData';
import { usePartsCatalogState } from '../parts/usePartsCatalogState';
import type { PartsCatalogApi } from '../parts/partsInventoryContracts';
import type { GridDensity, GridScrollBehavior, GridViewMode } from './AmroInventoryDataGridTemplate';

type InventoryModuleStoryArgs = {
  state: PartsInventoryViewState;
  viewMode: GridViewMode;
  density: GridDensity;
  scrollBehavior: GridScrollBehavior;
  recordCount: number;
  includeExpired: boolean;
  pageSize: number;
};

const meta: Meta<InventoryModuleStoryArgs> = {
  title: 'AMRO/Inventory/Module Templates',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="bg-muted/20">
        <Story />
      </div>
    ),
  ],
  argTypes: {
    state: { control: 'inline-radio', options: ['ready', 'loading', 'empty', 'error'] },
    viewMode: { control: 'inline-radio', options: ['horizontal-split', 'vertical-split', 'stacked-auto'] },
    density: { control: 'inline-radio', options: ['compact', 'normal', 'comfortable'] },
    scrollBehavior: { control: 'inline-radio', options: ['virtualization', 'pagination', 'infinite-scroll'] },
    recordCount: { control: { type: 'number', min: 0, max: 3000, step: 50 } },
    includeExpired: { control: 'boolean' },
    pageSize: { control: { type: 'number', min: 10, max: 100, step: 5 } },
  },
};

export default meta;
type Story = StoryObj<InventoryModuleStoryArgs>;

function InventoryTemplateDemo(args: InventoryModuleStoryArgs) {
  const [search, setSearch] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'all' | PartInventoryRecord['status']>('all');
  const [createOpen, setCreateOpen] = React.useState(false);
  const [eventLog, setEventLog] = React.useState<string[]>([]);

  const appendLog = React.useCallback((message: string) => {
    setEventLog((previous) => [`${new Date().toLocaleTimeString()} · ${message}`, ...previous].slice(0, 10));
  }, []);

  const dataset = React.useMemo(
    () => generatePartInventoryRecords({ count: args.recordCount, includeExpired: args.includeExpired, seed: 231 }),
    [args.includeExpired, args.recordCount],
  );

  const filtered = React.useMemo(() => {
    const normalized = search.trim().toLowerCase();
    return dataset.filter((record) => {
      if (statusFilter !== 'all' && record.status !== statusFilter) return false;
      if (!normalized) return true;
      return (
        record.part_number.toLowerCase().includes(normalized)
        || record.description.toLowerCase().includes(normalized)
        || record.supplier_name.toLowerCase().includes(normalized)
        || record.warehouse_location.toLowerCase().includes(normalized)
      );
    });
  }, [dataset, search, statusFilter]);

  const resolvedState: PartsInventoryViewState = args.state === 'empty' ? 'empty' : args.state;
  const resolvedRecords = resolvedState === 'empty' ? [] : filtered;

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle>AMRO Inventory Module Template Evaluation Harness</CardTitle>
          <CardDescription>
            Use these templates to evaluate layout effectiveness, UX flow, visual consistency, and functional behavior before production build-out.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search part number, supplier, location..."
                  className="pl-8"
                  aria-label="Search inventory records"
                />
              </div>
              <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}>
                <SelectTrigger className="w-[180px]" aria-label="Filter status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="available">available</SelectItem>
                  <SelectItem value="reserved">reserved</SelectItem>
                  <SelectItem value="low_stock">low_stock</SelectItem>
                  <SelectItem value="quarantined">quarantined</SelectItem>
                  <SelectItem value="unserviceable">unserviceable</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={() => appendLog('Filter panel opened')}>
                <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                Advanced Filters
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" onClick={() => appendLog('Import inventory clicked')}>
                <Upload className="mr-1.5 h-4 w-4" />
                Import
              </Button>
              <Dialog open={createOpen} onOpenChange={setCreateOpen}>
                <DialogTrigger asChild>
                  <Button onClick={() => appendLog('Create part dialog opened')}>
                    <Plus className="mr-1.5 h-4 w-4" />
                    New Part
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[85vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle>Create Inventory Part</DialogTitle>
                    <DialogDescription>
                      Form input template with required/optional fields, validation-friendly labels, and responsive grouping.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="new-part-number">Part Number *</Label>
                      <Input id="new-part-number" placeholder="AMRO-PN-100999" aria-required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-serial">Serial Number</Label>
                      <Input id="new-serial" placeholder="SN-90000011" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-item-type">Item Type *</Label>
                      <Select>
                        <SelectTrigger id="new-item-type" aria-label="Select item type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="part">part</SelectItem>
                          <SelectItem value="consumable">consumable</SelectItem>
                          <SelectItem value="tool">tool</SelectItem>
                          <SelectItem value="equipment">equipment</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="new-status">Status *</Label>
                      <Select>
                        <SelectTrigger id="new-status" aria-label="Select status">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="available">available</SelectItem>
                          <SelectItem value="reserved">reserved</SelectItem>
                          <SelectItem value="low_stock">low_stock</SelectItem>
                          <SelectItem value="quarantined">quarantined</SelectItem>
                          <SelectItem value="unserviceable">unserviceable</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="new-notes">Description / Notes</Label>
                      <Textarea id="new-notes" rows={3} placeholder="Enter maintenance and handling details..." />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                    <Button onClick={() => {
                      appendLog('Create part submitted');
                      setCreateOpen(false);
                    }}>
                      Save Part
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" onClick={() => appendLog('Delete confirmation opened')}>
                    <Trash2 className="mr-1.5 h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Selected Inventory Records?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This modal template demonstrates confirmation behavior for destructive actions with explicit user intent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => appendLog('Delete confirmed')}>
                      Confirm Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline">Records: {resolvedRecords.length}</Badge>
            <Badge variant="outline">State: {resolvedState}</Badge>
            <Badge variant="outline">Responsive: {args.viewMode}</Badge>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="workspace" className="space-y-3">
        <TabsList className="grid w-full grid-cols-3 md:w-[540px]">
          <TabsTrigger value="workspace">Workspace</TabsTrigger>
          <TabsTrigger value="events">Event Trace</TabsTrigger>
          <TabsTrigger value="guidance">Usage Guidance</TabsTrigger>
        </TabsList>

        <TabsContent value="workspace" className="space-y-3">
          <AmroPartsInventoryWorkbench
            records={resolvedRecords}
            state={resolvedState}
            viewMode={args.viewMode}
            density={args.density}
            scrollBehavior={args.scrollBehavior}
            pageSize={args.pageSize}
            title="AMRO Inventory Workspace Template"
            subtitle="Integrated table, filters, form detail, actions, and panel controls."
            onRefresh={() => appendLog('Refresh clicked')}
            onCreatePart={() => {
              appendLog('Create action from workspace');
              setCreateOpen(true);
            }}
            onRetry={() => appendLog('Retry clicked')}
            onRecordSelectionChange={(event) => appendLog(`Selected ${event.recordId} via ${event.source}`)}
            onViewModeChange={(event) => appendLog(`View mode: ${event.requested} -> ${event.effective}`)}
            onScrollPositionChange={(event) => appendLog(`Scroll range ${event.firstVisibleIndex}-${event.lastVisibleIndex}`)}
          />
        </TabsContent>

        <TabsContent value="events">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Interaction and State Events</CardTitle>
              <CardDescription>
                Event trace helps evaluate end-to-end flow from search/filter/actions to grid/detail behavior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-xs text-muted-foreground">
                {eventLog.length ? eventLog.map((entry) => <li key={entry}>{entry}</li>) : <li>No events captured yet.</li>}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guidance">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Template Evaluation Guidance</AlertTitle>
            <AlertDescription>
              Validate responsive breakpoints, keyboard navigation, modal focus handling, grid/detail panel recovery, and loading/empty/error state clarity before promoting to production implementation.
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LargeCatalogLazyLoadDemo() {
  const [events, setEvents] = React.useState<string[]>([]);
  const append = React.useCallback((message: string) => {
    setEvents((previous) => [`${new Date().toLocaleTimeString()} · ${message}`, ...previous].slice(0, 8));
  }, []);

  const catalog = usePartsCatalogState({
    totalRecords: 10000,
    pageSize: 120,
    simulateLatencyMs: 40,
    seed: 97,
  });

  React.useEffect(() => {
    void catalog.refresh();
  }, [catalog]);

  const apiContractPreview: PartsCatalogApi = React.useMemo(() => ({
    listParts: async (query) => ({
      page: query.page,
      pageSize: query.pageSize,
      total: 10000,
      hasMore: query.page * query.pageSize < 10000,
      items: [],
      requestId: 'contract-preview-only',
    }),
  }), []);

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader>
          <CardTitle>Large Catalog and API Contract Readiness</CardTitle>
          <CardDescription>
            Demonstrates lazy page loading, efficient data handling for large catalogs, and integration-ready API contract typing.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">Loaded: {catalog.records.length}</Badge>
            <Badge variant="outline">Total: {catalog.total}</Badge>
            <Badge variant="outline">Page: {catalog.page}</Badge>
            <Badge variant="outline">Has More: {catalog.hasMore ? 'yes' : 'no'}</Badge>
            <Button size="sm" variant="outline" onClick={() => void catalog.refresh()}>
              Refresh
            </Button>
            <Button
              size="sm"
              onClick={() => {
                append('Load more clicked');
                void catalog.loadMore();
              }}
              disabled={!catalog.hasMore || catalog.loading}
            >
              Load More
            </Button>
          </div>
          <div className="rounded-md border bg-background p-3">
            <p className="font-semibold">API Contract Preview (`PartsCatalogApi`)</p>
            <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
{`type PartsCatalogApi = {
  listParts(query: {
    page: number; pageSize: number; search?: string;
    status?: 'all' | 'available' | 'reserved' | 'low_stock' | 'quarantined' | 'unserviceable';
    criticality?: 'all' | 'critical' | 'high' | 'normal' | 'low';
  }): Promise<{ items: PartInventoryRecord[]; total: number; hasMore: boolean; requestId?: string }>
}`}
            </pre>
          </div>
          <div className="rounded-md border p-3 text-xs text-muted-foreground">
            {events.length ? events.map((entry) => <p key={entry}>{entry}</p>) : <p>No load events captured yet.</p>}
          </div>
          <p className="hidden" aria-hidden>{Boolean(apiContractPreview)}</p>
        </CardContent>
      </Card>

      <AmroPartsInventoryWorkbench
        records={catalog.records}
        state={catalog.loading && !catalog.records.length ? 'loading' : catalog.error ? 'error' : catalog.records.length ? 'ready' : 'empty'}
        errorMessage={catalog.error?.message || 'Unable to load catalog'}
        viewMode="horizontal-split"
        density="compact"
        scrollBehavior="virtualization"
        pageSize={40}
        title="AMRO Parts Catalog (10,000 Scale Simulation)"
        subtitle="Lazy loading simulation with catalog-level contract pattern and performance-safe rendering."
        onRefresh={() => {
          append('Workspace refresh clicked');
          void catalog.refresh();
        }}
        onCreatePart={() => append('Create part clicked')}
      />
    </div>
  );
}

export const InventoryWorkspacePlayground: Story = {
  render: (args) => <InventoryTemplateDemo {...args} />,
  args: {
    state: 'ready',
    viewMode: 'horizontal-split',
    density: 'normal',
    scrollBehavior: 'virtualization',
    recordCount: 260,
    includeExpired: true,
    pageSize: 25,
  },
};

export const LoadingState: Story = {
  ...InventoryWorkspacePlayground,
  args: { ...InventoryWorkspacePlayground.args, state: 'loading' },
};

export const EmptyState: Story = {
  ...InventoryWorkspacePlayground,
  args: { ...InventoryWorkspacePlayground.args, state: 'empty', recordCount: 0 },
};

export const ErrorState: Story = {
  ...InventoryWorkspacePlayground,
  args: { ...InventoryWorkspacePlayground.args, state: 'error' },
};

export const ResponsiveTabletWorkflow: Story = {
  ...InventoryWorkspacePlayground,
  args: {
    ...InventoryWorkspacePlayground.args,
    viewMode: 'vertical-split',
    density: 'comfortable',
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet-amro',
      viewports: {
        'tablet-amro': {
          name: 'Tablet 1024x768',
          styles: { width: '1024px', height: '768px' },
          type: 'tablet',
        },
      },
    },
  },
};

export const ResponsiveMobileWorkflow: Story = {
  ...InventoryWorkspacePlayground,
  args: {
    ...InventoryWorkspacePlayground.args,
    viewMode: 'stacked-auto',
    scrollBehavior: 'infinite-scroll',
    density: 'compact',
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile-amro',
      viewports: {
        'mobile-amro': {
          name: 'Mobile 390x844',
          styles: { width: '390px', height: '844px' },
          type: 'mobile',
        },
      },
    },
  },
};

export const LargeCatalogLazyLoading: Story = {
  render: () => <LargeCatalogLazyLoadDemo />,
  parameters: {
    docs: {
      description: {
        story: 'Production-focused scenario for large parts catalogs. Demonstrates lazy loading, state transitions, and backend integration contract patterns with minimal cognitive overhead.',
      },
    },
  },
};

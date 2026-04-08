import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Bell, CheckCircle2, ClipboardCheck, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { AmroInventoryDataGridTemplate, type GridColumnDefinition } from './AmroInventoryDataGridTemplate';

type PrototypeRecord = {
  id: string;
  partNumber: string;
  status: 'available' | 'reserved' | 'low_stock' | 'quarantined';
  quantity: number;
  updatedAt: string;
};

const sampleData: PrototypeRecord[] = Array.from({ length: 140 }).map((_, idx) => ({
  id: `INV-${idx + 1}`,
  partNumber: `PN-${1000 + idx}`,
  status: idx % 9 === 0 ? 'quarantined' : idx % 4 === 0 ? 'low_stock' : idx % 3 === 0 ? 'reserved' : 'available',
  quantity: Math.max(0, 80 - (idx % 41)),
  updatedAt: new Date(2026, idx % 12, (idx % 28) + 1).toISOString(),
}));

const columns: GridColumnDefinition<PrototypeRecord>[] = [
  { key: 'id', header: 'ID', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 130 },
  { key: 'partNumber', header: 'Part Number', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 160 },
  { key: 'status', header: 'Status', sortable: true, filterable: true, groupable: true, resizable: true, dataType: 'text', width: 130 },
  { key: 'quantity', header: 'Qty', sortable: true, filterable: false, resizable: true, dataType: 'numeric', width: 100 },
  { key: 'updatedAt', header: 'Updated', sortable: true, filterable: false, resizable: true, dataType: 'date', width: 150 },
];

const meta: Meta = {
  title: 'AMRO/Module Layout v2.3/Comparative Prototypes',
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj;

function BaseGrid() {
  return (
    <AmroInventoryDataGridTemplate
      title="Module Layout v2.3 Prototype"
      subtitle="Grid + Record Detail baseline"
      records={sampleData}
      columns={columns}
      viewMode="horizontal-split"
      scrollBehavior="virtualization"
      density="normal"
      persistKey="v23-prototype-grid"
    />
  );
}

export const PrototypeA_EventStreamSidePanel: Story = {
  render: () => {
    const [events] = React.useState(
      Array.from({ length: 40 }).map((_, idx) => ({
        id: `evt-${idx + 1}`,
        type: idx % 3 === 0 ? 'inventory.updated' : idx % 2 === 0 ? 'reservation.changed' : 'checklist.recomputed',
        ts: new Date(Date.now() - idx * 35_000).toISOString(),
      })),
    );
    return (
      <div className="grid min-h-screen gap-4 p-4 lg:grid-cols-[1fr_340px]">
        <BaseGrid />
        <Card className="h-[min(80vh,760px)]">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Event Stream
            </CardTitle>
          </CardHeader>
          <CardContent className="h-full overflow-auto space-y-2">
            {events.map((event) => (
              <div key={event.id} className="rounded border p-2 text-xs">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">{event.type}</Badge>
                  <span className="text-muted-foreground">{new Date(event.ts).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    );
  },
};

export const PrototypeB_CRUDFabAndDrawer: Story = {
  render: () => {
    const [open, setOpen] = React.useState(false);
    return (
      <div className="relative min-h-screen p-4">
        <BaseGrid />
        <Button
          type="button"
          size="icon"
          className="fixed bottom-6 right-6 z-40 h-12 w-12 rounded-full shadow-lg"
          aria-label="Open CRUD event form"
          onClick={() => setOpen(true)}
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="right" className="w-[460px] sm:w-[520px]">
            <SheetHeader>
              <SheetTitle>CRUD Event Form</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-3 text-sm text-muted-foreground">
              <p>Prototype drawer surface for contextual create/update/delete workflows.</p>
              <p>Action payloads are validated before dispatch to Event Stream channel.</p>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    );
  },
};

export const PrototypeC_ViewportChecklistBanner: Story = {
  render: () => {
    const [checks] = React.useState([
      { id: 'c1', label: 'No horizontal scroll on 1366x768', pass: true },
      { id: 'c2', label: 'Sticky CRUD action bar visible', pass: true },
      { id: 'c3', label: 'Restore panel control visible', pass: true },
      { id: 'c4', label: 'Keyboard resize and restore shortcut', pass: true },
      { id: 'c5', label: 'ARIA labels present for icon controls', pass: true },
    ]);
    const pending = checks.filter((item) => !item.pass).length;
    return (
      <div className="min-h-screen p-4">
        <div className="sticky top-2 z-30 mb-3 rounded-md border bg-background/95 p-3 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ClipboardCheck className="h-4 w-4" />
              <span className="text-sm font-semibold">Viewport Validation Checklist</span>
              <Badge variant={pending ? 'destructive' : 'default'}>
                {pending ? `${pending} pending` : 'all passed'}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {checks.map((item) => (
                <span key={item.id} className="inline-flex items-center gap-1">
                  <CheckCircle2 className={`h-3.5 w-3.5 ${item.pass ? 'text-emerald-500' : 'text-amber-500'}`} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>
        <BaseGrid />
      </div>
    );
  },
};

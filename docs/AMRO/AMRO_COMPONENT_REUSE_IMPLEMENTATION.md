# AMRO Component Reuse Implementation Guide
## Maximizing Existing Code, Minimizing New Development

**Date:** March 26, 2026
**Purpose:** Concrete implementation patterns for leveraging logic-nexus-ai components in AMRO
**Audience:** Frontend engineers, component library maintainers

---

## 1. COMPONENT REUSE STRATEGY OVERVIEW

### Reuse Philosophy
```
Goal: 95% of AMRO UI should be composed from existing shadcn/ui + logic-nexus-ai components
Result: 8-10 new specialized components only (digital signature, offline sync, timer)
Benefit: 40% faster development, consistent UX, proven patterns
```

### Component Categorization

```
Tier 1: Shadcn/ui (Direct reuse, 0% modification)
├── Buttons, Inputs, Selects, DatePickers, Tables, Cards, Dialogs, Alerts, Badges
├── 150+ components available
└── Usage: Copy from docs, apply prop overrides

Tier 2: logic-nexus-ai Wrappers (Use as-is, 0-10% modification)
├── LocationAutocomplete, QuoteForm, TenantSelector, FranchiseSelector
├── 20+ complex components with business logic
└── Usage: Import + use directly; inherit multi-tenant context

Tier 3: AMRO-Specific (New, 5-15% reuse of patterns)
├── DigitalSignaturePad, OfflineSyncIndicator, WorkTimerWidget
├── ApplicabilityRuleEditor, ComplianceTimeline
└── Usage: Build using Tier 1/2 components + custom logic

Tier 4: Advanced (Phase 2+, 20-30% new code)
├── SchedulingCalendar, GanttChart, TechnicianCapacityPlanner
├── Requires specialized libraries (calendar, charting)
└── Usage: Select best-of-breed library; wrap with AMRO logic
```

---

## 2. TIER 1: SHADCN/UI DIRECT REUSE

### 2.1 Buttons - 100% Reuse

**Existing Usage (Quotation Module):**
```typescript
// src/features/module-quotation/components/QuoteForm.tsx
import { Button } from '@/components/ui/button';

export function QuoteForm() {
  return (
    <div className="flex gap-2">
      <Button variant="default" onClick={handleSave}>Save</Button>
      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </div>
  );
}
```

**AMRO Reuse Pattern - No Changes Needed:**
```typescript
// src/features/module-amro/components/WorkOrderActions.tsx
import { Button } from '@/components/ui/button';

export function WorkOrderActions({ workOrderId }) {
  return (
    <div className="flex gap-2">
      <Button variant="default" onClick={handleStart}>Start Work</Button>
      <Button variant="secondary" onClick={handleHold}>Put On Hold</Button>
      <Button variant="outline" onClick={handleCancel}>Cancel</Button>
      <Button variant="destructive" onClick={handleDelete}>Delete</Button>
    </div>
  );
}
```

**All Button Variants Available:**
- `variant="default"` - Primary action (blue)
- `variant="secondary"` - Secondary action (gray)
- `variant="outline"` - Tertiary action (border only)
- `variant="destructive"` - Dangerous action (red)
- `variant="ghost"` - Minimal action (transparent)
- `size="sm" | "md" | "lg"` - Size variants

**Cost:** 0 lines of code, 100% reuse ✓

---

### 2.2 Forms - 95% Reuse

**Existing Pattern (React Hook Form + shadcn/ui):**
```typescript
// src/features/module-quotation/components/QuotationForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const quotationSchema = z.object({
  quotationNumber: z.string().min(1),
  customerId: z.string().min(1),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected']),
});

export function QuotationForm() {
  const form = useForm({
    resolver: zodResolver(quotationSchema),
    defaultValues: { quotationNumber: '', customerId: '', status: 'draft' },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="quotationNumber"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Quotation Number</FormLabel>
              <FormControl>
                <Input {...field} placeholder="QUO-000001" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
      </form>
    </Form>
  );
}
```

**AMRO Reuse - Same Pattern:**
```typescript
// src/features/module-amro/components/WorkOrderForm.tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const workOrderSchema = z.object({
  aircraftId: z.string().min(1),
  checkType: z.enum(['A_CHECK', 'C_CHECK', 'ANNUAL']),
  plannedStartDate: z.date(),
});

export function WorkOrderForm() {
  const form = useForm({
    resolver: zodResolver(workOrderSchema),
    defaultValues: { aircraftId: '', checkType: 'A_CHECK', plannedStartDate: new Date() },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <FormField
          control={form.control}
          name="aircraftId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Aircraft</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select aircraft" />
                  </SelectTrigger>
                  <SelectContent>
                    {aircraftList.map(a => (
                      <SelectItem key={a.id} value={a.id}>{a.tailNumber}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* More fields... */}
      </form>
    </Form>
  );
}
```

**Cost:** 100-200 lines of code (form-specific logic only; form infrastructure = 0 cost) ✓

---

### 2.3 Tables - 98% Reuse

**Existing Pattern (TanStack React Table):**
```typescript
// src/features/module-quotation/components/QuotationListTable.tsx
import { useReactTable, getCoreRowModel, getPaginationRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';

export function QuotationListTable({ quotations }) {
  const columns = [
    {
      accessorKey: 'quotationNumber',
      header: 'Quote #',
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.status === 'sent' ? 'secondary' : 'default'}>
          {row.original.status}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button size="sm" onClick={() => navigate(`/quotations/${row.original.id}`)}>
          View
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: quotations,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <DataTable table={table} />;
}
```

**AMRO Reuse - Same Structure:**
```typescript
// src/features/module-amro/components/AircraftListTable.tsx
import { useReactTable, getCoreRowModel, getPaginationRowModel } from '@tanstack/react-table';
import { DataTable } from '@/components/ui/data-table';
import { Badge } from '@/components/ui/badge';

export function AircraftListTable({ aircraft }) {
  const columns = [
    {
      accessorKey: 'tailNumber',
      header: 'Tail #',
    },
    {
      accessorKey: 'model',
      header: 'Model',
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => {
        const color = row.original.status === 'active' ? 'default'
                    : row.original.status === 'maintenance' ? 'warning'
                    : 'secondary';
        return <Badge variant={color}>{row.original.status}</Badge>;
      },
    },
    {
      accessorKey: 'nextDueHours',
      header: 'Next Due (Hrs)',
      cell: ({ row }) => {
        const remaining = row.original.nextDueHours - row.original.currentFlightHours;
        const color = remaining < 50 ? 'destructive' : remaining < 200 ? 'warning' : 'default';
        return <Badge variant={color}>{remaining}h</Badge>;
      },
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button size="sm" onClick={() => navigate(`/amro/aircraft/${row.original.id}`)}>
          View Details
        </Button>
      ),
    },
  ];

  const table = useReactTable({
    data: aircraft,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return <DataTable table={table} />;
}
```

**Cost:** 150-200 lines of code (column definitions only; table rendering = 0 cost) ✓

---

### 2.4 Dialogs - 100% Reuse

**Existing Pattern:**
```typescript
// Dialog for confirming quotation deletion
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function DeleteQuotationDialog({ isOpen, onConfirm, onCancel }) {
  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Quotation?</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**AMRO Reuse - Identical Pattern:**
```typescript
// Dialog for confirming work package sign-off
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

export function ConfirmSignOffDialog({ isOpen, workOrderId, onConfirm, onCancel }) {
  return (
    <Dialog open={isOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sign Off Work Package?</DialogTitle>
          <DialogDescription>All tasks must be marked complete before signing off.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={onConfirm}>Sign Off</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

**Cost:** 0 lines of overhead (100% reuse of Dialog components) ✓

---

### 2.5 Tabs - 95% Reuse

**AMRO Example - Task Details Tabs:**
```typescript
// src/features/module-amro/components/MaintenanceTaskDetailTabs.tsx
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export function MaintenanceTaskDetailTabs({ task }) {
  return (
    <Tabs defaultValue="overview">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="intervals">Intervals</TabsTrigger>
        <TabsTrigger value="applicability">Applicability</TabsTrigger>
        <TabsTrigger value="history">Version History</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <Card>
          <CardHeader>
            <CardTitle>{task.taskCode}</CardTitle>
            <CardDescription>{task.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div><span className="font-medium">ATA Code:</span> {task.ataCode}</div>
              <div><span className="font-medium">Est. Man Hours:</span> {task.estManHours}</div>
              <div><span className="font-medium">Skill Type:</span> {task.skillType}</div>
              <div><span className="font-medium">Source:</span> {task.sourceRef}</div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="intervals">
        {/* Task intervals table */}
      </TabsContent>

      <TabsContent value="applicability">
        {/* Applicability rules JSON viewer */}
      </TabsContent>

      <TabsContent value="history">
        {/* Version history timeline */}
      </TabsContent>
    </Tabs>
  );
}
```

**Cost:** 200-300 lines of code (content per tab; tab structure = 0 cost) ✓

---

## 3. TIER 2: LOGIC-NEXUS-AI WRAPPER REUSE

### 3.1 LocationAutocomplete - Adapt Pattern

**Original (CRM Module):**
```typescript
// src/components/common/LocationAutocomplete.tsx - Existing
export interface LocationAutocompleteProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  className?: string;
}

export function LocationAutocomplete({ value, onChange, disabled, error, className }: LocationAutocompleteProps) {
  const [search, setSearch] = useState(value || '');
  const [results, setResults] = useState<LocationOption[]>([]);
  const { tenantId } = useCRM();

  const handleSearch = useCallback(debounce(async (query: string) => {
    if (query.length < 2) return;
    const res = await LocationService.search(query, tenantId);
    setResults(res);
  }, 300), [tenantId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); handleSearch(e.target.value); }}
          disabled={disabled}
          className={error ? 'border-red-500' : ''}
        />
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandList>
            {results.map(loc => (
              <CommandItem key={loc.id} onSelect={() => { onChange?.(loc.id); setSearch(loc.name); }}>
                {loc.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**AMRO Adaptation - AircraftSelect:**
```typescript
// src/features/module-amro/components/AircraftSelect.tsx - NEW (reuses LocationAutocomplete pattern)
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Command, CommandList, CommandItem, CommandInput } from '@/components/cmdk';
import { Input } from '@/components/ui/input';
import { useCallback } from 'react';
import { debounce } from '@/lib/utils';
import { useCRM } from '@/hooks/useCRM';

export interface AircraftSelectProps {
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  error?: string;
  filter?: { franchiseId?: string };  // AMRO-specific: filter by franchise
}

export function AircraftSelect({ value, onChange, disabled, error, filter }: AircraftSelectProps) {
  const [search, setSearch] = useState(value || '');
  const [results, setResults] = useState<AircraftOption[]>([]);
  const { tenantId, franchiseId: defaultFranchiseId } = useCRM();
  const effectiveFranchiseId = filter?.franchiseId || defaultFranchiseId;

  const handleSearch = useCallback(debounce(async (query: string) => {
    if (query.length < 1) return;
    const res = await AircraftService.search(
      query,
      tenantId,
      effectiveFranchiseId
    );
    setResults(res);
  }, 300), [tenantId, effectiveFranchiseId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); handleSearch(e.target.value); }}
          placeholder="Search aircraft by tail number..."
          disabled={disabled}
          className={error ? 'border-red-500' : ''}
        />
      </PopoverTrigger>
      <PopoverContent>
        <Command>
          <CommandInput value={search} onValueChange={setSearch} />
          <CommandList>
            {results.map(aircraft => (
              <CommandItem
                key={aircraft.id}
                value={aircraft.tailNumber}
                onSelect={() => { onChange?.(aircraft.id); setSearch(aircraft.tailNumber); }}
              >
                <div className="flex flex-col">
                  <span className="font-medium">{aircraft.tailNumber}</span>
                  <span className="text-xs text-gray-500">{aircraft.model}</span>
                </div>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
```

**Reuse Analysis:**
- 90% of structure reuses LocationAutocomplete pattern
- 10% custom: aircraft-specific fields, franchise filtering
- **Cost:** 200 lines (vs. 500 if built from scratch) = 60% savings ✓

---

### 3.2 Data Access Hook - Extend useCRM()

**Existing (all modules):**
```typescript
// src/hooks/useCRM.tsx
export interface DataAccessContext {
  tenantId: string | null;
  franchiseId: string | null;
  userId: string;
  isPlatformAdmin: boolean;
  isTenantAdmin: boolean;
  isFranchiseAdmin: boolean;
}

export function useCRM(): DataAccessContext {
  const { user } = useAuth();
  const [context, setContext] = useState<DataAccessContext>(null);

  useEffect(() => {
    // Resolve user roles, permissions, effective scope
    loadUserContext(user?.id).then(setContext);
  }, [user?.id]);

  return context;
}
```

**AMRO Reuse - 100%:**
```typescript
// src/features/module-amro/hooks/useAmroScope.ts
import { useCRM } from '@/hooks/useCRM';

export function useAmroScope() {
  const { tenantId, franchiseId } = useCRM();
  // Reuse existing context directly
  return { tenantId, franchiseId };
}

// Usage in any AMRO component
export function AircraftList() {
  const { tenantId, franchiseId } = useAmroScope();
  const { data: aircraft } = useQuery({
    queryKey: ['aircraft', tenantId, franchiseId],
    queryFn: () => AircraftService.list(tenantId, franchiseId),
  });
  return <AircraftListTable aircraft={aircraft} />;
}
```

**Cost:** 0 new code; 100% reuse of existing context ✓

---

## 4. TIER 3: NEW AMRO-SPECIFIC COMPONENTS (5 components)

### 4.1 Digital Signature Pad (Highest Priority)

**Why New?** Specialized UI + legal requirements; no equivalent in existing system

**Implementation:**
```typescript
// src/components/amro/DigitalSignaturePad.tsx
import { useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

interface SignatureMethod {
  type: 'pin' | 'touchpad' | 'certificate';
  value: string;  // PIN, signature data, cert thumbprint
  timestamp: Date;
  userId: string;
}

interface DigitalSignaturePadProps {
  isOpen: boolean;
  title: string;
  onSign: (signature: SignatureMethod) => void;
  onCancel: () => void;
  method?: 'pin' | 'touchpad' | 'certificate';  // Default: PIN
}

export function DigitalSignaturePad({
  isOpen,
  title,
  onSign,
  onCancel,
  method = 'pin',
}: DigitalSignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pin, setPin] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);
  const [error, setError] = useState('');

  // PIN Method
  if (method === 'pin') {
    return (
      <Dialog open={isOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Enter PIN</label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full border rounded px-3 py-2 text-center text-2xl tracking-widest"
                maxLength={4}
                placeholder="••••"
              />
              {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={() => {
                if (pin.length !== 4) {
                  setError('PIN must be 4 digits');
                  return;
                }
                onSign({
                  type: 'pin',
                  value: pin,
                  timestamp: new Date(),
                  userId: currentUserId,
                });
              }}
            >
              Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Touchpad Method (Canvas-based drawing)
  if (method === 'touchpad') {
    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
      setIsDrawing(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = e.clientX - rect!.left;
      const y = e.clientY - rect!.top;
      canvasRef.current?.getContext('2d')?.beginPath();
      canvasRef.current?.getContext('2d')?.moveTo(x, y);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!isDrawing) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      const x = e.clientX - rect!.left;
      const y = e.clientY - rect!.top;
      const ctx = canvasRef.current?.getContext('2d');
      ctx?.lineTo(x, y);
      ctx?.stroke();
    };

    return (
      <Dialog open={isOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-600">Sign in the box below</p>
            <canvas
              ref={canvasRef}
              width={300}
              height={150}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={() => setIsDrawing(false)}
              onMouseLeave={() => setIsDrawing(false)}
              className="border-2 border-gray-300 rounded bg-white cursor-crosshair"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                const canvas = canvasRef.current;
                canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
                setPin('');
              }}
            >
              Clear
            </Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button
              onClick={() => {
                const imageData = canvasRef.current?.toDataURL('image/png');
                onSign({
                  type: 'touchpad',
                  value: imageData!,
                  timestamp: new Date(),
                  userId: currentUserId,
                });
              }}
            >
              Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return null;
}
```

**Usage:**
```typescript
// In WorkOrderSignOffFlow
const [showSignature, setShowSignature] = useState(false);

return (
  <>
    <Button onClick={() => setShowSignature(true)}>Sign & Complete</Button>
    <DigitalSignaturePad
      isOpen={showSignature}
      title="Sign Off Work Package WP-2026-001"
      method="pin"  // or "touchpad"
      onSign={async (signature) => {
        await WorkOrderService.signOff(workOrderId, signature);
        setShowSignature(false);
      }}
      onCancel={() => setShowSignature(false)}
    />
  </>
);
```

**Cost:** 350 lines of code, 5-6 PD ✓

---

### 4.2 Offline Sync Indicator (Tier 3)

**Why New?** Service worker status visualization; AMRO-specific

**Implementation:**
```typescript
// src/components/amro/OfflineSyncIndicator.tsx
import { useEffect, useState } from 'react';
import { WifiOff, WifiX, WifiCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SyncStatus {
  online: boolean;
  syncing: boolean;
  pendingChanges: number;
  lastSyncTime: Date | null;
  error?: string;
}

export function OfflineSyncIndicator() {
  const [status, setStatus] = useState<SyncStatus>({
    online: navigator.onLine,
    syncing: false,
    pendingChanges: 0,
    lastSyncTime: null,
  });

  useEffect(() => {
    // Listen to online/offline events
    const handleOnline = () => setStatus(s => ({ ...s, online: true }));
    const handleOffline = () => setStatus(s => ({ ...s, online: false }));

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check service worker sync status
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(reg => {
        reg.sync?.addEventListener('sync', (event) => {
          setStatus(s => ({ ...s, syncing: true }));
        });
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (status.online && !status.syncing) {
    return (
      <Badge variant="default" className="flex items-center gap-1">
        <WifiCheck className="h-3 w-3" />
        Online
      </Badge>
    );
  }

  if (!status.online) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <WifiOff className="h-3 w-3" />
        Offline
        {status.pendingChanges > 0 && ` (${status.pendingChanges} pending)`}
      </Badge>
    );
  }

  if (status.syncing) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Syncing...
      </Badge>
    );
  }

  return null;
}
```

**Usage:**
```typescript
// In AMRO app header/layout
export function AmroLayout() {
  return (
    <header className="flex justify-between items-center p-4">
      <h1>AMRO Dashboard</h1>
      <OfflineSyncIndicator />
    </header>
  );
}
```

**Cost:** 150 lines of code, 2-3 PD ✓

---

### 4.3 Work Timer Widget (Tier 3)

**Why New?** Time tracking during task execution; specific to maintenance operations

**Implementation:**
```typescript
// src/components/amro/WorkTimerWidget.tsx
import { useEffect, useState } from 'react';
import { Play, Pause, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface WorkTimerProps {
  taskId: string;
  onTimeUpdate?: (hours: number) => void;
  initialHours?: number;  // From localStorage or DB
  disabled?: boolean;
}

export function WorkTimerWidget({
  taskId,
  onTimeUpdate,
  initialHours = 0,
  disabled = false,
}: WorkTimerProps) {
  const [totalSeconds, setTotalSeconds] = useState(initialHours * 3600);
  const [isRunning, setIsRunning] = useState(false);

  // Auto-save every 10 seconds
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTotalSeconds(prev => {
        const newValue = prev + 1;
        localStorage.setItem(`work-timer-${taskId}`, newValue.toString());
        onTimeUpdate?.(newValue / 3600);
        return newValue;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, taskId, onTimeUpdate]);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="text-center space-y-4">
          <div className="text-4xl font-mono font-bold">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </div>
          <div className="flex gap-2 justify-center">
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => setIsRunning(!isRunning)}
            >
              {isRunning ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => {
                setTotalSeconds(0);
                localStorage.removeItem(`work-timer-${taskId}`);
              }}
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm text-gray-600">
            {hours > 0 && `${hours}h `}
            {minutes > 0 && `${minutes}m `}
            elapsed
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

**Cost:** 200 lines of code, 2-3 PD ✓

---

## 5. TIER 4: ADVANCED COMPONENTS (Phase 2+)

### 5.1 Scheduling Calendar

**Requires:** New specialized library (React Big Calendar or similar)

**Pattern:**
```typescript
// src/components/amro/SchedulingCalendar.tsx
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import enUS from 'date-fns/locale/en-US';

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface SchedulingCalendarProps {
  workOrders: WorkOrder[];
  onSelectDateRange?: (startDate: Date, endDate: Date) => void;
  onSelectWorkOrder?: (workOrderId: string) => void;
}

export function SchedulingCalendar({
  workOrders,
  onSelectDateRange,
  onSelectWorkOrder,
}: SchedulingCalendarProps) {
  const [view, setView] = useState<View>('month');
  const events = workOrders.map(wp => ({
    id: wp.id,
    title: `${wp.wpNumber} - ${wp.checkType}`,
    start: wp.plannedStartDate,
    end: wp.estimatedCompletionDate,
    resource: wp,
  }));

  return (
    <Calendar
      localizer={localizer}
      events={events}
      startAccessor="start"
      endAccessor="end"
      view={view}
      onView={setView}
      style={{ height: 600 }}
      onSelectEvent={(event) => onSelectWorkOrder?.(event.id)}
      onSelectSlot={(slotInfo) =>
        onSelectDateRange?.(slotInfo.start, slotInfo.end)
      }
      selectable
    />
  );
}
```

**Cost:** 150 lines + library (React Big Calendar ~50KB gzipped), 4-5 PD

---

### 5.2 Gantt Chart (Advanced)

**Requires:** Specialized charting library (Recharts extension or Visx)

**Pattern:**
```typescript
// src/components/amro/GanttChart.tsx
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface GanttData {
  taskName: string;
  startDay: number;
  duration: number;
  technician: string;
}

export function GanttChart({ workOrder }: { workOrder: WorkOrder }) {
  const data: GanttData[] = workOrder.tasks.map(task => ({
    taskName: task.description,
    startDay: calculateDayOffset(task.startDate),
    duration: calculateDuration(task.completedDate, task.startDate),
    technician: task.assignedTechnician?.name || 'Unassigned',
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} layout="vertical">
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" label={{ value: 'Days', position: 'right' }} />
        <YAxis type="category" dataKey="taskName" width={150} />
        <Tooltip />
        <Legend />
        <Bar dataKey="duration" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

**Cost:** 200 lines + Recharts (already included), 5-6 PD

---

## 6. COMPONENT DEVELOPMENT CHECKLIST

### Before Building New Component

- [ ] Check if shadcn/ui already has equivalent
- [ ] Check if logic-nexus-ai has similar pattern to reuse
- [ ] Can existing components be composed to achieve goal?
- [ ] Does component need styling only (use existing + TailwindCSS)?
- [ ] Is it domain-specific business logic (build new)?
- [ ] Have we established Storybook stories for it?
- [ ] Have we written unit tests?
- [ ] Is it documented in docs/AMRO_COMPONENT_REUSE_IMPLEMENTATION.md?

### Component Template (for new Tier 3 components)

```typescript
// src/components/amro/NewComponent.tsx

import { useCallback, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useCRM } from '@/hooks/useCRM';

export interface NewComponentProps {
  prop1: string;
  prop2?: boolean;
  onAction?: (value: any) => void;
  className?: string;
}

/**
 * Description of what this component does
 *
 * @example
 * <NewComponent prop1="value" onAction={handleAction} />
 */
export function NewComponent({
  prop1,
  prop2 = false,
  onAction,
  className,
}: NewComponentProps) {
  const { tenantId, franchiseId } = useCRM();
  const [state, setState] = useState('');

  const handleClick = useCallback(() => {
    // Business logic
    onAction?.(state);
  }, [state, onAction]);

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Title</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Component content */}
        <Button onClick={handleClick}>Action</Button>
      </CardContent>
    </Card>
  );
}
```

---

## 7. TESTING REUSED COMPONENTS

### Copy-Paste Test Pattern

```typescript
// src/features/module-amro/components/__tests__/AircraftListTable.test.tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AircraftListTable } from '../AircraftListTable';

const mockAircraft = [
  { id: '1', tailNumber: 'N123AB', model: 'PC-12', status: 'active', nextDueHours: 150 },
  { id: '2', tailNumber: 'N456CD', model: 'PC-24', status: 'maintenance', nextDueHours: 50 },
];

describe('AircraftListTable', () => {
  it('should render aircraft list', () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <AircraftListTable aircraft={mockAircraft} />
      </QueryClientProvider>
    );

    expect(screen.getByText('N123AB')).toBeInTheDocument();
    expect(screen.getByText('PC-24')).toBeInTheDocument();
  });

  it('should show correct next due status', () => {
    // Test color coding for next due indicator
  });
});
```

---

## SUMMARY: REUSE METRICS

| Tier | Component Count | New Code % | Reuse % | Effort (PD) | Risk |
|---|---|---|---|---|---|
| **Tier 1** (Shadcn/ui) | 50+ | 0% | 100% | 0 | ✓ None |
| **Tier 2** (logic-nexus-ai wrappers) | 20 | 5% | 95% | 5 | ✓ Low |
| **Tier 3** (New AMRO-specific) | 5 | 100% | 0% | 15 | ✓ Low |
| **Tier 4** (Advanced, Phase 2+) | 4 | 80% | 20% | 20 | ~ Medium |
| **Total** | 79 | ~20% | ~80% | 40 | - |

**Result:** 80% reuse rate = 40% faster development ✓

---

**Document Version:** 1.0
**Last Updated:** March 26, 2026
**Status:** Ready for Component Development
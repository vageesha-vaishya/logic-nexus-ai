/**
 * AMRO Design System Showcase
 * 
 * Interactive demo of all AMRO UI patterns based on Parts Inventory module.
 * Use this for training, stakeholder presentations, and UX reviews.
 * 
 * Patterns Demonstrated:
 * 1. AmroModuleSurface (with all status variants)
 * 2. AmroKpiGrid (with semantic tones)
 * 3. AmroStandardToolbar (with responsive variants)
 * 4. Data Grid (with column management)
 * 5. Record Detail (desktop split + mobile stack)
 * 6. Navigation Shell (quick access, breadcrumbs)
 * 7. Responsive Breakpoints
 * 8. Accessibility Features
 */

import { useState, useMemo } from 'react';
import {
  Boxes, TrendingUp, AlertTriangle, CheckCircle2, Package,
  Search, Filter, SlidersHorizontal, Plus, MoreHorizontal,
  ChevronDown, LayoutGrid, Columns3, Eye, EyeOff,
  LayoutDashboard, ArrowRight, ArrowLeft, Info,
  Monitor, Smartphone, Tablet
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

// ── Mock Data ──────────────────────────────────────────────────────────────────

const MOCK_KPI_ITEMS = [
  { label: 'Total Items', value: '1,234', tone: 'default' as const },
  { label: 'Low Stock', value: '42', tone: 'warning' as const },
  { label: 'Critical Alerts', value: '7', tone: 'critical' as const },
  { label: 'Reserved', value: '156', tone: 'default' as const },
  { label: 'Inventory Value', value: '$2.4M', tone: 'success' as const },
  { label: 'On-Time Delivery', value: '94%', tone: 'success' as const },
];

const MOCK_TABLE_DATA = [
  { id: '1', part_number: 'PN-001-A320', description: 'Hydraulic Pump Assembly', item_type: 'part', status: 'available', quantity: 12, location: 'WH-A1' },
  { id: '2', part_number: 'PN-002-B737', description: 'Landing Gear Actuator', item_type: 'part', status: 'low_stock', quantity: 2, location: 'WH-B3' },
  { id: '3', part_number: 'PN-003-A320', description: 'Fuel Filter Element', item_type: 'consumable', status: 'available', quantity: 45, location: 'WH-A2' },
  { id: '4', part_number: 'PN-004-B787', description: 'APU Starter Motor', item_type: 'part', status: 'reserved', quantity: 8, location: 'WH-C1' },
  { id: '5', part_number: 'PN-005-A350', description: 'Oxygen Generator', item_type: 'equipment', status: 'quarantined', quantity: 3, location: 'WH-D1' },
];

const QUICK_ACCESS_MODULES = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'reservations', label: 'Reservations' },
  { id: 'reorder', label: 'Reorder' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'settings', label: 'Settings' },
];

const BREAKPOINTS = [
  { name: 'Mobile', width: '<768px', icon: Smartphone, color: 'text-blue-500' },
  { name: 'Tablet', width: '768-1024px', icon: Tablet, color: 'text-purple-500' },
  { name: 'Desktop', width: '≥1024px', icon: Monitor, color: 'text-green-500' },
];

// ── Sub-Components ─────────────────────────────────────────────────────────────

function ModuleSurfaceShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">AmroModuleSurface Variants</h3>
      
      {/* Ready State */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-semibold leading-tight">Ready State</h2>
              <p className="text-xs leading-snug text-muted-foreground">Module loaded successfully with all data</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase">operations.ready</Badge>
              <Badge variant="default" className="text-xs uppercase">ready</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">This is the standard module surface for operational modules.</p>
        </CardContent>
      </Card>

      {/* Loading State */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-semibold leading-tight">Loading State</h2>
              <p className="text-xs leading-snug text-muted-foreground">Data is being fetched from API</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase">operations.loading</Badge>
              <Badge variant="secondary" className="text-xs uppercase">loading</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-xs text-muted-foreground">Loading data...</span>
          </div>
        </CardContent>
      </Card>

      {/* Warning State */}
      <Card className="border-slate-300 shadow-sm">
        <CardHeader className="space-y-2 pb-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <h2 className="text-base font-semibold leading-tight">Warning State</h2>
              <p className="text-xs leading-snug text-muted-foreground">Partial data or degraded performance</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs uppercase">operations.warning</Badge>
              <Badge variant="destructive" className="text-xs uppercase">warning</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs">Some features may be unavailable</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpiGridShowcase() {
  const getKpiStyles = (tone: string) => {
    switch (tone) {
      case 'critical':
        return { card: 'bg-red-50 border-red-200', label: 'text-red-600', text: 'text-red-700' };
      case 'warning':
        return { card: 'bg-amber-50 border-amber-200', label: 'text-amber-600', text: 'text-amber-700' };
      case 'success':
        return { card: 'bg-green-50 border-green-200', label: 'text-green-600', text: 'text-green-700' };
      default:
        return { card: 'bg-card border-border', label: 'text-muted-foreground', text: 'text-foreground' };
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">AmroKpiGrid with Semantic Tones</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        {MOCK_KPI_ITEMS.map((item) => {
          const styles = getKpiStyles(item.tone);
          return (
            <div
              key={item.label}
              className={cn(
                'rounded-md border px-3 py-2 text-sm',
                styles.card
              )}
            >
              <p className={cn('text-xs leading-snug', styles.label)}>{item.label}</p>
              <p className={cn('font-semibold', styles.text)}>{item.value}</p>
            </div>
          );
        })}
      </div>

      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground">Tone Legend</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <span>Success/Healthy</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-amber-500" />
            <span>Warning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <span>Critical</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-slate-500" />
            <span>Default/Neutral</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ToolbarShowcase() {
  const [searchValue, setSearchValue] = useState('');

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">AmroStandardToolbar</h3>
      
      {/* Standard Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/20 p-2">
        <div className="flex min-w-[260px] flex-1 items-center gap-2">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder="Search..."
              className="pl-8"
            />
          </div>
          <Button type="button" variant="outline" size="sm" className="h-8 min-h-[44px] md:h-8">
            <Filter className="mr-1 h-3.5 w-3.5" />
            Filter
          </Button>
          <Button type="button" variant="outline" size="sm" className="h-8 min-h-[44px] md:h-8">
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
            View
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm">
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Item
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem>Export</DropdownMenuItem>
              <DropdownMenuItem>Settings</DropdownMenuItem>
              <DropdownMenuItem>Help</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Standards:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Background: bg-muted/20</li>
          <li>Border: rounded-md border</li>
          <li>Touch Targets: min-h-[44px] on mobile, h-8 on desktop</li>
          <li>Search Icon: Absolute positioned left-2.5</li>
          <li>Responsive: Stacked on mobile, inline on desktop</li>
        </ul>
      </div>
    </div>
  );
}

function DataGridShowcase() {
  const [showExtended, setShowExtended] = useState(false);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Data Grid with Column Management</h3>
      
      {/* Column Visibility Toggle */}
      <div className="flex items-center gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowExtended(!showExtended)}
        >
          {showExtended ? <EyeOff className="w-3.5 h-3.5 mr-1" /> : <Eye className="w-3.5 h-3.5 mr-1" />}
          {showExtended ? 'Hide Extended' : 'Show Extended'} Columns
        </Button>
        <Badge variant="secondary" className="text-xs">
          {showExtended ? '14' : '10'} columns visible
        </Badge>
      </div>

      {/* Data Table */}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Part Number</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Description</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Type</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Qty</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Location</TableHead>
              {showExtended && (
                <>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Serial</TableHead>
                  <TableHead className="text-xs font-semibold uppercase tracking-wide">Cost</TableHead>
                </>
              )}
              <TableHead className="text-xs font-semibold uppercase tracking-wide">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MOCK_TABLE_DATA.map((row) => (
              <TableRow key={row.id} className="hover:bg-muted/50">
                <TableCell className="font-mono text-sm">{row.part_number}</TableCell>
                <TableCell className="text-sm">{row.description}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">{row.item_type}</Badge>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      row.status === 'available' ? 'default' :
                      row.status === 'low_stock' ? 'secondary' :
                      row.status === 'reserved' ? 'outline' :
                      'destructive'
                    }
                    className="text-xs"
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-medium">{row.quantity}</TableCell>
                <TableCell className="text-sm">{row.location}</TableCell>
                {showExtended && (
                  <>
                    <TableCell className="text-sm font-mono">SN-{row.id.padStart(4, '0')}</TableCell>
                    <TableCell className="text-sm">${(Math.random() * 1000 + 100).toFixed(2)}</TableCell>
                  </>
                )}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>Edit</DropdownMenuItem>
                      <DropdownMenuItem>Clone</DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Column Tiers:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>Core (P0):</strong> Always visible - Part Number, Description, Type, Status, Qty, Location</li>
          <li><strong>Extended (P2-P3):</strong> Hidden by default - Serial, Cost, Tags, History</li>
          <li><strong>Nielsen Norman Group:</strong> Max 10 columns for optimal scanability</li>
        </ul>
      </div>
    </div>
  );
}

function NavigationShowcase() {
  const [activeModule, setActiveModule] = useState('overview');

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">AmroPartsNavigationShell</h3>
      
      {/* Navigation Shell */}
      <Card className="border-slate-300">
        <CardContent className="space-y-3 p-3">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <LayoutDashboard className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold">AMRO Parts Navigation</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>AMRO</span>
                <span>/</span>
                <span>Parts Inventory</span>
                <span>/</span>
                <span className="font-medium text-foreground">{QUICK_ACCESS_MODULES.find(m => m.id === activeModule)?.label}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs">Nav Response 45ms</Badge>
              <Badge variant="outline" className="text-xs">maint_manager</Badge>
            </div>
          </div>

          {/* Quick Access Bar */}
          <div className="flex items-center gap-2">
            <ScrollArea className="w-full">
              <div className="flex min-w-max items-center gap-2">
                {QUICK_ACCESS_MODULES.map((module) => {
                  const active = module.id === activeModule;
                  return (
                    <Button
                      key={module.id}
                      type="button"
                      variant={active ? 'default' : 'outline'}
                      size="sm"
                      className="h-11 min-h-[44px] text-xs md:h-9"
                      onClick={() => setActiveModule(module.id)}
                      aria-current={active ? 'page' : undefined}
                    >
                      {module.label}
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      {/* Module Content Placeholder */}
      <Card className="border-slate-300 bg-muted/20">
        <CardContent className="p-8 text-center">
          <p className="text-sm font-medium mb-1">Module Content: {QUICK_ACCESS_MODULES.find(m => m.id === activeModule)?.label}</p>
          <p className="text-xs text-muted-foreground">This area renders the active module's content</p>
        </CardContent>
      </Card>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Navigation Features:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Breadcrumbs for hierarchical navigation</li>
          <li>Quick access bar for module switching</li>
          <li>Role-based module visibility</li>
          <li>Performance metrics (nav response time)</li>
          <li>Mobile: Sheet drawer for module selection</li>
        </ul>
      </div>
    </div>
  );
}

function ResponsiveShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Responsive Breakpoints</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {BREAKPOINTS.map((bp) => {
          const Icon = bp.icon;
          return (
            <Card key={bp.name} className="border-slate-300">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-5 h-5', bp.color)} />
                  <CardTitle className="text-sm">{bp.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">{bp.width}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={cn(
                  'rounded border-2 border-dashed p-4 flex items-center justify-center',
                  bp.name === 'Mobile' && 'border-blue-500/50',
                  bp.name === 'Tablet' && 'border-purple-500/50',
                  bp.name === 'Desktop' && 'border-green-500/50'
                )}>
                  <div className="text-center">
                    <Icon className={cn('w-8 h-8 mx-auto mb-2', bp.color)} />
                    <p className="text-xs font-medium">{bp.name} Layout</p>
                    <p className="text-xs text-muted-foreground">
                      {bp.name === 'Mobile' && 'Single column, stacked'}
                      {bp.name === 'Tablet' && '2-column grid, scrollable'}
                      {bp.name === 'Desktop' && '3+ columns, side-by-side'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Component Adaptations:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li><strong>KPI Grid:</strong> Mobile (1 col) → Tablet (2 cols) → Desktop (3 cols)</li>
          <li><strong>Toolbar:</strong> Mobile (stacked) → Desktop (inline)</li>
          <li><strong>Detail Panel:</strong> Mobile (modal) → Desktop (side panel 40%)</li>
          <li><strong>Touch Targets:</strong> 44px minimum on mobile</li>
        </ul>
      </div>
    </div>
  );
}

function AccessibilityShowcase() {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium">Accessibility Standards (WCAG 2.1 AA)</h3>
      
      <div className="space-y-3">
        {/* Keyboard Navigation */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <LayoutGrid className="w-4 h-4" />
              Keyboard Navigation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Ctrl+F</kbd>
                <span>Focus search</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Ctrl+N</kbd>
                <span>New record</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Ctrl+R</kbd>
                <span>Refresh</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Ctrl+E</kbd>
                <span>Export</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Enter</kbd>
                <span>Edit/Activate</span>
              </div>
              <div className="flex items-center gap-2 p-2 bg-muted rounded">
                <kbd className="px-2 py-1 bg-background border rounded font-mono text-xs">Escape</kbd>
                <span>Cancel/Close</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Focus Indicator */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Eye className="w-4 h-4" />
              Focus Indicator
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button className="ring-2 ring-primary ring-offset-2">
                Focus State Example
              </Button>
              <p className="text-xs text-muted-foreground">
                All interactive elements show 2px primary ring on keyboard focus.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ARIA Live Region */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Screen Reader Announcements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="p-2 bg-muted rounded text-xs font-mono">
                {`<div aria-live="polite" aria-atomic="true">`}
                <br />
                {`  <AmroKpiGrid items={...} />`}
                <br />
                {`  <span className="sr-only">1,234 items loaded</span>`}
                <br />
                {`</div>`}
              </div>
              <p className="text-xs text-muted-foreground">
                Live regions announce dynamic content changes to screen readers.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>WCAG 2.1 AA Checklist:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>✓ Contrast ratio ≥ 4.5:1 for normal text</li>
          <li>✓ All functionality keyboard accessible</li>
          <li>✓ Focus visible and logical</li>
          <li>✓ Error identification with inline messages</li>
          <li>✓ ARIA attributes on all interactive elements</li>
          <li>✓ Minimum font size 12px (text-xs)</li>
          <li>✓ Touch targets ≥ 44px on mobile</li>
        </ul>
      </div>
    </div>
  );
}

// ── Forms & Wizards Showcase ───────────────────────────────────────────────────

function StandardFormShowcase() {
  const [formData, setFormData] = useState({
    part_number: 'PN-001-A320',
    serial_number: 'SN-12345',
    description: 'Hydraulic Pump Assembly for A320 aircraft',
    status: 'available',
    lifecycle_status: 'serviceable',
    quantity_on_hand: '12',
    quantity_reserved: '2',
    warehouse_location: 'WH-A1-03',
    unit_cost: '1250.00',
    reorder_level: '5',
    reorder_quantity: '10',
    supplier: 'supplier-001',
    tags: 'hydraulic,pump,a320',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateField = (field: string, value: string) => {
    if (!value.trim()) return 'This field is required';
    if (field === 'part_number' && !value.match(/^[A-Z]{2}-\d{3}-[A-Z]\d{3}$/)) {
      return 'Format: XX-NNN-XNNN (e.g., PN-001-A320)';
    }
    if (field === 'quantity_on_hand' && isNaN(Number(value))) {
      return 'Must be a number';
    }
    return '';
  };

  const handleBlur = (field: string) => {
    const error = validateField(field, formData[field as keyof typeof formData]);
    if (error) {
      setErrors(prev => ({ ...prev, [field]: error }));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">AmroStandardFormTemplate</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Canonical form layout with sections, field groups, validation, and actions.
          Based on Parts Inventory & Work Package Templates forms.
        </p>
      </div>

      <Card className="border-slate-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Create Part Record</CardTitle>
              <CardDescription className="text-xs">
                Add a new part to the inventory catalog
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-xs">parts.inventory</Badge>
              <Badge variant="secondary" className="text-xs">create</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Section 1: Identification */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Package className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Identification</h4>
              <Badge variant="outline" className="text-xs ml-auto">Required</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Part Number */}
              <div className="space-y-2">
                <Label htmlFor="part_number" className="text-xs">
                  Part Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="part_number"
                  value={formData.part_number}
                  onChange={(e) => handleInputChange('part_number', e.target.value)}
                  onBlur={() => handleBlur('part_number')}
                  placeholder="PN-001-A320"
                  className={cn(errors.part_number && 'border-red-500')}
                  aria-invalid={!!errors.part_number}
                  aria-describedby={errors.part_number ? 'part_number-error' : undefined}
                />
                {errors.part_number && (
                  <p id="part_number-error" className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {errors.part_number}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">Format: XX-NNN-XNNN</p>
              </div>

              {/* Serial Number */}
              <div className="space-y-2">
                <Label htmlFor="serial_number" className="text-xs">Serial Number</Label>
                <Input
                  id="serial_number"
                  value={formData.serial_number}
                  onChange={(e) => handleInputChange('serial_number', e.target.value)}
                  placeholder="SN-12345"
                />
              </div>

              {/* Description */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description" className="text-xs">
                  Description <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  onBlur={() => handleBlur('description')}
                  placeholder="Enter part description..."
                  rows={3}
                  className={cn(errors.description && 'border-red-500')}
                />
                {errors.description && (
                  <p className="text-xs text-red-500">{errors.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Section 2: Stock & Location */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Boxes className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Stock & Location</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="quantity_on_hand" className="text-xs">Quantity On Hand</Label>
                <Input
                  id="quantity_on_hand"
                  type="number"
                  value={formData.quantity_on_hand}
                  onChange={(e) => handleInputChange('quantity_on_hand', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity_reserved" className="text-xs">Quantity Reserved</Label>
                <Input
                  id="quantity_reserved"
                  type="number"
                  value={formData.quantity_reserved}
                  onChange={(e) => handleInputChange('quantity_reserved', e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="warehouse_location" className="text-xs">Warehouse Location</Label>
                <Input
                  id="warehouse_location"
                  value={formData.warehouse_location}
                  onChange={(e) => handleInputChange('warehouse_location', e.target.value)}
                  placeholder="WH-A1-03"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Status & Lifecycle */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-2 border-b">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold">Status & Lifecycle</h4>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs">Status</Label>
                <RadioGroup defaultValue="available" className="flex gap-4">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="available" id="status_available" />
                    <Label htmlFor="status_available" className="text-xs">Available</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="low_stock" id="status_low" />
                    <Label htmlFor="status_low" className="text-xs">Low Stock</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="reserved" id="status_reserved" />
                    <Label htmlFor="status_reserved" className="text-xs">Reserved</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Lifecycle Status</Label>
                <Select defaultValue="serviceable">
                  <SelectTrigger>
                    <SelectValue placeholder="Select lifecycle status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="serviceable">Serviceable</SelectItem>
                    <SelectItem value="inspection_due">Inspection Due</SelectItem>
                    <SelectItem value="needs_repair">Needs Repair</SelectItem>
                    <SelectItem value="quarantined">Quarantined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Validation Alert */}
          <Alert variant="default">
            <Info className="h-4 w-4" />
            <AlertTitle className="text-xs">Form Validation</AlertTitle>
            <AlertDescription className="text-xs">
              {Object.keys(errors).length > 0 
                ? `${Object.keys(errors).length} field(s) require attention`
                : 'All fields are valid. Ready to submit.'}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Standards Note */}
      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Form Standards:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>2-column grid layout (responsive: 1-col mobile, 2-col desktop)</li>
          <li>Sections with icons and optional badges</li>
          <li>Required fields marked with red asterisk</li>
          <li>Inline validation on blur</li>
          <li>Error messages below fields with alert icon</li>
          <li>Helper text for format guidance</li>
          <li>Minimum font size: 12px (text-xs)</li>
        </ul>
      </div>
    </div>
  );
}

function WizardFormShowcase() {
  const [currentStep, setCurrentStep] = useState(0);
  
  const steps = [
    { id: 'aircraft', title: 'Aircraft & Path', description: 'Select aircraft and workflow', completed: currentStep > 0 },
    { id: 'details', title: 'Details', description: 'Title, priority, assignment', completed: currentStep > 1 },
    { id: 'tasks', title: 'Tasks', description: 'Define tasks and sequences', completed: currentStep > 2 },
    { id: 'review', title: 'Review', description: 'Confirm and submit', completed: false },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Work Package Wizard (4-Step)</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Multi-step wizard for creating Work Packages. Used in Create Work Package workflow.
          Based on AmroWorkPackageCreateWizard pattern.
        </p>
      </div>

      <Card className="border-slate-300">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Create Work Package</CardTitle>
              <CardDescription className="text-xs">
                Create a new work package using scheduled, non-scheduled, or emergency workflow
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-xs">Step {currentStep + 1} of {steps.length}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step Indicator */}
          <div className="space-y-4">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{Math.round((currentStep / (steps.length - 1)) * 100)}%</span>
              </div>
              <Progress value={(currentStep / (steps.length - 1)) * 100} className="h-2" />
            </div>

            {/* Step Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={cn(
                    'rounded-lg border p-3 space-y-2 transition-all',
                    index === currentStep && 'border-primary bg-primary/5',
                    step.completed && 'border-green-200 bg-green-50',
                    index > currentStep && 'border-gray-200 bg-gray-50 opacity-60'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium',
                      step.completed && 'bg-green-500 text-white',
                      index === currentStep && 'bg-primary text-white',
                      index > currentStep && 'bg-gray-200 text-gray-600'
                    )}>
                      {step.completed ? '✓' : index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{step.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Step Content Placeholder */}
          <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center bg-gray-50">
            <h4 className="text-sm font-medium mb-1">Step {currentStep + 1}: {steps[currentStep].title}</h4>
            <p className="text-xs text-muted-foreground mb-4">{steps[currentStep].description}</p>
            
            {/* Mock content based on step */}
            {currentStep === 0 && (
              <div className="space-y-3 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label className="text-xs">Select Aircraft</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Choose aircraft..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="a320">A320-200 (VT-ABC)</SelectItem>
                      <SelectItem value="b737">B737-800 (VT-DEF)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Creation Path</Label>
                  <RadioGroup defaultValue="scheduled" className="flex gap-4">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="scheduled" id="scheduled" />
                      <Label htmlFor="scheduled" className="text-xs">Scheduled</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="non_scheduled" id="non_scheduled" />
                      <Label htmlFor="non_scheduled" className="text-xs">Non-Scheduled</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            )}
            
            {currentStep === 1 && (
              <div className="space-y-3 max-w-md mx-auto">
                <div className="space-y-2">
                  <Label className="text-xs">Title <span className="text-red-500">*</span></Label>
                  <Input placeholder="Enter work package title..." />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Priority</Label>
                  <Select>
                    <SelectTrigger><SelectValue placeholder="Select priority..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {currentStep >= 2 && (
              <p className="text-xs text-muted-foreground">Tasks and review steps would be rendered here</p>
            )}
          </div>

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
              disabled={currentStep === 0}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
            
            <div className="flex gap-2">
              <Button variant="ghost" size="sm">Save Draft</Button>
              <Button
                size="sm"
                onClick={() => {
                  if (currentStep < steps.length - 1) {
                    setCurrentStep(currentStep + 1);
                  }
                }}
              >
                {currentStep === steps.length - 1 ? 'Submit' : 'Next'}
                {currentStep < steps.length - 1 && <ArrowRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Wizard Standards:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Step indicator with progress bar</li>
          <li>Completed steps marked with checkmark</li>
          <li>Active step highlighted with primary color</li>
          <li>Future steps shown with reduced opacity</li>
          <li>Previous/Next navigation with disabled states</li>
          <li>Save Draft option at each step</li>
          <li>Validation before advancing</li>
        </ul>
      </div>
    </div>
  );
}

function FormFieldPatternsShowcase() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Form Field Patterns</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Standard input patterns used across all AMRO forms. Based on AmroStandardFormTemplate field definitions.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Text Input */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Text Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Part Number <span className="text-red-500">*</span></Label>
            <Input placeholder="PN-001-A320" />
            <p className="text-xs text-muted-foreground">Helper text for format guidance</p>
          </CardContent>
        </Card>

        {/* Textarea */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Textarea</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea placeholder="Enter description..." rows={3} />
          </CardContent>
        </Card>

        {/* Select Dropdown */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Select Dropdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Aircraft Model</Label>
            <Select>
              <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="a320">A320-200</SelectItem>
                <SelectItem value="b737">B737-800</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {/* Number Input */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Number Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Quantity</Label>
            <Input type="number" placeholder="0" />
          </CardContent>
        </Card>

        {/* Date Input */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Date Input</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Expiry Date</Label>
            <Input type="date" />
          </CardContent>
        </Card>

        {/* Checkbox */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Checkbox</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox id="urgent" />
              <Label htmlFor="urgent" className="text-xs">Mark as urgent</Label>
            </div>
          </CardContent>
        </Card>

        {/* Radio Group */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Radio Group</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Label className="text-xs">Priority</Label>
            <RadioGroup defaultValue="medium" className="flex flex-col gap-2">
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="low" id="priority_low" />
                <Label htmlFor="priority_low" className="text-xs">Low</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="medium" id="priority_medium" />
                <Label htmlFor="priority_medium" className="text-xs">Medium</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="high" id="priority_high" />
                <Label htmlFor="priority_high" className="text-xs">High</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Switch */}
        <Card className="border-slate-300">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Switch</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="active" className="text-xs">Active</Label>
              <Switch id="active" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Field Standards:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Labels above inputs (text-xs, font-medium)</li>
          <li>Required fields marked with red asterisk</li>
          <li>Placeholder text for guidance</li>
          <li>Helper text below inputs (optional)</li>
          <li>Error state: red border + error message</li>
          <li>Focus state: 2px primary ring</li>
          <li>Disabled state: opacity-50, cursor-not-allowed</li>
        </ul>
      </div>
    </div>
  );
}

function FormValidationShowcase() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Form Validation States</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Validation feedback patterns for success, warning, error, and info states.
        </p>
      </div>

      <div className="space-y-3">
        {/* Success State */}
        <Alert className="border-green-200 bg-green-50">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-xs text-green-700">Validation Successful</AlertTitle>
          <AlertDescription className="text-xs text-green-600">
            All fields are valid. Form is ready to submit.
          </AlertDescription>
        </Alert>

        {/* Warning State */}
        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertTitle className="text-xs text-amber-700">Validation Warning</AlertTitle>
          <AlertDescription className="text-xs text-amber-600">
            Quantity is below reorder level. Consider restocking soon.
          </AlertDescription>
        </Alert>

        {/* Error State */}
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle className="text-xs">Validation Error</AlertTitle>
          <AlertDescription className="text-xs">
            Part Number format is invalid. Expected: XX-NNN-XNNN (e.g., PN-001-A320)
          </AlertDescription>
        </Alert>

        {/* Info State */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle className="text-xs">Form Information</AlertTitle>
          <AlertDescription className="text-xs">
            Required fields are marked with a red asterisk (*). Please complete all required fields.
          </AlertDescription>
        </Alert>

        {/* Inline Field Error */}
        <Card className="border-red-200">
          <CardContent className="p-4 space-y-2">
            <Label className="text-xs">Part Number <span className="text-red-500">*</span></Label>
            <Input
              value="INVALID-FORMAT"
              className="border-red-500 focus-visible:ring-red-500"
              aria-invalid="true"
            />
            <p className="text-xs text-red-500 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Invalid format. Use: PN-001-A320
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground">
        <p><strong>Validation Standards:</strong></p>
        <ul className="list-disc list-inside space-y-1">
          <li>Validate on blur (when user leaves field)</li>
          <li>Validate on submit (full form validation)</li>
          <li>Inline errors below fields with icon</li>
          <li>Alert banners for form-level messages</li>
          <li>Success states with green indicators</li>
          <li>Warning states for non-blocking issues</li>
          <li>Error states with red borders and messages</li>
          <li>Info states for guidance and instructions</li>
        </ul>
      </div>
    </div>
  );
}

// ── Main Showcase Component ────────────────────────────────────────────────────

export function AmroDesignSystemShowcase() {
  const [activeTab, setActiveTab] = useState('overview');
  const isMobile = useIsMobile();

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Boxes className="h-5 w-5 text-primary" />
          <h1 className="text-xl font-bold">AMRO Design System Showcase</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Interactive demonstration of all AMRO UI patterns based on Parts Inventory module.
          Use this for training, stakeholder presentations, and UX reviews.
        </p>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          <TabsTrigger value="surface" className="text-xs">Module Surface</TabsTrigger>
          <TabsTrigger value="kpi" className="text-xs">KPI Grid</TabsTrigger>
          <TabsTrigger value="toolbar" className="text-xs">Toolbar</TabsTrigger>
          <TabsTrigger value="grid" className="text-xs">Data Grid</TabsTrigger>
          <TabsTrigger value="navigation" className="text-xs">Navigation</TabsTrigger>
          <TabsTrigger value="forms" className="text-xs">Forms & Wizards</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <Card className="border-slate-300">
            <CardHeader>
              <CardTitle className="text-base">Welcome to AMRO Design System</CardTitle>
              <CardDescription className="text-sm">
                This showcase demonstrates all UI patterns used across AMRO modules.
                Each pattern is extracted from the battle-tested Parts Inventory implementation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Pattern Index */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[
                  { id: 'surface', title: 'Module Surface', desc: 'Card container with title, subtitle, status', icon: LayoutGrid },
                  { id: 'kpi', title: 'KPI Grid', desc: 'Semantic metric display with urgency tones', icon: TrendingUp },
                  { id: 'toolbar', title: 'Standard Toolbar', desc: 'Search, filters, actions with touch targets', icon: Filter },
                  { id: 'grid', title: 'Data Grid', desc: 'Virtualized table with column management', icon: Columns3 },
                  { id: 'navigation', title: 'Navigation Shell', desc: 'Breadcrumbs, quick access, role-based', icon: LayoutDashboard },
                  { id: 'responsive', title: 'Responsive', desc: 'Mobile-first with adaptive layouts', icon: Monitor },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button
                      key={item.id}
                      variant="outline"
                      className="h-auto p-4 flex flex-col items-start gap-2 text-left"
                      onClick={() => setActiveTab(item.id)}
                    >
                      <div className="flex items-center gap-2 w-full">
                        <Icon className="w-5 h-5 text-primary" />
                        <span className="font-medium">{item.title}</span>
                      </div>
                      <span className="text-xs text-muted-foreground">{item.desc}</span>
                    </Button>
                  );
                })}
              </div>

              {/* Quick Stats */}
              <Separator />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-primary">6</p>
                  <p className="text-xs text-muted-foreground">Core Patterns</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">100%</p>
                  <p className="text-xs text-muted-foreground">WCAG 2.1 AA</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">3</p>
                  <p className="text-xs text-muted-foreground">Breakpoints</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">15+</p>
                  <p className="text-xs text-muted-foreground">Keyboard Shortcuts</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Responsive & Accessibility Quick View */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ResponsiveShowcase />
            <AccessibilityShowcase />
          </div>
        </TabsContent>

        {/* Module Surface Tab */}
        <TabsContent value="surface" className="mt-6">
          <ModuleSurfaceShowcase />
        </TabsContent>

        {/* KPI Grid Tab */}
        <TabsContent value="kpi" className="mt-6">
          <KpiGridShowcase />
        </TabsContent>

        {/* Toolbar Tab */}
        <TabsContent value="toolbar" className="mt-6">
          <ToolbarShowcase />
        </TabsContent>

        {/* Data Grid Tab */}
        <TabsContent value="grid" className="mt-6">
          <DataGridShowcase />
        </TabsContent>

        {/* Navigation Tab */}
        <TabsContent value="navigation" className="mt-6">
          <NavigationShowcase />
        </TabsContent>

        {/* Forms & Wizards Tab */}
        <TabsContent value="forms" className="mt-6 space-y-8">
          <StandardFormShowcase />
          <Separator />
          <WizardFormShowcase />
          <Separator />
          <FormFieldPatternsShowcase />
          <Separator />
          <FormValidationShowcase />
        </TabsContent>
      </Tabs>

      {/* Footer */}
      <Separator />
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4" />
          <span>Based on Parts Inventory module implementation</span>
        </div>
        <div className="flex items-center gap-4">
          <span>Document: AMRO_DESIGN_SYSTEM_TEMPLATE.md</span>
          <span>Version: 1.0.0</span>
        </div>
      </div>
    </div>
  );
}

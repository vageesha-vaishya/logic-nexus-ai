# Leads Workspace UI/UX Consistency Specification

## Objective

This specification defines the exact visual and interaction contract used to align the Leads workspace with the AMRO Settings → Master Data module.

## Source Pattern

- Reference module: `src/features/module-amro/settings/pages/AmroSettingsMasterDataPage.tsx`
- Target module: `src/pages/dashboard/Leads.tsx`
- Modal implementation: `src/components/crm/LeadsMasterDataFormModal.tsx`

## Component Hierarchy

### Page Shell

1. `DashboardLayout`
2. Theme style wrapper via `themeStyleFromPreset(currentTheme)`
3. `FirstScreenTemplate`
4. Master Data style header summary block (`text-2xl` title + muted subtitle + right action cluster)
5. Header control strip using `CRMModuleHeaderNavigation`
6. Filter card section
7. Records card section
8. Data presentation section (list/grid/card workspace)
9. Bulk action bar + delete confirmation dialog
10. Form modal (`LeadsMasterDataFormModal`)

### Filter Section Contract

- Container components:
  - `Card`
  - `CardHeader` + `CardTitle`
  - `CardContent`
- Title text: `Lead Search and Filter`
- Core spacing pattern:
  - Outer spacing: `space-y-3`
  - Horizontal control rail: compact, single-line overflow-friendly row
- Inputs and controls:
  - `Input`, `Select`, `DropdownMenu`, `Button`
  - Shared compact height convention: `h-7`
  - Consistent background token: `bg-background`
- Active filter tokens:
  - `Badge variant="secondary"`
  - Inline clear action icon with compact ghost button

### Header Summary Contract

- Container: `flex flex-wrap items-center justify-between gap-3`
- Title: `text-2xl font-semibold`
- Subtitle: `text-sm text-muted-foreground`
- Right action cluster:
  - `Badge variant="secondary"` for tenant scope visibility
  - `Button variant="outline"` for refresh and import/export
  - Primary `Button` for `New Lead`

### Records Section Contract

- Container components:
  - `Card`
  - `CardHeader` + `CardTitle` (`Lead Records`)
  - `CardContent className="space-y-3"`
- Data surface:
  - Maintains existing lead views while keeping the same card shell pattern as AMRO records blocks.
- Footer controls:
  - Existing list pagination row retained inside records section.

### Form Modal Contract

- Modal shell:
  - `Dialog` + `DialogContent` with `sm:max-w-4xl`
  - Vertical overflow control: `max-h-[90vh] overflow-y-auto`
- Content card:
  - `Card`
  - `CardHeader` + `CardTitle` using `Lead Create and Update`
  - `CardContent` with `space-y-3`
- Form grid:
  - `grid gap-3 md:grid-cols-2`
  - Long-text fields span both columns with `md:col-span-2`
- Field components:
  - `Label`, `Input`, `Select`, `Textarea`
- Validation state:
  - Error text uses `text-xs text-destructive`
  - Invalid control state exposed through `aria-invalid`
- Action row:
  - `flex flex-wrap gap-2`
  - Primary action (`Create`/`Update Selected`)
  - Secondary actions (`Reset Form`, `Cancel`)
- Loading indicator:
  - Inline spinner icon using `Loader2` with `animate-spin`

## Design Token and Styling Matrix

### Typography

- Section titles: `CardTitle`
- Body/help text: `text-sm text-muted-foreground`
- Validation text: `text-xs text-destructive`

### Spacing

- Page spacing: `space-y-4 p-4 lg:p-6`
- Card content spacing: `space-y-3`
- Field stack spacing: `space-y-2`
- Action spacing: `gap-2`

### Colors and Surfaces

- Surface tokens:
  - `bg-background`
  - `bg-popover` for floating bulk action bar
- Border tokens:
  - `border`
  - semantic destructive text for validation

### Buttons

- Primary action: default `Button`
- Secondary action: `Button variant="outline"`
- Destructive bulk action: `Button variant="destructive"`
- Utility action: `Button variant="ghost"`

## Interaction Pattern Contract

### Create and Update Modal Behavior

- Header `New Lead` action opens create mode modal.
- Lead card `Edit` action opens update mode modal with pre-filled values.
- Modal reset action rehydrates values from current mode baseline.
- Successful submit:
  - Shows success toast
  - Closes modal
  - Refreshes lead workspace dataset
- Failure path:
  - Shows error toast
  - Preserves modal state and entered data

### Delete Confirmation Behavior

- Bulk delete action opens `AlertDialog` instead of browser confirm.
- Dialog structure mirrors Master Data pattern:
  - `AlertDialogTitle`
  - `AlertDialogDescription`
  - `AlertDialogCancel`
  - `AlertDialogAction`

### Data Persistence Flow

- Primary persistence path:
  - API endpoint `/api/crm/v1/leads` for create
  - API endpoint `/api/crm/v1/leads/:id` for update
- Fallback persistence path:
  - `scopedDb.from('leads').insert(...)`
  - `scopedDb.from('leads').update(...).eq('id', leadId)`
- Scope propagation:
  - `x-tenant-id`, `x-franchise-id`, `x-user-id` headers

### Accessibility Guarantees

- Label-to-control mapping via `htmlFor` and `id`
- Modal focus trap from shared `Dialog` implementation
- Error exposure via `aria-invalid`
- Keyboard interaction inherited from shadcn primitives and native form controls

## Responsive Breakpoint Contract

- Form and filters remain single-column/scroll-safe on small screens.
- Form grid promotes to two-column layout at `md` breakpoint.
- Modal width bounded at `sm:max-w-4xl` to preserve readability.

## Consistency Checklist

- Uses the same control primitives as Master Data (`Card`, `Input`, `Select`, `Textarea`, `Button`).
- Uses matching spacing cadence (`gap-3`, `space-y-3`, compact control rail).
- Uses matching validation presentation (`text-destructive` messaging beneath fields).
- Uses matching action grouping pattern (primary + outline secondary controls).
- Preserves CRM header action sequence and theme/view persistence behavior.

## AMRO Master Data Multi-Page Replication Contract

### Module Coverage

- Aircraft
- Parts Inventory
- Suppliers
- Maintenance Facilities
- Work Centers
- Skill Codes
- Regulator Profiles
- Shift Calendars
- Work Package Templates

### List View Architecture Contract

- Shared route shell supports module-specific pages under `/dashboard/amro/settings/master-data/*`.
- Table header uses `text-[14px] font-semibold text-[#64748B]`.
- Table row cell spacing uses `px-4 py-3` (16px horizontal, 12px vertical).
- Row hover state uses `hover:bg-[#F5F7FA]` with `duration-200 ease-in-out`.
- Typography baseline uses `font-[Inter] text-[14px] leading-6`.
- Color contract uses:
  - Primary `#1E3A8A`
  - Secondary `#64748B`
  - Success `#10B981`
  - Error `#EF4444`

### Double-Click Interaction Contract

- Single row click selection is delayed by `300ms` to avoid conflict with double-click.
- Double-click on a row opens CRUD modal in update mode with selected row prefilled.
- Modal transition uses `duration-[250ms]` with zoom state classes (`zoom-in-95`/`zoom-out-95`).
- Dialog remains centered by shared shell transform (`left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]`).
- Focus behavior auto-focuses the first editable field when modal opens.

### CRUD Modal and Section Architecture Contract

- Form modal contains three sections with tab navigation:
  - `Basic Information`
  - `Configuration Settings`
  - `System Information`
- Tab rail uses `border-b-2 border-[#E5E7EB]` and active state `border-[#1E3A8A] text-[#1E3A8A]`.
- Section header style uses `text-[16px] font-semibold` with 24px spacing rhythm.
- Field density contract:
  - Desktop: up to 4 columns (`xl:grid-cols-4`)
  - Tablet: 2 columns (`md:grid-cols-2`)
  - Mobile: 1 column (`grid-cols-1`)
- Control dimensions:
  - Text inputs/selects/date/time: `h-10` (40px)
  - Toggle control remains compact inside bordered 40px row container.
- Validation style:
  - Field border on invalid: `border-[#EF4444]`
  - Error text: `text-xs text-[#EF4444]`

### Testing and Validation Contract

- Unit and integration coverage includes:
  - Nine-module tab registry checks
  - Modal create/update/delete flows
  - Kebab-case route hydration for module pages
  - Payload validation for required/date/time/json constraints
  - Referential checks for supplier/facility dependencies

# Logic Nexus Design System

This document outlines the visual design language, component hierarchy, and implementation standards for the Logic Nexus-AI platform.

## 1. Design Philosophy
The "Enterprise" design system mimics high-density, data-rich ERP interfaces (inspired by modern enterprise tools) to maximize information density while maintaining readability.

**Core Principles:**
- **Information Density**: Use screen real estate efficiently.
- **Contextual Actions**: Actions should be close to the data they affect.
- **Split Views**: Use split panels (Sheet vs. Activity) for complex entities.

## 2. Color Palette

### Base Colors
- **Background**: `#f9fafb` (Light Gray) for the main canvas.
- **Surface**: `#ffffff` (White) for cards, sheets, and input backgrounds.
- **Primary**: Inherited from Tailwind `primary` (typically a deep blue or brand color).
- **Text**: 
  - Primary: `gray-900`
  - Secondary: `muted-foreground`

### Semantic Colors
- **Status Badges**:
  - Success: `bg-green-100 text-green-800`
  - Warning: `bg-yellow-100 text-yellow-800`
  - Error: `bg-red-100 text-red-800`
  - Neutral: `bg-gray-100 text-gray-800`

## 3. Typography
- **Font Family**: Inter (default sans).
- **Headings**:
  - H1 (Page Title): `text-3xl font-bold`
  - H2 (Section Title): `text-lg font-semibold`
  - H3 (Card Title): `text-sm font-semibold uppercase tracking-wider`
- **Body**: `text-sm` is the standard size for all form inputs and labels.

## 4. Component Library (`src/components/ui/enterprise`)

### `EnterpriseFormLayout`
The main wrapper for detail pages.
- **Props**: `title`, `breadcrumbs`, `actions`, `status`.
- **Layout**: Fixed header with breadcrumbs/actions, scrollable body.

### `EnterpriseSheet`
The central "paper" element containing the record's data.
- **Style**: White background, `rounded-lg`, `shadow-sm`, `border`.
- **Structure**:
  - **Header**: Logo, Title, Key Metadata, Smart Buttons.
  - **Notebook (Tabs)**: Navigation for sub-sections.

### `EnterpriseField`
Standardized key-value display.
- **Layout**: Label (top/left) and Value (bottom/right).
- **Style**: `text-sm`, label in `muted-foreground`.

### `EnterpriseStatButton` (Smart Button)
Quick access stats in the header.
- **Style**: Boxed button with icon and count.
- **Interaction**: Navigates to related list views.

### `EnterpriseActivityFeed`
Right-hand sidebar for history and communication.
- **Features**: Log notes, send messages, view audit trail.
- **Style**: Gray background (`bg-muted/10`), border-left.

## 5. Spacing & Layout
- **Page Padding**: `p-4` or `p-6` depending on viewport.
- **Gap**: Standard gap is `gap-6` (1.5rem).
- **Grid**: Use `grid-cols-1 md:grid-cols-2` for form fields.

## 6. Implementation Guide

To migrate a module to this system:

1.  **Import Components**:
    ```typescript
    import { EnterpriseFormLayout } from '@/components/ui/enterprise/EnterpriseFormLayout';
    import { EnterpriseSheet, EnterpriseField } from '@/components/ui/enterprise/EnterpriseComponents';
    ```

2.  **Structure**:
    ```tsx
    <EnterpriseFormLayout title="...">
      <EnterpriseSheet header={...}>
        <EnterpriseNotebook>
           <EnterpriseTab label="Tab 1">...</EnterpriseTab>
        </EnterpriseNotebook>
      </EnterpriseSheet>
      <EnterpriseActivityFeed />
    </EnterpriseFormLayout>
    ```

3.  **Data Binding**: Ensure `ScopedDataAccess` is used for all data fetching.

## 7. Responsiveness
- **Desktop (xl)**: Sheet (Left) + Activity Feed (Right).
- **Tablet/Mobile (<xl)**: Activity Feed hides or stacks (currently hidden on mobile, need to implement stacking if required).

## 8. Component Library Extensions

The enterprise component library has been expanded with 6 new reusable components designed for high-density data interfaces and complex form workflows.

### EnterpriseTable

A data table component optimized for displaying large datasets with sorting, column management, and row actions.

**Props:**
- `columns`: Array of column definitions with `id`, `label`, `accessor`, `sortable`, `width`
- `data`: Array of row objects
- `onSort`: Callback when column headers are clicked for sorting
- `onRowClick`: Optional callback for row interactions
- `isLoading`: Boolean to show skeleton loading state
- `emptyState`: React node for empty data state

**Key Features:**
- Sortable column headers with visual indicators
- Responsive column widths
- Row selection with checkboxes
- Sticky header on scroll
- Built-in pagination support
- Customizable row actions menu

**Usage Example:**
```tsx
import { EnterpriseTable } from '@/components/ui/enterprise';

const columns = [
  { id: 'name', label: 'Name', accessor: 'name', sortable: true },
  { id: 'status', label: 'Status', accessor: 'status' },
  { id: 'amount', label: 'Amount', accessor: 'amount', sortable: true }
];

<EnterpriseTable
  columns={columns}
  data={accountList}
  onSort={(column, direction) => console.log(column, direction)}
  onRowClick={(row) => navigate(`/account/${row.id}`)}
/>
```

### EnterpriseCard

A flexible card component for organizing content in containers with multiple visual variants.

**Props:**
- `variant`: "default" | "elevated" | "outlined"
- `title`: Optional header title
- `subtitle`: Optional secondary title
- `icon`: Optional React element for card icon
- `footer`: Optional footer content
- `onClick`: Optional click handler
- `className`: Additional classes

**Variants:**
- **default**: White background with subtle shadow, standard padding
- **elevated**: White background with pronounced shadow for emphasis
- **outlined**: Transparent background with border, minimal shadow

**Key Features:**
- Consistent spacing and padding
- Semantic color support for status variants
- Icon support for visual hierarchy
- Title and subtitle organization
- Optional action footer
- Hover states for interactivity

**Usage Example:**
```tsx
import { EnterpriseCard } from '@/components/ui/enterprise';

<EnterpriseCard
  variant="elevated"
  title="Account Summary"
  icon={<BarChart3 />}
  footer={<button>View Details</button>}
>
  <div className="text-2xl font-bold">$125,000</div>
  <p className="text-sm text-muted-foreground">Total Revenue</p>
</EnterpriseCard>
```

### EnterpriseModal

A dialog component for displaying content in a modal overlay with multiple size options and header/footer support.

**Props:**
- `isOpen`: Boolean to control visibility
- `onClose`: Callback to close modal
- `title`: Modal header title
- `size`: "sm" | "md" | "lg" | "xl" (controls max-width)
- `footer`: Optional footer with action buttons
- `closeButton`: Boolean to show close button (default: true)
- `className`: Additional wrapper classes

**Sizes:**
- **sm**: max-w-sm (384px) - for confirmations and simple forms
- **md**: max-w-md (448px) - default for most modals
- **lg**: max-w-lg (512px) - for complex forms
- **xl**: max-w-xl (576px) - for full-featured workflows

**Key Features:**
- Smooth animations (fade + scale)
- Focus trap for accessibility
- Click outside to close
- Keyboard escape to close
- Responsive overflow handling
- Semantic footer layout

**Usage Example:**
```tsx
import { EnterpriseModal } from '@/components/ui/enterprise';

const [isOpen, setIsOpen] = useState(false);

<EnterpriseModal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Create New Account"
  size="lg"
  footer={
    <div className="flex gap-2">
      <button>Cancel</button>
      <button className="bg-primary">Create</button>
    </div>
  }
>
  {/* Form content */}
</EnterpriseModal>
```

### EnterpriseHeader

A header component for page titles and meta information with multiple layout variants.

**Props:**
- `title`: Page title
- `subtitle`: Optional secondary text
- `variant`: "default" | "bordered" | "minimal"
- `breadcrumbs`: Optional array of breadcrumb items
- `actions`: Optional React element for header actions
- `meta`: Optional object with key-value metadata
- `status`: Optional status badge

**Variants:**
- **default**: Full-featured header with all elements, standard padding
- **bordered**: Default variant with bottom border separator
- **minimal**: Compact variant with reduced padding, no border

**Key Features:**
- Breadcrumb navigation support
- Status badge integration
- Flexible action area
- Meta information display
- Responsive title sizing
- Visual hierarchy through typography

**Usage Example:**
```tsx
import { EnterpriseHeader } from '@/components/ui/enterprise';

<EnterpriseHeader
  title="Account Management"
  subtitle="Manage your customer accounts"
  variant="bordered"
  breadcrumbs={[
    { label: 'Dashboard', href: '/' },
    { label: 'Accounts', href: '/accounts' },
    { label: 'Details' }
  ]}
  actions={<button>Edit</button>}
  status="Active"
/>
```

### EnterpriseButton

A button component with multiple visual variants and sizes for consistent interaction patterns.

**Props:**
- `variant`: "primary" | "secondary" | "outline" | "ghost" | "danger"
- `size`: "sm" | "md" | "lg"
- `disabled`: Boolean to disable button
- `isLoading`: Boolean to show loading state
- `icon`: Optional left icon element
- `onClick`: Click handler

**Variants:**
- **primary**: Solid background with primary color, white text
- **secondary**: Solid background with secondary/muted color
- **outline**: Transparent background with border
- **ghost**: Minimal style with hover background
- **danger**: Solid background with danger/red color for destructive actions

**Sizes:**
- **sm**: px-3 py-1.5, text-xs
- **md**: px-4 py-2, text-sm (default)
- **lg**: px-6 py-3, text-base

**Key Features:**
- Built-in loading spinner support
- Icon positioning and spacing
- Disabled state styling
- Consistent focus states
- Touch-friendly padding
- Smooth transitions

**Usage Example:**
```tsx
import { EnterpriseButton } from '@/components/ui/enterprise';

<div className="flex gap-2">
  <EnterpriseButton variant="primary" size="lg">
    Save Changes
  </EnterpriseButton>
  <EnterpriseButton variant="outline">
    Cancel
  </EnterpriseButton>
  <EnterpriseButton variant="danger" size="sm">
    Delete
  </EnterpriseButton>
</div>
```

### EnterpriseForm

A comprehensive form component system with built-in validation, field management, and layout control. Includes 4 sub-components for flexible form construction.

**Main Component Props:**
- `onSubmit`: Callback with form values
- `initialValues`: Object with form data
- `validationSchema`: Optional schema for validation
- `isSubmitting`: Boolean to disable submit during request
- `className`: Additional wrapper classes

**Sub-Components:**

**EnterpriseFormField:**
- `name`: Field name (matches initialValues key)
- `label`: Display label
- `type`: "text" | "email" | "number" | "textarea" | "select" | "checkbox" | "date"
- `required`: Boolean
- `placeholder`: Input placeholder text
- `error`: Optional error message to display
- `helpText`: Optional helper text below input
- `disabled`: Boolean to disable field

**EnterpriseFormSection:**
- `title`: Optional section heading
- `description`: Optional section description
- `className`: Additional classes

**EnterpriseFormGrid:**
- `columns`: Number of columns (1, 2, 3)
- `className`: Additional classes

**EnterpriseFormActions:**
- `submitLabel`: Button text (default: "Submit")
- `cancelLabel`: Optional cancel button text
- `onCancel`: Cancel callback
- `isLoading`: Show loading on submit button

**Key Features:**
- Automatic form state management
- Built-in field validation with error display
- Required field indicators
- Help text and error messages
- Grid-based layout system
- Responsive field arrangement
- Disabled state support
- Loading state during submission

**Usage Example:**
```tsx
import {
  EnterpriseForm,
  EnterpriseFormField,
  EnterpriseFormSection,
  EnterpriseFormGrid,
  EnterpriseFormActions
} from '@/components/ui/enterprise';

<EnterpriseForm
  onSubmit={(values) => saveAccount(values)}
  initialValues={{ name: '', email: '', status: 'active' }}
>
  <EnterpriseFormSection title="Basic Information">
    <EnterpriseFormGrid columns={2}>
      <EnterpriseFormField
        name="name"
        label="Account Name"
        required
        placeholder="Enter account name"
      />
      <EnterpriseFormField
        name="email"
        label="Email Address"
        type="email"
        placeholder="user@example.com"
      />
    </EnterpriseFormGrid>
  </EnterpriseFormSection>

  <EnterpriseFormSection title="Additional Details">
    <EnterpriseFormField
      name="description"
      label="Description"
      type="textarea"
      placeholder="Enter account description"
    />
  </EnterpriseFormSection>

  <EnterpriseFormActions
    submitLabel="Save Account"
    onCancel={() => navigate('/accounts')}
  />
</EnterpriseForm>
```

### Import Pattern

All enterprise components can be imported from a single entry point:

```typescript
import {
  EnterpriseTable,
  EnterpriseCard,
  EnterpriseModal,
  EnterpriseHeader,
  EnterpriseButton,
  EnterpriseForm,
  EnterpriseFormField,
  EnterpriseFormSection,
  EnterpriseFormGrid,
  EnterpriseFormActions
} from '@/components/ui/enterprise';
```

### Design Consistency Principles

When using the new component library:

1. **Spacing**: Maintain `gap-4` or `gap-6` between major sections
2. **Typography**: Use `text-sm` for body content, `text-lg font-semibold` for section titles
3. **Colors**: Follow semantic colors for status indicators and interactive elements
4. **States**: Always provide loading, error, and empty states for data-driven components
5. **Accessibility**: Use ARIA labels and semantic HTML for form fields
6. **Responsiveness**: Stack components vertically on mobile (< md breakpoint)
7. **Consistency**: Use EnterpriseButton for all CTAs, EnterpriseCard for content grouping

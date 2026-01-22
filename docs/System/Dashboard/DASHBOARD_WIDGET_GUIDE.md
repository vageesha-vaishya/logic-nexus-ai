# Dashboard Widget Implementation Guide

This comprehensive guide details the implementation, usage, and maintenance of dashboard widgets in the SOS Logistics Pro platform. It covers the generic `WidgetContainer` wrapper and specific implementations like `StatsCards`.

## 1. Widget Setup

### Prerequisites & Dependencies
The dashboard widgets rely on the following libraries and internal components:

*   **UI Components:** `shadcn/ui` (Card, Button, Badge, Alert, Select)
*   **Icons:** `lucide-react`
*   **Charts:** `recharts`
*   **Localization:** `react-i18next`
*   **State Management:** React Hooks (`useState`, `useEffect`, `useMemo`)
*   **Data Access:** `ScopedDataAccess` (Supabase wrapper)

### Installation
Ensure the required components are present in your project structure:

```
src/
├── components/
│   ├── dashboard/
│   │   ├── WidgetContainer.tsx  # Generic wrapper
│   │   └── StatsCards.tsx       # KPI widget implementation
│   └── ui/                      # Base UI components
├── hooks/
│   └── useDashboardData.ts      # Data fetching logic
└── pages/
    └── dashboard/
        └── Dashboards.tsx       # Main dashboard page
```

### Configuration Parameters

#### `WidgetContainer` Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `title` | `ReactNode` | The title displayed in the widget header. |
| `action` | `ReactNode` | Optional action element (e.g., button, menu) in the header. |
| `children` | `ReactNode` | The main content of the widget. |
| `className` | `string` | Additional classes for the container card. |
| `contentClassName` | `string` | Additional classes for the content area. |

#### `StatsCards` Props
| Prop | Type | Description |
| :--- | :--- | :--- |
| `stats` | `StatItem[]` | Array of data objects for the cards. |
| `loading` | `boolean` | If true, displays skeleton loading state. |
| `className` | `string` | Optional CSS class for the grid container. |

#### `StatItem` Interface
| Property | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Unique identifier. |
| `title` | `string` | Metric title (localized). |
| `value` | `string` | Display value (e.g., "$1.2M"). |
| `change` | `string` | Trend value (e.g., "+8%"). |
| `trend` | `"up" \| "down"` | Direction of trend. |
| `icon` | `LucideIcon` | Icon component. |
| `color` | `string` | Tailwind text color class. |
| `data` | `{ value: number }[]` | Data points for sparkline. |
| `description` | `string` | Optional tooltip text. |
| `onClick` | `() => void` | Optional click handler. |

## 2. Core Functionality

### WidgetContainer
The `WidgetContainer` is a flexible wrapper designed to enforce consistent styling across all dashboard widgets. It leverages the `Card` component to provide a structured layout with a header and content body.

*   **Header:** standardized area for titles and action buttons (e.g., "View All", "Settings").
*   **Content:** Flexible area that accepts any React node, supporting lists, charts, or forms.
*   **Styling:** Fully customizable via `className` and `contentClassName` props, supporting Tailwind CSS.

### StatsCards (KPI Widget)
The `StatsCards` component renders a grid of key performance indicators.

*   **Visual Elements:**
    *   **Value:** Large, bold numerical display.
    *   **Trend:** Arrow icon (Up/Down) with color coding (Success/Destructive).
    *   **Sparkline:** Background area chart visualizing historical trend data.
    *   **Icon:** Contextual icon with a gradient background.
*   **Localization:** Built-in support for `t()` translation function.
*   **Responsiveness:** Adapts to grid layout (1 column on mobile, 2 on tablet, 4 on desktop).

### Interactive Elements
*   **Action Buttons:** Widgets can include interactive elements in the header (passed via `action` prop).
*   **List Items:** Content within widgets (like "My Leads") can be interactive (links to detail pages).
*   **Optimistic Updates:** The dashboard supports immediate UI updates for actions like reassigning activities, improving perceived performance.

## 3. Usage Scenarios

### Scenario A: Creating a New List Widget
To create a widget that displays a list of recent items (e.g., "Recent Shipments"):

```tsx
import { WidgetContainer } from '@/components/dashboard/WidgetContainer';
import { Button } from '@/components/ui/button';

export function RecentShipmentsWidget({ shipments }) {
  return (
    <WidgetContainer
      title="Recent Shipments"
      action={<Button variant="ghost" size="sm">View All</Button>}
    >
      <ul className="space-y-2">
        {shipments.map(shipment => (
          <li key={shipment.id} className="flex justify-between">
            <span>{shipment.id}</span>
            <span className="text-muted-foreground">{shipment.status}</span>
          </li>
        ))}
      </ul>
    </WidgetContainer>
  );
}
```

### Scenario B: Integrating Data Sources
Connect widgets to the `useDashboardData` hook or creating a custom hook for specific data needs.

```tsx
// src/pages/dashboard/Dashboards.tsx
const { myLeads, loading, error } = useDashboardData();

if (error) return <Alert variant="destructive">...</Alert>;

return (
  <WidgetContainer title="My Leads">
    {/* Render myLeads list */}
  </WidgetContainer>
);
```

### Best Practices
1.  **Parallel Data Fetching:** Use `Promise.all` in data hooks to prevent waterfalls.
2.  **Error Handling:** Always check for errors and display user-friendly alerts instead of crashing the widget.
3.  **Loading States:** Use skeleton loaders (like in `StatsCards`) to prevent layout shift during data load.
4.  **Scoped Access:** Ensure all data queries use `ScopedDataAccess` to respect tenant isolation.

## 4. Troubleshooting

### Common Issues

| Issue | Symptom | Solution |
| :--- | :--- | :--- |
| **Silent Data Failure** | Widgets are empty, no error message. | Check console logs. Ensure `useDashboardData` captures errors and `Dashboards.tsx` renders the `Alert` component. |
| **Invisible Charts** | Sparklines in `StatsCards` are not visible. | Ensure the parent `div` of `ResponsiveContainer` has a text color class (e.g., `text-primary`). |
| **Missing Data** | "My Leads" or "Activities" are empty. | Verify `context.userId` is available before fetching. Check RLS policies in Supabase. |
| **Layout Issues** | Widgets overlap or break on mobile. | Use `grid-cols-1 md:grid-cols-2` classes for responsive grid layouts. |

### Debugging Techniques
1.  **Console Logging:** The `ScopedDataAccess` class has debug logging for admin overrides.
2.  **Network Tab:** Inspect Supabase API calls to verify request headers and returned data structure.
3.  **React DevTools:** Check component props and context values (`DataAccessContext`) to ensure correct permissions are passed.

### Technical Support
For persistent issues, contact the Platform Engineering team or refer to the `docs/DASHBOARD_TROUBLESHOOTING.md` report.

## 5. Maintenance

### Update Procedures
1.  **Component Updates:** When modifying `WidgetContainer`, check all consuming pages (`Dashboards.tsx`, etc.) for regression.
2.  **Library Updates:** Test `recharts` updates carefully, as major versions often introduce breaking changes to chart components.

### Version Compatibility
*   **React:** 18+
*   **Recharts:** 2.x
*   **Supabase JS:** 2.x

### Upgrade Paths
*   **Adding New Stats:** Update the `StatItem` interface and the `defaultStats` array in `StatsCards.tsx`.
*   **New Widget Types:** Create new components that wrap `WidgetContainer` rather than extending `WidgetContainer` directly.

# Carrier Selection Module

## Overview
The Carrier Selection module provides a robust, searchable, and mode-aware interface for selecting transport carriers within the Quotation Composer. It is designed to handle multi-leg journeys where each leg may be operated by a different carrier.

## Components

### 1. `CarrierSelect`
A reusable Combobox component built on top of `shadcn/ui` primitives (`Popover`, `Command`).

**Features:**
- **Searchable**: Users can type to filter carriers by name.
- **Mode Filtering**: Automatically filters carriers based on the selected transport mode (Air, Ocean, Road, Rail).
- **Preferred Carriers**: Highlights preferred carriers at the top of the list.
- **SCAC Code Display**: Shows Standard Carrier Alpha Code (SCAC) for reference.
- **Keyboard Navigation**: Full support for arrow keys and Enter selection.

**Props:**
```typescript
interface CarrierSelectProps {
  mode?: string | null;           // Transport mode to filter by
  value?: string | null;          // Selected carrier ID
  onChange: (id: string | null, name?: string | null) => void;
  placeholder?: string;
  disabled?: boolean;
  showPreferred?: boolean;        // Whether to group preferred carriers
  className?: string;
  error?: boolean;                // Visual error state
}
```

### 2. `LegManager` Integration
The `LegManager` component integrates `CarrierSelect` into each leg row.

**Data Flow:**
1.  **User Action**: User adds a new leg or edits an existing one.
2.  **Mode Selection**: User selects a mode (e.g., "Ocean").
3.  **Carrier Fetching**: `CarrierSelect` calls `useCarriersByMode(mode)`.
4.  **Data Retrieval**: The hook fetches carrier data from Supabase via `get_all_carriers_grouped_by_mode` RPC.
5.  **Selection**: User selects a carrier.
6.  **State Update**: `LegManager` updates the `TransportLeg` object with both `carrier_id` and `carrier` (name).

## Data Architecture

### Database Schema
- **Table**: `carriers` (implied) or `carrier_master`
- **Fields**: `id`, `carrier_name`, `scac`, `mode`, `is_preferred`

### API / RPC
- **RPC**: `get_all_carriers_grouped_by_mode`
- **Response**: Array of carrier objects.

### Types
Updated `TransportLeg` interface to support structured carrier data:
```typescript
export interface TransportLeg {
    id: string;
    mode: 'air' | 'ocean' | 'road' | 'rail' | string;
    carrier?: string;       // Legacy/Display Name
    carrier_id?: string;    // Foreign Key / UUID
    // ...
}
```

## Error Handling & Validation
- **Network Errors**: `CarrierSelect` displays a red alert icon and "Failed to load carriers" message if the API call fails.
- **Empty States**: Shows "No carrier found" if search yields no results.
- **Validation**: `CarrierSelect` accepts an `error` prop to show a red border if validation fails (e.g., required field missing).

## Performance Optimization
- **Memoization**: Carrier lists are memoized based on the selected mode to prevent unnecessary re-renders.
- **Client-Side Filtering**: Uses efficient client-side filtering for instant search feedback (suitable for < 1000 carriers per mode).
- **Virtualization**: (Future Scope) If carrier lists exceed 1000 items, `Command` component can be virtualized.

## Testing
Unit tests cover:
- Rendering states (placeholder, selected value).
- Mode filtering logic.
- Interaction flows (open, search, select).
- Error handling display.

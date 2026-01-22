# Technical Implementation Specification: CRM & Kanban Optimization

This document serves as the comprehensive technical execution guide for the 4-phase roadmap outlined in [UX_RESEARCH_REPORT.md](file:///Users/vims/Downloads/Development%20Projects/Trae/SOS%20Logistics%20Pro/logic-nexus-ai/documentation/UX_RESEARCH_REPORT.md).

---

## Phase 1: UI Polish & Animation (Framer Motion)

### 1.1 Technical Audit & Component Analysis

#### Existing Components
*   **KanbanBoard (`src/components/kanban/KanbanBoard.tsx`)**: Main orchestrator.
*   **KanbanColumn (`src/components/kanban/KanbanColumn.tsx`)**: Drop zone container.
*   **KanbanCard (`src/components/kanban/KanbanCard.tsx`)**: Draggable item.

#### Visual Upgrades Required
| Component | Current State | Required Upgrade | Technical Impl |
|-----------|---------------|------------------|----------------|
| **Typography** | Standard Sans | **Inter Variable** with tabular nums for currency | Add `font-feature-settings: "tnum"` to currency class. |
| **Spacing** | `p-3` (12px) | **Density Toggle** (Comfortable: `p-4`, Compact: `p-2`) | Context provider `DensityContext` to pass spacing tokens. |
| **Shadows** | `shadow-sm` | **Dynamic Elevation** | `hover:shadow-lg`, `active:shadow-2xl` (during drag). |
| **Avatars** | Single Avatar | **Avatar Group** | Implement overlapping flex container with `z-index` stepping. |

### 1.2 Animation Strategy (Framer Motion)

#### Integration Points
1.  **Page Transitions**:
    *   **Goal**: Smooth entry when navigating to `LeadsPipeline`.
    *   **Impl**: Wrap `KanbanBoard` in `<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>`.
2.  **List Reordering (FLIP)**:
    *   **Goal**: Cards should slide into new positions rather than snapping.
    *   **Impl**: `KanbanCard` already uses `layoutId`. Ensure `KanbanColumn` list container is NOT `layout` animated to avoid conflicts with dnd-kit transform, or strictly limit `layout` scope to the Card wrapper.
3.  **Micro-interactions**:
    *   **Drag Tilt**:
        ```typescript
        // In KanbanCard.tsx
        const rotate = useMotionValue(0);
        const y = useMotionValue(0);
        // Map drag velocity to rotation
        useMotionValueEvent(y, "change", (latest) => {
           rotate.set(latest / 10);
        });
        ```

#### Performance & Accessibility
*   **Memoization**: Wrap `KanbanCard` in `React.memo(KanbanCard, (prev, next) => prev.item.id === next.item.id && prev.item.status === next.item.status)`.
*   **Reduced Motion**:
    ```typescript
    const shouldReduceMotion = useReducedMotion();
    const transition = shouldReduceMotion ? { duration: 0 } : { type: "spring" };
    ```
*   **ARIA**: Ensure `role="list"` on columns and `role="listitem"` on cards. `@dnd-kit` handles most ARIA attributes, but custom announcements for "Moved X to Y" should be verified.

### 1.3 Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Animation Jitter | Medium | Medium | Use `transform` only (no `top`/`left`). Use `will-change: transform` on active drag item. |
| Z-Index Wars | High | Low | Use React Portal for `DragOverlay` to ensure it's always on top. |

---

## Phase 2: Advanced Features (Inline Edit, Quick Filters)

### 2.1 Architecture Analysis

#### Inline Editing Pattern
*   **Dual-Mode Component**: `EditableText`
    *   **Props**: `value`, `onSave(newValue)`, `type` (text, currency, select).
    *   **State**: `isEditing` (bool), `tempValue` (string).
    *   **Events**: `onDoubleClick` (view -> edit), `onBlur` (save), `onKeyDown` (Enter=save, Esc=cancel).
*   **Validation**: Zod schema validation before calling `onSave`.

#### Filter System Architecture
*   **Client-Side vs Server-Side**:
    *   **Hybrid Approach**:
        *   **Search**: Client-side (fuse.js) for datasets < 1000 items. Server-side (Supabase `textSearch`) for > 1000.
        *   **Filtering**: Client-side for speed.
*   **State Management**:
    *   Migrate `activeFilters` state to **URL Search Params**.
    *   Benefit: Deep linking support.
    *   Impl: `const [searchParams, setSearchParams] = useSearchParams();`

### 2.2 Technical Requirements
*   **CRUD Operations**:
    *   Update: `supabase.from('leads').update({ [field]: value }).eq('id', id)`
    *   Optimistic Update: Update local React state immediately. Revert if Supabase promise fails.
*   **Debouncing**: Text search input must be debounced (300ms) to prevent excessive filtering re-calculations.

### 2.3 Complexity Estimates
*   **Inline Edit**: 3 Story Points (Low complexity, high reuse).
*   **Filter Engine**: 8 Story Points (Medium complexity, edge cases with composite filters).

---

## Phase 3: Real-time Sync & Optimistic UI

### 3.1 Data Flow Architecture

#### Supabase Realtime Integration
*   **Channel**: `room:leads` (or tenant-specific ID).
*   **Event Handling**:
    ```typescript
    const channel = supabase
      .channel('leads_board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, payload => {
          handleRealtimeEvent(payload);
      })
      .subscribe();
    ```

#### Synchronization Protocols
1.  **INSERT (New Lead)**:
    *   Action: Append to "New" column.
    *   Animation: Flash yellow background for 2s.
2.  **UPDATE (Status Change)**:
    *   Action: Move card to new column.
    *   Conflict: If local user is dragging *that specific card*, ignore remote move until drop. Show "Content Updated" toast.
3.  **DELETE**:
    *   Action: Remove from board.

### 3.2 Optimistic UI Patterns
*   **Mutation Strategy**:
    1.  **Capture Snapshot**: `const previousLeads = [...leads];`
    2.  **Apply Change**: `setLeads(newLeads);`
    3.  **Execute Request**: `await api.update(...)`
    4.  **Rollback (OnError)**: `setLeads(previousLeads); toast.error("Update failed");`

### 3.3 Dependencies
*   `@supabase/supabase-js` (Existing)
*   `sonner` or `react-hot-toast` for conflict notifications.

---

## Phase 4: Analytics Integration

### 4.1 Infrastructure Evaluation

#### Data Collection Strategy
*   **Event Granularity**:
    *   Track `lead_status_history` table:
        *   `lead_id` (UUID)
        *   `from_stage` (String)
        *   `to_stage` (String)
        *   `duration_seconds` (Integer) - Calculated via trigger or app logic.
        *   `changed_by` (UUID)

#### Visualization Requirements
*   **Dashboard Components**:
    *   **Velocity Chart**: Bar chart of average days per stage.
    *   **Bottleneck Indicator**:
        *   Logic: `Stage Duration > (Average + 2 * StdDev)`.
        *   UI: Red border on Column Header. Tooltip: "3 leads are stalling here."

### 4.2 Implementation Plan
1.  **Database**:
    *   Create `lead_history` table.
    *   Create Postgres Trigger `on_lead_status_change` to auto-insert history records.
2.  **Frontend**:
    *   New Component: `AnalyticsOverlay` (Modal or Slide-over).
    *   Library: `Recharts` (Lightweight, composable).

### 4.3 Success Metrics
*   **Performance**: Dashboard load time < 200ms (via materialized views for aggregation).
*   **Utility**: "Bottleneck detected" alerts result in user action 50% of the time.

---

## Testing & Validation Protocols

### Testing Matrix
| Phase | Unit Test | Integration Test | User Acceptance |
|-------|-----------|------------------|-----------------|
| **1. UI** | Snapshot tests for Card variants | Drag simulation in Cypress | "Does it feel smooth?" (60fps check) |
| **2. Features** | Validator function tests | Filter logic verification | "Can I share this view via URL?" |
| **3. Real-time** | Mock WebSocket payloads | Multi-tab sync test | "Did I lose data when internet cut out?" |
| **4. Analytics** | Math correctness for averages | Database trigger verification | "Is the bottleneck alert accurate?" |


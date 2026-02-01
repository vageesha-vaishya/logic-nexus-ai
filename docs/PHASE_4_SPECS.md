# Phase 4 Technical Specifications: Scale & History

## 1. Feature Selection & Rationale

### 1.1 Virtual Scrolling (Priority: High)
**Requirement**: Support for Quote Line Items > 500.
**Selected Library**: `react-window` + `react-virtualized-auto-sizer`.
**Rationale**: 
- Standard rendering of 500+ complex rows (inputs, dropdowns) causes significant DOM node overhead (2000+ nodes).
- Virtualization renders only visible items (approx 20-30), keeping memory usage constant O(1) regardless of list size.
**Target Metrics**:
- Initial Render Time: < 200ms
- Scroll FPS: 60fps

### 1.2 Price History Tracking (Priority: High)
**Requirement**: Complete audit trail for price changes.
**Implementation**: Uses `audit_logs` table with `audit_pricing_change` trigger on `services` and `service_pricing_tiers`.
**Rationale**:
- Leveraging existing centralized `audit_logs` table avoids schema fragmentation.
- Trigger-based capture ensures no application-layer bypass.

## 2. Database Schema

### 2.1 Audit Logs (Existing + Enhanced)
Table: `audit_logs`
- `id`: UUID (PK)
- `user_id`: UUID (FK to auth.users)
- `action`: TEXT (e.g., 'PRICING_UPDATE', 'PRICING_INSERT')
- `resource_type`: TEXT ('services', 'service_pricing_tiers')
- `resource_id`: UUID (FK to source table)
- `details`: JSONB (Stores `old_values`, `new_values`, `changed_fields`)
- `tenant_id`: UUID (FK to tenants)
- `created_at`: TIMESTAMPTZ

### 2.2 Performance Indexes
- `idx_audit_logs_resource_id_type`: Composite index on `(resource_id, resource_type)` for fast history lookups.
- `idx_audit_logs_created_at`: For time-based filtering.

## 3. API Endpoints

### 3.1 Get Service History
`GET /rpc/get_service_history`
**Parameters**:
- `p_service_id`: UUID
- `p_limit`: INTEGER (default 50)
- `p_offset`: INTEGER (default 0)
**Returns**:
- Array of audit log entries with user details expanded.

### 3.2 Get Pricing Tier History
`GET /rpc/get_tier_history`
**Parameters**:
- `p_tier_id`: UUID
**Returns**:
- Array of audit log entries.

## 4. Component Architecture

### 4.1 `ServiceHistoryPanel`
- **Props**: `serviceId: string`
- **State**: `history: AuditLog[]`, `loading: boolean`
- **Behavior**:
  - Fetches history on mount via RPC.
  - Subscribes to `audit_logs` realtime channel for live updates.
  - Displays timeline of changes (User X changed Price from A to B).

### 4.2 `VirtualQuoteLineItems`
- **Props**: `items: QuoteItem[]`, `onUpdate: (index, field, value) => void`
- **Structure**:
  - `AutoSizer`: Detects available height/width.
  - `FixedSizeList` (or `VariableSizeList` if row heights vary): Renders items.
  - `Row`: Memoized component to prevent unnecessary re-renders of off-screen rows.

## 5. Performance Benchmarks

| Metric | Target | Warning Threshold |
|--------|--------|-------------------|
| List Render (500 items) | < 100ms | > 200ms |
| Scroll Frame Rate | 60 FPS | < 30 FPS |
| History Fetch Latency | < 300ms | > 800ms |
| Memory Usage | < 50MB Heap | > 100MB Heap |

## 6. Deployment & Rollback

### 6.1 Deployment Steps
1. Apply Migration `20260201170000_audit_pricing_history.sql`.
2. Verify Triggers: Insert dummy service, check `audit_logs`.
3. Deploy Edge Functions (if any new ones added).
4. Deploy Frontend.

### 6.2 Rollback
- **Database**: `DROP TRIGGER trg_audit_services ON services; DROP TRIGGER trg_audit_service_pricing_tiers ON service_pricing_tiers;`
- **Frontend**: Revert to previous commit.

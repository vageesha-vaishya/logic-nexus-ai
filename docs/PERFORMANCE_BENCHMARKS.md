# Performance Benchmarks & Scaling Guidelines

## Baseline Benchmarks (Phase 1)

These benchmarks were established after implementing parallel data fetching and the `ScopedDataAccess` layer.

### Dashboard Load Performance
**Test Conditions:**
-   User with 50+ assigned leads and 50+ activities.
-   Network: 4G simulation (Fast 3G).

| Metric | Before Optimization | After Optimization (Parallel Fetch) | Improvement |
| :--- | :--- | :--- | :--- |
| **Time to First Byte (TTFB)** | ~100ms | ~100ms | 0% (Backend limit) |
| **First Contentful Paint (FCP)** | ~800ms | ~800ms | 0% |
| **Time to Interactive (TTI)** | ~2500ms | ~1200ms | **~52%** |
| **Data Load Completion** | ~1500ms (Sequential) | ~600ms (Parallel) | **~60%** |

*Note: The dramatic improvement in Data Load Completion is due to switching from sequential `await` calls to `Promise.all` in `useDashboardData.ts`.*

### Database Query Performance
**Test:** Fetching "My Leads" with `ScopedDataAccess` filters.
-   **Execution Time:** < 50ms (Indexed query on `owner_id`).
-   **Scalability:** Linear degradation expected up to 100k records without partitioning.

## Scaling Guidelines

### 1. Database Scaling
As the number of tenants grows, the `leads` and `activities` tables will grow significantly.

-   **Indexing Strategy:**
    -   Ensure indices exist on `tenant_id`, `franchise_id`, and `owner_id` for all major tables.
    -   Composite indices (e.g., `[tenant_id, status]`) may be needed for specific dashboard filters.
-   **Partitioning (Phase 3):**
    -   When a single table exceeds 10M rows, implement PostgreSQL declarative partitioning by `tenant_id`.

### 2. Frontend Scaling
-   **Pagination:** The current dashboard limits items to 6 (`.limit(6)`). This ensures consistent performance regardless of total dataset size.
-   **Bundle Size:**
    -   Current `main` bundle: ~250KB (Gzipped).
    -   Recharts adds ~100KB (parsed).
    -   *Recommendation:* Implement code splitting for the Dashboard route if it grows larger.

### 3. API Rate Limiting
Supabase applies rate limits. To avoid hitting them during high-concurrency events (e.g., Monday morning login spike):
-   **Caching:** Implement `stale-while-revalidate` caching strategies in React Query (Phase 2).
-   **Debouncing:** Ensure search inputs and rapid filters are debounced (300ms).

## Capacity Planning
-   **Current Capacity:** Supports ~500 concurrent users with current Supabase tier.
-   **Bottleneck:** Database CPU during complex analytical queries.
-   **Upgrade Trigger:** When average query time exceeds 200ms, upgrade database compute or implement read replicas.

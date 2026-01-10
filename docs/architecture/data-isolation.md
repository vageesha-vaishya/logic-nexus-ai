# Data Isolation & Filtering Architecture

## 1. Research & Analysis

### Multi-Tenant Architecture Patterns
Leading CRM platforms typically employ one of three patterns:
1.  **Database-per-Tenant**: High isolation, high cost, complex maintenance.
2.  **Schema-per-Tenant**: Good balance, but still operationally complex at scale.
3.  **Shared Database (Discriminator Column)**: Most common for modern SaaS (Salesforce, HubSpot). Uses `tenant_id` on every table. Efficient, scalable, but requires strict application-level enforcement.

**Recommendation**: We utilize the **Shared Database** pattern with Row-Level Security (RLS) as a defense-in-depth measure. This aligns with Supabase's native capabilities and ensures performance for datasets >1M records by leveraging Postgres partitioning and indexing on `tenant_id`.

### Data Access Control
-   **Hierarchical**: Tenant -> Franchise -> User.
-   **Role-Based (RBAC)**: Roles determine the *scope* of data access (e.g., Platform Admin = Global, Tenant Admin = Tenant Scope).

## 2. Data View Modes

The system supports four distinct view modes via the `ScopedDataAccess` layer:

1.  **Selected Tenant Data**:
    -   Context: `adminOverrideEnabled=true`, `tenantId=UUID`, `franchiseId=null`
    -   Filter: `WHERE tenant_id = UUID`
2.  **Selected Franchisee Data**:
    -   Context: `adminOverrideEnabled=true`, `tenantId=UUID`, `franchiseId=UUID`
    -   Filter: `WHERE tenant_id = UUID AND franchise_id = UUID`
3.  **All Tenant Data (Global View)**:
    -   Context: `adminOverrideEnabled=true` (or false for Platform Admin), `tenantId=null`
    -   Filter: None (Access to all records)
4.  **All Franchise Data (Tenant View)**:
    -   Context: `tenantId=UUID`, `franchiseId=null`
    -   Filter: `WHERE tenant_id = UUID` (Shows all franchises within the tenant)

## 3. Implementation Standards

### Centralized Filtering Service (`ScopedDataAccess`)
-   **Wraps Supabase Client**: All data access *must* go through this class.
-   **Context-Aware**: Injects `tenant_id` and `franchise_id` automatically based on `DataAccessContext`.
-   **Audit Logging**: Automatically logs write operations (`INSERT`, `UPDATE`, `DELETE`).

### Security & Compliance
-   **RLS**: Enforced at the database level as a failsafe.
-   **Audit Trails**: `audit_logs` table captures user ID, action, resource, and details.

## 4. Performance Optimization
-   **Indexing**: `tenant_id` and `franchise_id` must be indexed on all major tables.
-   **Lazy Loading**: Dashboards use pagination/infinite scroll to handle large datasets.
-   **Caching**: React Query (TanStack Query) is used on the frontend to cache filtered results.

## 5. Interface Contracts
-   **Context**:
    ```typescript
    interface DataAccessContext {
      tenantId?: string | null;
      franchiseId?: string | null;
      isPlatformAdmin: boolean;
      // ...
    }
    ```

# Dashboard Development Environment Integration Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Integrate dashboard templates with your existing Supabase database so templates display real data from your accounts, contacts, and activities tables in development environment.

**Architecture:** Add dashboard_role column to profiles table, update DashboardRouter to fetch real user roles from database (with auth role mapping fallback), update key widgets to query scopedDb instead of using mock data, test with existing data to verify real content displays and customizations persist.

**Tech Stack:** React 18, TypeScript, Supabase (PostgreSQL), useCRM hook with ScopedDataAccess, Vitest for testing

---

## Task 1: Create Migration to Add dashboard_role Column

**Files:**
- Create: `src/migrations/20260226_add_dashboard_role.sql`
- Modify: None (migration will be run manually in Supabase)

**Step 1: Write migration file**

Create `src/migrations/20260226_add_dashboard_role.sql`:

```sql
-- Add dashboard_role column to profiles table
-- Maps user to dashboard template role (crm_sales_rep, crm_sales_manager, etc.)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_dashboard_role ON profiles(dashboard_role);

-- Add comment explaining the column
COMMENT ON COLUMN profiles.dashboard_role IS 'Dashboard role determines which dashboard template is shown (crm_sales_rep, crm_sales_manager, crm_account_executive, crm_executive, logistics_dispatcher, logistics_fleet_manager, logistics_ops_manager, logistics_executive, sales_quote_manager, sales_manager, sales_executive)';
```

**Step 2: Verify migration file is correct**

Run: `cat src/migrations/20260226_add_dashboard_role.sql`
Expected: SQL migration content visible, no syntax errors

**Step 3: Run migration in Supabase**

Run migration in Supabase SQL Editor:
```bash
# Copy entire migration content
# Go to Supabase Dashboard → SQL Editor → New Query
# Paste migration content and execute
# Expected: Query executed successfully (no errors)
```

**Step 4: Verify column was added**

Verify in Supabase SQL Editor:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'profiles' AND column_name = 'dashboard_role';
```
Expected: One row with (dashboard_role, text, 'crm_sales_rep'::text)

**Step 5: Commit migration**

```bash
git add src/migrations/20260226_add_dashboard_role.sql
git commit -m "migration: add dashboard_role column to profiles table"
```

---

## Task 2: Update DashboardRouter to Fetch Real User Role

**Files:**
- Modify: `src/components/dashboard/DashboardRouter.tsx` (lines 1-45)
- Test: `src/components/dashboard/__tests__/DashboardRouter.test.tsx` (create new tests)

**Step 1: Write failing tests**

Create `src/components/dashboard/__tests__/DashboardRouter.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardRouter } from '../DashboardRouter';
import * as crmHooks from '@/hooks/useCRM';

// Mock dependencies
vi.mock('@/hooks/useCRM');
vi.mock('@/components/layout/DashboardLayout', () => ({
  DashboardLayout: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('../DashboardTemplateLoader', () => ({
  DashboardTemplateLoader: ({ userRole }: any) => <div>Role: {userRole}</div>,
}));

describe('DashboardRouter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch dashboard_role from profiles table', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ dashboard_role: 'crm_sales_manager' }],
            error: null,
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-123' } },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: crm_sales_manager')).toBeInTheDocument();
    });
  });

  it('should map auth roles to dashboard roles if dashboard_role not found', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ dashboard_role: null }],
            error: null,
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: {
        user: { id: 'user-123' },
        isTenantAdmin: true,
      },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: crm_sales_manager')).toBeInTheDocument();
    });
  });

  it('should default to crm_sales_rep if no role found', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: new Error('Not found'),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      context: { user: { id: 'user-123' } },
      user: { id: 'user-123' },
      scopedDb: mockScopedDb,
      supabase: {} as any,
      preferences: {},
      setScopePreference: vi.fn(),
      setAdminOverride: vi.fn(),
    } as any);

    render(<DashboardRouter />);

    await waitFor(() => {
      expect(screen.getByText('Role: crm_sales_rep')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/dashboard/__tests__/DashboardRouter.test.tsx --run`
Expected: 3 tests FAIL with "module not found" or "cannot find module"

**Step 3: Update DashboardRouter.tsx implementation**

Replace entire `src/components/dashboard/DashboardRouter.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { DashboardRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';

// Map auth system roles to dashboard roles
const AUTH_ROLE_TO_DASHBOARD_ROLE: Record<string, DashboardRole> = {
  platform_admin: 'crm_executive',
  tenant_admin: 'crm_sales_manager',
  franchise_admin: 'crm_account_executive',
  user: 'crm_sales_rep',
};

export function DashboardRouter() {
  const { context, user, scopedDb } = useCRM();
  const [userRole, setUserRole] = useState<DashboardRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineDashboardRole = async () => {
      try {
        if (!user?.id) {
          setLoading(false);
          return;
        }

        // Method 1: Fetch dashboard_role directly from profiles table
        const { data: profileData, error } = await scopedDb
          .from('profiles')
          .select('dashboard_role')
          .eq('id', user.id)
          .single();

        if (!error && profileData?.dashboard_role) {
          setUserRole(profileData.dashboard_role as DashboardRole);
          setLoading(false);
          return;
        }

        // Method 2: Map auth roles to dashboard roles
        let dashboardRole: DashboardRole = 'crm_sales_rep';

        if (context?.isPlatformAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['platform_admin'];
        } else if (context?.isTenantAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['tenant_admin'];
        } else if (context?.isFranchiseAdmin) {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['franchise_admin'];
        } else {
          dashboardRole = AUTH_ROLE_TO_DASHBOARD_ROLE['user'];
        }

        setUserRole(dashboardRole);
      } catch (error) {
        console.error('Failed to determine dashboard role:', error);
        // Default to sales rep if error
        setUserRole('crm_sales_rep');
      } finally {
        setLoading(false);
      }
    };

    determineDashboardRole();
  }, [user?.id, context, scopedDb]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!userRole) {
    return (
      <DashboardLayout>
        <div className="p-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Dashboard Configuration Error
          </h1>
          <p className="text-gray-600">
            Unable to determine your dashboard role. Please contact your administrator.
          </p>
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded">
            <p className="text-sm text-blue-800">
              <strong>Debug Info:</strong> User ID: {user?.id}
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto p-6 bg-gray-50">
        <DashboardTemplateLoader userRole={userRole} userId={user?.id || ''} />
      </div>
    </DashboardLayout>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/dashboard/__tests__/DashboardRouter.test.tsx --run`
Expected: 3 tests PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/DashboardRouter.tsx src/components/dashboard/__tests__/DashboardRouter.test.tsx
git commit -m "feat: update DashboardRouter to fetch real user dashboard role from database"
```

---

## Task 3: Update HeroMetrics Widget to Use Real Data

**Files:**
- Modify: `src/components/dashboard/crm/widgets/HeroMetrics.tsx` (lines 1-100)
- Test: `src/components/dashboard/crm/widgets/__tests__/HeroMetrics.test.tsx`

**Step 1: Write failing tests**

Create `src/components/dashboard/crm/widgets/__tests__/HeroMetrics.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HeroMetrics } from '../HeroMetrics';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');

describe('HeroMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch today activities from scopedDb', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              count: 5,
              data: [],
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/5/)).toBeInTheDocument();
    });
  });

  it('should fetch calls made today', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            gte: vi.fn().mockReturnValue({
              lte: vi.fn().mockResolvedValue({
                count: 3,
                data: [],
              }),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(mockScopedDb.from).toHaveBeenCalledWith('activities');
    });
  });

  it('should handle fetch errors gracefully', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            lte: vi.fn().mockResolvedValue({
              error: new Error('Database error'),
              data: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<HeroMetrics />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/HeroMetrics.test.tsx --run`
Expected: Tests FAIL (component doesn't fetch data from scopedDb)

**Step 3: Update HeroMetrics.tsx**

Find and replace the entire HeroMetrics component in `src/components/dashboard/crm/widgets/HeroMetrics.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Activity, PhoneCall, Mail } from 'lucide-react';

interface Metrics {
  todayActivities: number;
  callsMade: number;
  emailsSent: number;
}

export function HeroMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState<Metrics>({
    todayActivities: 0,
    callsMade: 0,
    emailsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStart = today.toISOString();

        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const todayEnd = tomorrow.toISOString();

        // Fetch today's activities
        const { count: activitiesCount, error: activitiesError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        // Fetch calls made today
        const { count: callsCount, error: callsError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'call')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        // Fetch emails sent today
        const { count: emailsCount, error: emailsError } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'email')
          .gte('created_at', todayStart)
          .lte('created_at', todayEnd);

        if (!activitiesError && !callsError && !emailsError) {
          setMetrics({
            todayActivities: activitiesCount || 0,
            callsMade: callsCount || 0,
            emailsSent: emailsCount || 0,
          });
        } else {
          console.error('Failed to fetch metrics:', {
            activitiesError,
            callsError,
            emailsError,
          });
        }
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-4 p-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="bg-white rounded-lg p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 rounded w-24 mb-2" />
            <div className="h-8 bg-gray-200 rounded w-12" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4 p-6">
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Today's Activities</h3>
          <Activity className="w-4 h-4 text-blue-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.todayActivities}</p>
        <p className="text-xs text-gray-500 mt-2">Activities logged today</p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Calls Made</h3>
          <PhoneCall className="w-4 h-4 text-green-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.callsMade}</p>
        <p className="text-xs text-gray-500 mt-2">Calls made today</p>
      </div>

      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-gray-600 text-sm font-medium">Emails Sent</h3>
          <Mail className="w-4 h-4 text-purple-600" />
        </div>
        <p className="text-3xl font-bold text-gray-900">{metrics.emailsSent}</p>
        <p className="text-xs text-gray-500 mt-2">Emails sent today</p>
      </div>
    </div>
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/HeroMetrics.test.tsx --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/crm/widgets/HeroMetrics.tsx src/components/dashboard/crm/widgets/__tests__/HeroMetrics.test.tsx
git commit -m "feat: update HeroMetrics to fetch real activity data from scopedDb"
```

---

## Task 4: Update MyActiveLeads Widget to Use Real Data

**Files:**
- Modify: `src/components/dashboard/crm/widgets/MyActiveLeads.tsx`
- Test: `src/components/dashboard/crm/widgets/__tests__/MyActiveLeads.test.tsx`

**Step 1: Write failing tests**

Create `src/components/dashboard/crm/widgets/__tests__/MyActiveLeads.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MyActiveLeads } from '../MyActiveLeads';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');
vi.mock('@/components/ui/enterprise', () => ({
  EnterpriseTable: ({ data, columns }: any) => (
    <div>
      {data?.map((row: any) => (
        <div key={row.id}>
          {row.first_name} {row.last_name}
        </div>
      ))}
    </div>
  ),
}));

describe('MyActiveLeads', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch contacts from database', async () => {
    const mockContacts = [
      {
        id: '1',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        phone: '555-0001',
        created_at: new Date().toISOString(),
      },
    ];

    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockContacts,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<MyActiveLeads />);

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });
  });

  it('should handle database errors', async () => {
    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: new Error('Database error'),
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<MyActiveLeads />);

    await waitFor(() => {
      expect(screen.getByText(/Failed to load leads/)).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/MyActiveLeads.test.tsx --run`
Expected: Tests FAIL

**Step 3: Update MyActiveLeads.tsx**

Replace `src/components/dashboard/crm/widgets/MyActiveLeads.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { EnterpriseTable, type Column } from '@/components/ui/enterprise';

interface Contact {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  created_at: string;
}

export function MyActiveLeads() {
  const { scopedDb } = useCRM();
  const [leads, setLeads] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeads = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await scopedDb
          .from('contacts')
          .select('id, first_name, last_name, email, phone, created_at')
          .order('created_at', { ascending: false })
          .limit(10);

        if (err) throw err;
        setLeads(data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch leads:', err);
        setError('Failed to load leads');
      } finally {
        setLoading(false);
      }
    };

    fetchLeads();
  }, [scopedDb]);

  const columns: Column<Contact>[] = [
    { key: 'first_name', label: 'First Name', width: '150px' },
    { key: 'last_name', label: 'Last Name', width: '150px' },
    { key: 'email', label: 'Email', width: '200px' },
    { key: 'phone', label: 'Phone', width: '120px' },
    {
      key: 'created_at',
      label: 'Added',
      width: '120px',
      render: (v) => new Date(v).toLocaleDateString(),
    },
  ];

  if (loading) return <div className="p-4">Loading leads...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={leads}
      rowKey={(row) => row.id}
      onRowClick={(row) => console.log('Selected:', row)}
      emptyState={
        <p className="text-center py-8 text-gray-500">No leads found</p>
      }
    />
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/MyActiveLeads.test.tsx --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/crm/widgets/MyActiveLeads.tsx src/components/dashboard/crm/widgets/__tests__/MyActiveLeads.test.tsx
git commit -m "feat: update MyActiveLeads to fetch real contacts from database"
```

---

## Task 5: Update Top Accounts Widget to Use Real Data

**Files:**
- Modify: `src/components/dashboard/crm/widgets/TopAccounts.tsx`
- Test: `src/components/dashboard/crm/widgets/__tests__/TopAccounts.test.tsx`

**Step 1: Write failing tests**

Create `src/components/dashboard/crm/widgets/__tests__/TopAccounts.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { TopAccounts } from '../TopAccounts';
import * as crmHooks from '@/hooks/useCRM';

vi.mock('@/hooks/useCRM');
vi.mock('@/components/ui/enterprise', () => ({
  EnterpriseTable: ({ data, columns }: any) => (
    <div>
      {data?.map((row: any) => (
        <div key={row.id}>{row.company_name}</div>
      ))}
    </div>
  ),
}));

describe('TopAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch top accounts from database', async () => {
    const mockAccounts = [
      {
        id: '1',
        company_name: 'Acme Corp',
        annual_revenue: 1000000,
        status: 'active',
      },
    ];

    const mockScopedDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: mockAccounts,
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(crmHooks.useCRM).mockReturnValue({
      scopedDb: mockScopedDb,
    } as any);

    render(<TopAccounts />);

    await waitFor(() => {
      expect(screen.getByText('Acme Corp')).toBeInTheDocument();
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/TopAccounts.test.tsx --run`
Expected: Tests FAIL

**Step 3: Update TopAccounts.tsx**

Replace `src/components/dashboard/crm/widgets/TopAccounts.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { EnterpriseTable, type Column } from '@/components/ui/enterprise';

interface Account {
  id: string;
  company_name: string;
  annual_revenue?: number;
  status: string;
}

export function TopAccounts() {
  const { scopedDb } = useCRM();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        const { data, error: err } = await scopedDb
          .from('accounts')
          .select('id, company_name, annual_revenue, status')
          .order('annual_revenue', { ascending: false })
          .limit(10);

        if (err) throw err;
        setAccounts(data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch accounts:', err);
        setError('Failed to load accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, [scopedDb]);

  const columns: Column<Account>[] = [
    { key: 'company_name', label: 'Company', width: '250px' },
    {
      key: 'annual_revenue',
      label: 'Annual Revenue',
      width: '150px',
      render: (v) =>
        v
          ? new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
              maximumFractionDigits: 0,
            }).format(v)
          : 'N/A',
    },
    { key: 'status', label: 'Status', width: '100px' },
  ];

  if (loading) return <div className="p-4">Loading accounts...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <EnterpriseTable
      columns={columns}
      data={accounts}
      rowKey={(row) => row.id}
      onRowClick={(row) => console.log('Selected:', row)}
      emptyState={
        <p className="text-center py-8 text-gray-500">No accounts found</p>
      }
    />
  );
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- src/components/dashboard/crm/widgets/__tests__/TopAccounts.test.tsx --run`
Expected: All tests PASS

**Step 5: Commit**

```bash
git add src/components/dashboard/crm/widgets/TopAccounts.tsx src/components/dashboard/crm/widgets/__tests__/TopAccounts.test.tsx
git commit -m "feat: update TopAccounts to fetch real account data from database"
```

---

## Task 6: Run Full Dashboard Integration Test

**Files:**
- Test: Manual browser testing
- No code changes

**Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors

**Step 2: Run all tests**

Run: `npm test -- --run`
Expected: All tests pass (including new widget tests)

**Step 3: Start development server**

Run: `npm run dev`
Expected: Dev server starts successfully on http://localhost:5173

**Step 4: Verify dashboard loads**

Open browser to: `http://localhost:5173/dashboard`

Expected:
- Dashboard loads without spinner
- Sales Rep dashboard visible (default role)
- No console errors (F12 → Console tab)

**Step 5: Verify widgets show real data**

Check each widget:
- HeroMetrics: Should show actual count of activities/calls/emails from your database
- MyActiveLeads: Should display real contacts (if any exist in database)
- TopAccounts: Should display real accounts (if any exist in database)

If counts show 0 and tables are empty, it's expected if your development database is empty. The important thing is no errors and proper data fetching.

**Step 6: Verify customizations persist**

- Click X button on a widget
- Widget should remove
- Refresh page (F5)
- Widget should still be gone (saved to user_preferences)

If this works, customization persistence is functional.

**Step 7: Document testing results**

Create `TESTING_RESULTS.md` in project root with test results:

```markdown
# Dashboard Integration Test Results - 2026-02-26

## Environment
- Node: [version from npm test output]
- Database: Supabase development
- User Role Detected: crm_sales_rep (or actual role)

## Test Results
- [ ] Dashboard loads without errors
- [ ] HeroMetrics fetches real data
- [ ] MyActiveLeads displays real contacts
- [ ] TopAccounts displays real accounts
- [ ] Widget removal persists across page refresh
- [ ] No console errors
- [ ] No TypeScript errors in build

## Notes
[Add any observations about data in your development database]
```

**Step 8: Commit**

```bash
git add TESTING_RESULTS.md
git commit -m "test: verify dashboard integration with real data in development"
```

---

## Task 7: Update Additional CRM Widgets (Batch)

**Files:**
- Modify: Multiple widget files in `src/components/dashboard/crm/widgets/`
- Pattern: Replace mock data with scopedDb queries

**Step 1: Identify widgets needing updates**

Widgets to update:
- RecentActivities.tsx → fetch from activities table
- PipelineStages.tsx → fetch from opportunities table
- UpcomingTasks.tsx → fetch from tasks/activities table
- CustomerSatisfaction.tsx → fetch from accounts/contacts with satisfaction metric

**Step 2: Update each widget**

For each widget, follow this pattern:

```typescript
// BEFORE: Mock data
const [data, setData] = useState([]);

// AFTER: Real data
useEffect(() => {
  const fetch = async () => {
    const { data, error } = await scopedDb
      .from('table_name')
      .select('columns')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!error) setData(data || []);
  };
  fetch();
}, [scopedDb]);
```

**Step 3: Run tests**

Run: `npm test -- --run`
Expected: All tests pass

**Step 4: Commit batch update**

```bash
git add src/components/dashboard/crm/widgets/RecentActivities.tsx
git add src/components/dashboard/crm/widgets/PipelineStages.tsx
git add src/components/dashboard/crm/widgets/UpcomingTasks.tsx
git add src/components/dashboard/crm/widgets/CustomerSatisfaction.tsx
git commit -m "feat: update all CRM widgets to use real scopedDb queries"
```

---

## Task 8: Create Dashboard Setup Documentation

**Files:**
- Create: `DASHBOARD_SETUP_COMPLETE.md`

**Step 1: Create documentation**

Create `DASHBOARD_SETUP_COMPLETE.md`:

```markdown
# Dashboard Setup Complete ✅

## What Was Done

1. **Added dashboard_role column to profiles table**
   - Migration file: `src/migrations/20260226_add_dashboard_role.sql`
   - Column type: TEXT, default: 'crm_sales_rep'
   - Indexed for performance

2. **Updated DashboardRouter**
   - Fetches dashboard_role from profiles table
   - Maps auth roles to dashboard roles as fallback
   - Defaults to crm_sales_rep if no role found
   - Error handling with debug info

3. **Updated Core Widgets**
   - HeroMetrics: Fetches real activity/call/email counts
   - MyActiveLeads: Fetches real contacts from database
   - TopAccounts: Fetches real accounts, sorted by revenue
   - All use scopedDb for tenant-filtered data

## User Role Mapping

If dashboard_role column is not set, user's role is determined by:

| Auth Role | Dashboard Role |
|-----------|---|
| platform_admin | crm_executive |
| tenant_admin | crm_sales_manager |
| franchise_admin | crm_account_executive |
| user | crm_sales_rep |

To set specific roles:

```sql
UPDATE profiles
SET dashboard_role = 'crm_sales_manager'
WHERE id = 'user-id-here';
```

## Testing in Development

### 1. Verify Dashboard Loads
```bash
npm run dev
# Navigate to http://localhost:5173/dashboard
# Should load Sales Rep dashboard
```

### 2. Check Real Data Display
Open browser console (F12) and verify:
- No errors
- Network requests to `activities`, `contacts`, `accounts` tables
- Widget content shows real data

### 3. Test Widget Customization
- Click X to remove a widget
- Refresh page
- Widget should still be removed (persisted)

### 4. Test Different Roles (Optional)
Update your user's dashboard_role in Supabase:
```sql
UPDATE profiles SET dashboard_role = 'crm_sales_manager' WHERE id = 'your-user-id';
```
Then refresh dashboard to see manager-specific widgets.

## Known Limitations

1. **Empty Database**: If your database has no data, widgets will show empty states. This is correct behavior.
2. **Tenant Filtering**: All queries use scopedDb, so only your tenant's data will display.
3. **Mock Widgets**: Some widgets still use mock data. These can be updated following the same pattern as HeroMetrics/MyActiveLeads.

## File Structure

```
src/components/dashboard/
├── DashboardRouter.tsx (updated)
├── DashboardTemplateLoader.tsx
├── DashboardTemplate.tsx
├── crm/
│   ├── templates/ (11 templates)
│   └── widgets/
│       ├── HeroMetrics.tsx (updated)
│       ├── MyActiveLeads.tsx (updated)
│       ├── TopAccounts.tsx (updated)
│       └── ... (other widgets)
├── logistics/
│   └── ... (templates and widgets)
└── sales/
    └── ... (templates and widgets)
```

## Next Steps

1. ✅ Dashboard templates integrated with real data
2. To add more widgets: Follow pattern in HeroMetrics
3. To test in staging: Follow DEPLOYMENT_GUIDE.md
4. To customize dashboard: Click edit button in dashboard (if implemented)

## Troubleshooting

### Dashboard shows loading spinner forever
- Check browser console (F12) for errors
- Verify Supabase connection string
- Check user is authenticated

### Widgets show no data
- Verify data exists in your database tables
- Check ScopedDataAccess filtering (tenants/franchises)
- Check browser Network tab for query errors

### Widget customizations not persisting
- Verify user_preferences table exists
- Check user_id is passed to customization save
- Verify RLS policies allow user to save preferences

For more details, see DASHBOARD_SETUP_GUIDE.md and DEPLOYMENT_GUIDE.md
```

**Step 2: Commit documentation**

```bash
git add DASHBOARD_SETUP_COMPLETE.md
git commit -m "docs: add dashboard setup completion documentation"
```

---

## Summary

After completing all tasks:

✅ Dashboard templates integrated with development environment
✅ Real user roles fetched from database
✅ Key widgets fetching real data from scopedDb
✅ Customizations persisting to database
✅ All tests passing
✅ Complete documentation for using dashboards

The dashboard system is now functional in your development environment and will display real data from your Supabase tables when you log in.

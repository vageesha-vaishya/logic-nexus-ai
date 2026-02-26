# Dashboard Templates - Development Setup Guide

## Problem
Dashboard templates are not showing with existing data because:
1. DashboardRouter is hardcoded to `'crm_sales_rep'`
2. No mapping between auth roles and dashboard roles
3. Widgets use mock data instead of real database queries

## Solution Overview
This guide walks through setting up the dashboard templates to work with your existing data in development.

---

## Step 1: Add Dashboard Role to Your User System

### Option A: Add to existing `profiles` or `users` table (Recommended)

```sql
-- Add dashboard_role column to your users table
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Or if you have a profiles table:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

-- Example values:
-- crm_sales_rep, crm_sales_manager, crm_account_executive, crm_executive
-- logistics_dispatcher, logistics_fleet_manager, logistics_ops_manager, logistics_executive
-- sales_quote_manager, sales_manager, sales_executive
```

### Option B: Create a mapping table

```sql
-- Create a table to map auth roles to dashboard roles
CREATE TABLE IF NOT EXISTS role_dashboard_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_role TEXT NOT NULL UNIQUE,
  dashboard_role TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Populate with mappings
INSERT INTO role_dashboard_mapping (auth_role, dashboard_role) VALUES
  ('platform_admin', 'crm_executive'),
  ('tenant_admin', 'crm_sales_manager'),
  ('franchise_admin', 'crm_account_executive'),
  ('user', 'crm_sales_rep');

-- Query it:
SELECT dashboard_role FROM role_dashboard_mapping
WHERE auth_role = 'tenant_admin';
```

---

## Step 2: Update DashboardRouter to Use Real User Roles

Replace `src/components/dashboard/DashboardRouter.tsx`:

```typescript
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { DashboardTemplateLoader } from './DashboardTemplateLoader';
import { DashboardRole } from '@/types/dashboardTemplates';
import { useCRM } from '@/hooks/useCRM';
import { supabase } from '@/integrations/supabase/client';

export function DashboardRouter() {
  const { context, user } = useCRM();
  const [userRole, setUserRole] = useState<DashboardRole | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineDashboardRole = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }

      try {
        // Method 1: Fetch dashboard_role directly from profiles table
        const { data: profileData } = await supabase
          .from('profiles')
          .select('dashboard_role')
          .eq('id', user.id)
          .single();

        if (profileData?.dashboard_role) {
          setUserRole(profileData.dashboard_role as DashboardRole);
          setLoading(false);
          return;
        }

        // Method 2: Map auth roles to dashboard roles
        // Get the user's auth role from useCRM context
        const authRoles = context?.userRole || 'user'; // Adjust based on your auth system

        const roleMapping: Record<string, DashboardRole> = {
          'platform_admin': 'crm_executive',
          'tenant_admin': 'crm_sales_manager',
          'franchise_admin': 'crm_account_executive',
          'user': 'crm_sales_rep',
        };

        const dashboardRole = roleMapping[authRoles] || 'crm_sales_rep';
        setUserRole(dashboardRole as DashboardRole);

      } catch (error) {
        console.error('Failed to determine dashboard role:', error);
        // Default to sales rep if error
        setUserRole('crm_sales_rep' as DashboardRole);
      } finally {
        setLoading(false);
      }
    };

    determineDashboardRole();
  }, [user?.id, context]);

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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Dashboard Configuration Error</h1>
          <p className="text-gray-600">Unable to determine your dashboard role. Please contact your administrator.</p>
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

---

## Step 3: Connect Widgets to Real Data

Update each widget to fetch real data instead of using mocks. Example: `HeroMetrics.tsx`

### BEFORE (Mock Data):
```typescript
const [metrics, setMetrics] = useState({
  todayActivities: 0,
  callsMade: 0,
  emailsSent: 0,
});

// Hardcoded data - not real
```

### AFTER (Real Data):
```typescript
import { useCRM } from '@/hooks/useCRM';

export function HeroMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState({
    todayActivities: 0,
    callsMade: 0,
    emailsSent: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];

        // Fetch today's activities
        const { count: activitiesCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', `${today}T00:00:00`)
          .lte('created_at', `${today}T23:59:59`);

        // Fetch calls
        const { count: callsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'call')
          .gte('created_at', `${today}T00:00:00`);

        // Fetch emails
        const { count: emailsCount } = await scopedDb
          .from('activities')
          .select('*', { count: 'exact', head: true })
          .eq('type', 'email')
          .gte('created_at', `${today}T00:00:00`);

        setMetrics({
          todayActivities: activitiesCount || 0,
          callsMade: callsCount || 0,
          emailsSent: emailsCount || 0,
        });
      } catch (error) {
        console.error('Failed to fetch metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  if (loading) {
    return <div className="animate-pulse">Loading metrics...</div>;
  }

  // Render with real data...
}
```

---

## Step 4: Update Key Widgets for Real Data

### MyActiveLeads.tsx
```typescript
// CHANGE FROM:
const [leads, setLeads] = useState<any[]>([]);

// CHANGE TO:
useEffect(() => {
  const fetchLeads = async () => {
    const { data } = await scopedDb
      .from('contacts')
      .select('id, first_name, last_name, email, phone, created_at')
      .limit(10);
    setLeads(data || []);
  };
  fetchLeads();
}, [scopedDb]);
```

### Other Dashboards
Do the same for other key widgets in:
- `src/components/dashboard/crm/widgets/*`
- `src/components/dashboard/logistics/widgets/*`
- `src/components/dashboard/sales/widgets/*`

**Quick replacements:**
- `scopedDb.from('contacts').select(...)` - Get contacts
- `scopedDb.from('accounts').select(...)` - Get accounts
- `scopedDb.from('activities').select(...)` - Get activities
- `scopedDb.from('opportunities').select(...)` - Get opportunities

---

## Step 5: Test in Development

### Test 1: Verify Dashboard Loads

```bash
# Start dev server
npm run dev

# Navigate to dashboard
# Should see: Sales Rep dashboard (or your mapped role)
```

Check browser console (F12) for errors.

### Test 2: Verify Role Detection

Add console logging to see what role is detected:

```typescript
// In DashboardRouter.tsx, add after setUserRole:
console.log('Dashboard role determined:', userRole);
console.log('User ID:', user?.id);
```

### Test 3: Verify Data Loads

Check browser Network tab (F12):
- Should see database queries being made
- Activities, contacts, accounts should be fetched
- No 500 errors

### Test 4: Test Different Roles

Manually test different roles:

```typescript
// Temporarily in DashboardRouter.tsx:
setUserRole('crm_sales_manager' as DashboardRole); // Test manager dashboard
setUserRole('logistics_dispatcher' as DashboardRole); // Test logistics
setUserRole('sales_quote_manager' as DashboardRole); // Test sales
```

Each should show different widgets and data.

---

## Step 6: Add Dashboard Role Field to Your Database

If you're using Option A (dashboard_role column):

```bash
# SSH to your database and run:
psql your_database_name

# Then execute:
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dashboard_role TEXT DEFAULT 'crm_sales_rep';

# Update your user's role:
UPDATE profiles SET dashboard_role = 'crm_sales_manager' WHERE id = 'your-user-id';
```

Or use Supabase Dashboard:
1. Go to Table Editor
2. Open `profiles` table
3. Add new column: `dashboard_role` (text)
4. Update rows with appropriate roles

---

## Step 7: Troubleshooting

### Issue: Dashboard shows loading spinner forever

**Solution:** Check browser console (F12 → Console)
- Verify user is logged in
- Check if there are any CORS errors
- Verify Supabase connection

### Issue: Widgets show no data

**Solution:**
1. Check Network tab (F12) - are database queries being made?
2. Check if data exists in your database tables
3. Verify ScopedDataAccess filters aren't excluding all data
4. Check browser console for errors

### Issue: Wrong role showing

**Solution:**
1. Add console.log to see what role is being detected
2. Verify `profiles.dashboard_role` is set correctly
3. Check role mapping in code is correct
4. Restart dev server after database changes

### Issue: Database queries failing

**Solution:**
1. Check RLS policies - make sure user can read tables
2. Verify table names are correct (case-sensitive)
3. Check column names match your schema
4. Verify user's tenant/franchise matches data scoping

---

## Summary Checklist

- [ ] Added `dashboard_role` column to your user/profiles table
- [ ] Updated `DashboardRouter.tsx` to fetch real user role
- [ ] Set dashboard role for at least one test user
- [ ] Updated key widgets to fetch real data from scopedDb
- [ ] Started dev server and tested dashboard loading
- [ ] Verified data displays from your database
- [ ] Tested role switching (different dashboards)
- [ ] Checked browser console - no errors
- [ ] Tested widget interactions (remove, resize)
- [ ] Verified customizations persist to database

---

## Next Steps

1. ✅ Complete checklist above
2. ✅ Test each dashboard template with real data
3. ✅ Verify performance with your data volume
4. ✅ Add any custom widgets specific to your business logic
5. ✅ Set up monitoring in development
6. ✅ Plan deployment to production

---

## Example Complete Widget Code

Here's a complete example of updating a widget:

```typescript
// src/components/dashboard/crm/widgets/MyActiveLeads.tsx
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
      render: (v) => new Date(v).toLocaleDateString()
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
      emptyState={<p className="text-center py-8 text-gray-500">No leads found</p>}
    />
  );
}
```

---

## Questions?

If you encounter issues:
1. Check browser console (F12) for error messages
2. Check Supabase logs for database errors
3. Verify your table names and column names match
4. Confirm user has proper RLS permissions
5. Test with direct database query to ensure data exists

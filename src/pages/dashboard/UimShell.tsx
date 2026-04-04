import { Link, useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  UimAnalyticsForm,
  UimIssueConsumeForm,
  UimItemMasterForm,
  UimLocationsForm,
  UimOverviewForm,
  UimReservationsForm,
  UimRestockForm,
  UimStockLedgerForm,
} from '@/modules/uim/forms';

type UimRouteConfig = {
  key: string;
  path: string;
  title: string;
  description: string;
  phase: string;
  status: string;
};

const UIM_ROUTES: UimRouteConfig[] = [
  {
    key: 'home',
    path: '/dashboard/uim',
    title: 'UIM Overview',
    description: 'Phase-1 shell for Unified Inventory Module navigation and rollout checkpoints.',
    phase: 'Phase 1',
    status: 'active',
  },
  {
    key: 'item-master',
    path: '/dashboard/uim/item-master',
    title: 'Item Master',
    description: 'Catalog management shell placeholder for SKU/part definitions.',
    phase: 'Phase 2',
    status: 'placeholder',
  },
  {
    key: 'stock-ledger',
    path: '/dashboard/uim/stock-ledger',
    title: 'Stock Ledger',
    description: 'Immutable event timeline shell placeholder for inventory history.',
    phase: 'Phase 2',
    status: 'placeholder',
  },
  {
    key: 'reservations',
    path: '/dashboard/uim/reservations',
    title: 'Reservation Engine',
    description: 'Reservation workflow shell placeholder for active/fulfilled/cancelled lifecycle views.',
    phase: 'Phase 2-3',
    status: 'placeholder',
  },
  {
    key: 'issue-consume',
    path: '/dashboard/uim/issue-consume',
    title: 'Physical Issue/Consume',
    description: 'Technician/ops execution shell placeholder for issue and consume commands.',
    phase: 'Phase 3',
    status: 'placeholder',
  },
  {
    key: 'restock',
    path: '/dashboard/uim/restock',
    title: 'Dynamic Restock',
    description: 'Restock signal shell placeholder for threshold evaluation and dispatch.',
    phase: 'Phase 3-4',
    status: 'placeholder',
  },
  {
    key: 'locations',
    path: '/dashboard/uim/locations',
    title: 'Location Registry',
    description: 'Transfer and location mapping shell placeholder for inventory movement controls.',
    phase: 'Phase 3',
    status: 'placeholder',
  },
  {
    key: 'analytics',
    path: '/dashboard/uim/analytics',
    title: 'Inventory Analytics',
    description: 'KPI and reporting shell placeholder for inventory insights.',
    phase: 'Phase 4',
    status: 'placeholder',
  },
];

function getRouteForPath(pathname: string): UimRouteConfig {
  return UIM_ROUTES.find((route) => route.path === pathname) || UIM_ROUTES[0];
}

function getFormForPath(pathname: string) {
  if (pathname === '/dashboard/uim/item-master') return <UimItemMasterForm />;
  if (pathname === '/dashboard/uim/stock-ledger') return <UimStockLedgerForm />;
  if (pathname === '/dashboard/uim/reservations') return <UimReservationsForm />;
  if (pathname === '/dashboard/uim/issue-consume') return <UimIssueConsumeForm />;
  if (pathname === '/dashboard/uim/restock') return <UimRestockForm />;
  if (pathname === '/dashboard/uim/locations') return <UimLocationsForm />;
  if (pathname === '/dashboard/uim/analytics') return <UimAnalyticsForm />;
  return <UimOverviewForm />;
}

export default function UimShell() {
  const location = useLocation();
  const activeRoute = getRouteForPath(location.pathname);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Unified Inventory Module</h1>
          <p className="text-muted-foreground">
            Front-end shell and route placeholders aligned to the UIM implementation roadmap.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{activeRoute.title}</CardTitle>
            <CardDescription>{activeRoute.description}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">Route: {activeRoute.path}</Badge>
            <Badge variant="outline">Target: {activeRoute.phase}</Badge>
            <Badge variant={activeRoute.status === 'active' ? 'default' : 'outline'}>
              Status: {activeRoute.status}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>UIM Placeholder Routes</CardTitle>
            <CardDescription>
              These routes are intentionally scaffolded for incremental delivery without replacing the base dashboard shell.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 md:grid-cols-2">
            {UIM_ROUTES.map((route) => {
              const isActive = route.path === activeRoute.path;
              return (
                <Link
                  key={route.key}
                  to={route.path}
                  className={`rounded-md border p-3 transition-colors ${
                    isActive ? 'border-primary bg-primary/5' : 'hover:bg-muted'
                  }`}
                >
                  <p className="text-sm font-semibold">{route.title}</p>
                  <p className="text-xs text-muted-foreground">{route.path}</p>
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {getFormForPath(location.pathname)}
      </div>
    </DashboardLayout>
  );
}

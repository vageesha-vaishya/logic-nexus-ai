import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  path: string;
  title: string;
  description: string;
};

const UIM_ROUTES: UimRouteConfig[] = [
  {
    path: '/dashboard/uim',
    title: 'UIM Overview',
    description: 'Operational CRUD workspace for UIM overview records.',
  },
  {
    path: '/dashboard/uim/item-master',
    title: 'Item Master',
    description: 'Operational CRUD workspace for item master records.',
  },
  {
    path: '/dashboard/uim/stock-ledger',
    title: 'Stock Ledger',
    description: 'Operational CRUD workspace for stock ledger records.',
  },
  {
    path: '/dashboard/uim/reservations',
    title: 'Reservation Engine',
    description: 'Operational CRUD workspace for reservation records.',
  },
  {
    path: '/dashboard/uim/issue-consume',
    title: 'Physical Issue/Consume',
    description: 'Operational CRUD workspace for issue/consume records.',
  },
  {
    path: '/dashboard/uim/restock',
    title: 'Dynamic Restock',
    description: 'Operational CRUD workspace for restock records.',
  },
  {
    path: '/dashboard/uim/locations',
    title: 'Location Registry',
    description: 'Operational CRUD workspace for location records.',
  },
  {
    path: '/dashboard/uim/analytics',
    title: 'Inventory Analytics',
    description: 'Operational CRUD workspace for analytics records.',
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
            Direct operational forms for create, read, update, and delete workflows.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{activeRoute.title}</CardTitle>
            <CardDescription>{activeRoute.description}</CardDescription>
          </CardHeader>
        </Card>

        {getFormForPath(location.pathname)}
      </div>
    </DashboardLayout>
  );
}

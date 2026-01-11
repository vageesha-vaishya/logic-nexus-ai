import { lazy, LazyExoticComponent, ComponentType } from 'react';
import { WidgetDefinition } from '@/types/dashboard';

// Lazy load widgets with named export handling
const StatsWidget = lazy(() => import('@/components/dashboard/widgets/StatsWidget').then(m => ({ default: m.StatsWidget })));
const LeadsWidget = lazy(() => import('@/components/dashboard/widgets/LeadsWidget').then(m => ({ default: m.LeadsWidget })));
const ActivitiesWidget = lazy(() => import('@/components/dashboard/widgets/ActivitiesWidget').then(m => ({ default: m.ActivitiesWidget })));
const AccountsWidget = lazy(() => import('@/components/dashboard/widgets/AccountsWidget').then(m => ({ default: m.AccountsWidget })));
const ContactsWidget = lazy(() => import('@/components/dashboard/widgets/ContactsWidget').then(m => ({ default: m.ContactsWidget })));
const QuotesWidget = lazy(() => import('@/components/dashboard/widgets/QuotesWidget').then(m => ({ default: m.QuotesWidget })));
const OpportunitiesWidget = lazy(() => import('@/components/dashboard/widgets/OpportunitiesWidget').then(m => ({ default: m.OpportunitiesWidget })));
const ShipmentsWidget = lazy(() => import('@/components/dashboard/widgets/ShipmentsWidget').then(m => ({ default: m.ShipmentsWidget })));
const TransfersWidget = lazy(() => import('@/components/dashboard/widgets/TransfersWidget').then(m => ({ default: m.TransfersWidget })));
const CustomChartWidget = lazy(() => import('@/components/dashboard/widgets/CustomChartWidget').then(m => ({ default: m.CustomChartWidget })));
const InsightsWidget = lazy(() => import('@/components/dashboard/widgets/InsightsWidget').then(m => ({ default: m.InsightsWidget })));

export const AVAILABLE_WIDGETS: WidgetDefinition[] = [
  {
    type: 'stats',
    label: 'Key Performance Indicators',
    description: 'Overview of key metrics and statistics',
    defaultSize: 'full',
    component: StatsWidget as unknown as ComponentType<any>,
  },
  {
    type: 'leads',
    label: 'My Leads',
    description: 'List of recent leads assigned to you',
    defaultSize: 'medium',
    component: LeadsWidget as unknown as ComponentType<any>,
  },
  {
    type: 'activities',
    label: 'My Activities',
    description: 'Upcoming tasks, calls, and meetings',
    defaultSize: 'medium',
    component: ActivitiesWidget as unknown as ComponentType<any>,
  },
  {
    type: 'accounts',
    label: 'Accounts',
    description: 'Recent accounts',
    defaultSize: 'medium',
    component: AccountsWidget as unknown as ComponentType<any>,
  },
  {
    type: 'contacts',
    label: 'Contacts',
    description: 'Recent contacts',
    defaultSize: 'medium',
    component: ContactsWidget as unknown as ComponentType<any>,
  },
  {
    type: 'quotes',
    label: 'Quotes',
    description: 'Recent quotes',
    defaultSize: 'medium',
    component: QuotesWidget as unknown as ComponentType<any>,
  },
  {
    type: 'opportunities',
    label: 'Opportunities',
    description: 'Active opportunities',
    defaultSize: 'medium',
    component: OpportunitiesWidget as unknown as ComponentType<any>,
  },
  {
    type: 'shipments',
    label: 'Shipments',
    description: 'Active shipments',
    defaultSize: 'medium',
    component: ShipmentsWidget as unknown as ComponentType<any>,
  },
  {
    type: 'transfers',
    label: 'Transfer Requests',
    description: 'Real-time transfer requests queue',
    defaultSize: 'medium',
    component: TransfersWidget as unknown as ComponentType<any>,
  },
  {
    type: 'custom_chart',
    label: 'Custom Chart',
    description: 'Create a custom chart from your data',
    defaultSize: 'medium',
    component: CustomChartWidget as unknown as ComponentType<any>,
    defaultSettings: {
      entity: 'leads',
      groupBy: 'status',
      chartType: 'bar'
    }
  },
];

export const getWidgetDefinition = (type: string) => 
  AVAILABLE_WIDGETS.find(w => w.type === type);

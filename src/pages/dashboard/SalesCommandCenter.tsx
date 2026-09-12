import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  Users,
  FileText,
  Plus,
  Clock,
  Zap,
  Target,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { useSalesCommandCenterData, type SalesActivityEvent } from '@/features/module-sales/hooks/useSalesCommandCenterData';

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

function formatTrend(pct: number | null): string | null {
  if (pct === null) return null;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function activityTone(activity: SalesActivityEvent): 'success' | 'info' | 'warning' {
  if (activity.status === 'completed') return 'success';
  if (activity.status === 'cancelled') return 'warning';
  return 'info';
}

function activityDescription(activity: SalesActivityEvent): string {
  const type = activity.activity_type ? activity.activity_type.charAt(0).toUpperCase() + activity.activity_type.slice(1) : 'Activity';
  const status = activity.status ? activity.status.replace('_', ' ') : 'planned';
  return `${type} — ${status}`;
}

export default function SalesCommandCenter() {
  const navigate = useNavigate();
  const { loading, error, metrics, activities } = useSalesCommandCenterData();

  const quickActions = [
    { label: 'New Quote', icon: Plus, action: '/dashboard/quotes/new', desc: 'Create a new quotation' },
    { label: 'New Lead', icon: Users, action: '/dashboard/leads/new', desc: 'Register a new prospect' },
    { label: 'Create Order', icon: FileText, action: '/dashboard/orders/new', desc: 'Convert quote to order' },
    { label: 'Sales Report', icon: BarChart3, action: '/dashboard/reports/sales', desc: 'View performance analytics' },
  ];

  const revenueTrend = formatTrend(metrics.revenueTrendPct);
  const metricCards = [
    {
      title: 'Revenue This Month',
      value: currency.format(metrics.totalRevenue),
      trend: revenueTrend,
      icon: DollarSign,
      tone: 'success' as const,
    },
    {
      title: 'Active Deals',
      value: String(metrics.activeDeals),
      trend: null,
      icon: FileText,
      tone: 'info' as const,
    },
    {
      title: 'Conversion Rate',
      value: `${metrics.conversionRate.toFixed(1)}%`,
      trend: null,
      icon: Target,
      tone: 'primary' as const,
    },
    {
      title: 'New Leads This Month',
      value: String(metrics.newLeadsThisMonth),
      trend: metrics.newLeadsTrend !== 0 ? `${metrics.newLeadsTrend > 0 ? '+' : ''}${metrics.newLeadsTrend}` : null,
      icon: Users,
      tone: 'warning' as const,
    },
  ];

  const toneClasses: Record<'success' | 'info' | 'warning' | 'primary', { icon: string; bg: string }> = {
    success: { icon: 'text-success', bg: 'bg-success/10' },
    info: { icon: 'text-info', bg: 'bg-info/10' },
    warning: { icon: 'text-warning', bg: 'bg-warning/10' },
    primary: { icon: 'text-primary', bg: 'bg-primary/10' },
  };

  const dotToneClasses: Record<'success' | 'info' | 'warning', string> = {
    success: 'bg-success',
    info: 'bg-info',
    warning: 'bg-warning',
  };

  if (error) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <p className="text-sm text-destructive">Failed to load sales command center data. Please refresh the page.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Zap className="h-8 w-8 text-warning fill-warning" />
            Sales Command Center
          </h1>
          <p className="text-muted-foreground mt-1">Overview of your sales performance and daily tasks</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline">Customize Dashboard</Button>
          <Button onClick={() => navigate('/dashboard/leads/new')}>
            <Plus className="mr-2 h-4 w-4" /> New Activity
          </Button>
        </div>
      </div>

      {/* Metrics Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="border-none shadow-sm">
              <CardContent className="p-6 flex items-center justify-center h-[104px]">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {metricCards.map((metric, idx) => (
            <Card key={idx} className="border-none shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-3 rounded-xl ${toneClasses[metric.tone].bg}`}>
                    <metric.icon className={`h-6 w-6 ${toneClasses[metric.tone].icon}`} />
                  </div>
                  {metric.trend && (
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                      metric.trend.startsWith('+') ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                    }`}>
                      {metric.trend}
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-medium text-muted-foreground">{metric.title}</h3>
                <p className="text-2xl font-bold text-foreground mt-1">{metric.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions */}
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => navigate(action.action)}
                className="flex items-start gap-4 p-4 rounded-xl border bg-card hover:bg-muted/50 transition-all text-left group"
              >
                <div className="p-3 rounded-lg bg-muted group-hover:bg-card group-hover:shadow-sm transition-all">
                  <action.icon className="h-6 w-6 text-muted-foreground group-hover:text-primary" />
                </div>
                <div>
                  <h4 className="font-semibold text-foreground group-hover:text-primary transition-colors">{action.label}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{action.desc}</p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg font-semibold text-foreground">Recent Activity</CardTitle>
            <Button variant="ghost" size="sm" className="text-primary" onClick={() => navigate('/dashboard/activities')}>View All</Button>
          </CardHeader>
          <CardContent className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : activities.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent activity</p>
            ) : (
              activities.map((activity, idx) => (
                <div key={activity.id} className="flex gap-4 relative">
                  {idx !== activities.length - 1 && (
                    <div className="absolute left-[11px] top-8 bottom-[-24px] w-px bg-border" />
                  )}
                  <div className={`relative z-10 h-6 w-6 rounded-full border-2 border-background shadow-sm flex-shrink-0 ${dotToneClasses[activityTone(activity)]}`} />
                  <div>
                    <h4 className="text-sm font-medium text-foreground">{activity.subject || 'Sales activity'}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{activityDescription(activity)}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

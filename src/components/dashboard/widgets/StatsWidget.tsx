import { useEffect, useState } from 'react';
import { WidgetProps } from '@/types/dashboard';
import { StatsCards, StatItem } from '@/components/dashboard/StatsCards';
import { dashboardAnalyticsService } from '@/services/dashboardAnalytics';
import { Ship, DollarSign, Activity, AlertCircle } from 'lucide-react';

export function StatsWidget({ config }: WidgetProps) {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStats() {
      try {
        const [data, dailyStats] = await Promise.all([
          dashboardAnalyticsService.getDashboardStats(),
          dashboardAnalyticsService.getDailyStats()
        ]);
        
        const newStats: StatItem[] = [
          {
            id: "shipments",
            title: "Active Shipments",
            value: data.active_shipments.toString(),
            change: "", 
            trend: "up",
            icon: Ship,
            color: "text-primary",
            data: dailyStats.shipments.length > 0 ? dailyStats.shipments : [{value: 0}, {value: data.active_shipments}],
            description: "Total active shipments"
          },
          {
            id: "revenue",
            title: "Total Revenue",
            value: `$${data.total_revenue.toLocaleString()}`,
            change: "",
            trend: "up",
            icon: DollarSign,
            color: "text-success",
            data: dailyStats.revenue.length > 0 ? dailyStats.revenue : [{value: 0}, {value: 100}],
            description: "Total recognized revenue"
          },
          {
            id: "invoices",
            title: "Pending Invoices",
            value: data.pending_invoices.toString(),
            change: "",
            trend: "down",
            icon: Activity,
            color: "text-accent",
            data: dailyStats.invoices.length > 0 ? dailyStats.invoices : [{value: 0}, {value: data.pending_invoices}],
            description: "Invoices waiting for payment"
          },
          {
            id: "profit",
            title: "Total Profit",
            value: `$${data.total_profit.toLocaleString()}`,
            change: "",
            trend: "up",
            icon: AlertCircle,
            color: "text-warning",
            data: dailyStats.profit.length > 0 ? dailyStats.profit : [{value: 0}, {value: 100}],
            description: "Total profit margin"
          }
        ];
        setStats(newStats);
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    }
    loadStats();
  }, []);
  
  return (
    <div className="h-full">
      <StatsCards stats={stats.length > 0 ? stats : undefined} loading={loading} />
    </div>
  );
}

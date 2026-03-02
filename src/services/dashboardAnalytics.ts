
import { supabase } from '@/integrations/supabase/client';
import { FinancialMetric, CarrierVolume, DashboardStats, DailyStats } from '@/types/dashboard';

export const dashboardAnalyticsService = {
  async getDailyStats(days: number = 30): Promise<DailyStats> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_daily_stats' as any, { p_days: days });
    
    if (error) {
      console.error('Error fetching daily stats:', error);
      throw error;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any) || {
      revenue: [],
      shipments: [],
      invoices: [],
      profit: []
    };
  },

  async getFinancialMetrics(period: string = '12m'): Promise<FinancialMetric[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_financial_metrics' as any, { period });
    
    if (error) {
      console.error('Error fetching financial metrics:', error);
      throw error;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any) || [];
  },

  async getCarrierVolume(period: string = '12m'): Promise<CarrierVolume[]> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_carrier_volume' as any, { period });
    
    if (error) {
      console.error('Error fetching carrier volume:', error);
      throw error;
    }
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any) || [];
  },

  async getDashboardStats(): Promise<DashboardStats> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await supabase.rpc('get_dashboard_stats' as any);
    
    if (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
    
    // RPC returns an array of objects, we expect a single object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = data as any;
    return result && result.length > 0 ? result[0] : {
      total_revenue: 0,
      active_shipments: 0,
      pending_invoices: 0,
      total_profit: 0
    };
  }
};

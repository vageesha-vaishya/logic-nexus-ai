import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { TrendingUp, DollarSign } from 'lucide-react';

interface TrendData {
  month: string;
  revenue: number;
  growth: number;
}

export function RevenueTrends() {
  const { scopedDb } = useCRM();
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('amount, close_date')
          .eq('stage', 'closed_won')
          .order('close_date', { ascending: true });

        if (!error && data) {
          const monthlyRevenue = new Map<string, number>();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          
          data.forEach((opp: any) => {
            const date = new Date(opp.close_date);
            const key = `${months[date.getMonth()]} ${date.getFullYear()}`;
            const current = monthlyRevenue.get(key) || 0;
            monthlyRevenue.set(key, current + (opp.amount || 0));
          });

          // Convert to array and calculate growth
          const result: TrendData[] = [];
          let prevRevenue = 0;

          monthlyRevenue.forEach((revenue, month) => {
            const growth = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : 0;
            result.push({ month, revenue, growth });
            prevRevenue = revenue;
          });

          setTrends(result.slice(-6)); // Last 6 months
        }
      } catch (error) {
        console.error('Failed to fetch revenue trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, [scopedDb]);

  const maxRevenue = Math.max(...trends.map(t => t.revenue)) || 1;

  if (loading) {
    return <div className="h-64 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-green-600" />
        <h4 className="font-semibold text-gray-900">Revenue Trends (Last 6 Months)</h4>
      </div>
      
      <div className="relative h-48 flex items-end justify-between gap-4 px-2">
        {trends.map((item, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
            <div 
              className="w-full bg-gradient-to-t from-green-600 to-green-400 rounded-t-lg transition-all duration-500 hover:opacity-90"
              style={{ height: `${(item.revenue / maxRevenue) * 100}%` }}
            >
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                ${(item.revenue / 1000).toFixed(1)}k
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium text-gray-600">{item.month.split(' ')[0]}</p>
              <p className={`text-[10px] ${item.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {item.growth > 0 ? '+' : ''}{item.growth.toFixed(0)}%
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

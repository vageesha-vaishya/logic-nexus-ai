import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { DollarSign, TrendingUp, Target } from 'lucide-react';

interface RevenueData {
  ytd: number;
  target: number;
  achieved: number;
  growth: string;
  byQuarter: { q: string; revenue: number }[];
}

export function RevenueYTD() {
  const { scopedDb } = useCRM();
  const [revenueData, setRevenueData] = useState<RevenueData>({
    ytd: 0,
    target: 0,
    achieved: 0,
    growth: '0%',
    byQuarter: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRevenue = async () => {
      try {
        setLoading(true);
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1).toISOString();
        const endOfYear = new Date(now.getFullYear(), 11, 31).toISOString();

        // Fetch won opportunities this year
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('amount, close_date')
          .eq('stage', 'closed_won')
          .gte('close_date', startOfYear)
          .lte('close_date', endOfYear);

        if (!error && data) {
          let ytd = 0;
          const quarters = { Q1: 0, Q2: 0, Q3: 0, Q4: 0 };

          data.forEach((opp: any) => {
            const amount = opp.amount || 0;
            ytd += amount;

            const date = new Date(opp.close_date);
            const month = date.getMonth();
            if (month < 3) quarters.Q1 += amount;
            else if (month < 6) quarters.Q2 += amount;
            else if (month < 9) quarters.Q3 += amount;
            else quarters.Q4 += amount;
          });

          // Mock target as 120% of current YTD or a fixed baseline if 0
          // In a real app, this would come from a quotas/targets table
          const target = ytd > 0 ? ytd * 1.2 : 1000000; 
          const achieved = target > 0 ? Math.min(100, Math.round((ytd / target) * 100)) : 0;

          setRevenueData({
            ytd,
            target,
            achieved,
            growth: '+12%', // Mock growth for now, would need last year's data to calc real growth
            byQuarter: [
              { q: 'Q1', revenue: quarters.Q1 },
              { q: 'Q2', revenue: quarters.Q2 },
              { q: 'Q3', revenue: quarters.Q3 },
              { q: 'Q4', revenue: quarters.Q4 },
            ],
          });
        }
      } catch (error) {
        console.error('Failed to fetch revenue YTD:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRevenue();
  }, [scopedDb]);

  const maxRevenue = Math.max(...revenueData.byQuarter.map(q => q.revenue)) || 1;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            <h4 className="font-semibold text-gray-900">Revenue YTD</h4>
          </div>
        </div>
        <div className="h-32 bg-gray-100 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <h4 className="font-semibold text-gray-900">Revenue YTD</h4>
        </div>
        <div className="flex items-center gap-1 text-green-600">
          <TrendingUp className="h-4 w-4" />
          <span className="text-sm font-semibold">{revenueData.growth}</span>
        </div>
      </div>

      <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded border border-green-200">
        <p className="text-sm text-green-700 mb-1">Year-to-Date Revenue</p>
        <p className="text-3xl font-bold text-green-900">${(revenueData.ytd / 1000000).toFixed(2)}M</p>
        <div className="flex items-center gap-2 mt-3">
          <Target className="h-4 w-4 text-green-700" />
          <p className="text-xs text-green-700">Target: ${(revenueData.target / 1000000).toFixed(2)}M</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-900">Target Achievement</p>
          <span className="text-sm font-semibold text-green-600">{revenueData.achieved}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-2 rounded-full transition-all"
            style={{ width: `${revenueData.achieved}%` }}
          />
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-xs font-semibold text-gray-700 mb-2">Quarterly Breakdown</p>
        <div className="flex items-end justify-between gap-2 h-16">
          {revenueData.byQuarter.map((item, idx) => (
            <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <div
                className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t transition-all"
                style={{ height: `${Math.max(4, (item.revenue / maxRevenue) * 100)}%` }}
                title={`${item.q}: $${(item.revenue / 1000).toFixed(0)}k`}
              />
              <p className="text-xs text-gray-600">{item.q}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

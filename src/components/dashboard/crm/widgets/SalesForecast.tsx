import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { TrendingUp, Calendar } from 'lucide-react';

interface ForecastData {
  month: string;
  forecast: number;
  lowCase: number;
  highCase: number;
}

export function SalesForecast() {
  const { scopedDb } = useCRM();
  const [forecastData, setForecastData] = useState<ForecastData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalForecast, setTotalForecast] = useState(0);

  useEffect(() => {
    const fetchForecast = async () => {
      try {
        setLoading(true);
        const today = new Date();
        const next3Months = new Date();
        next3Months.setMonth(today.getMonth() + 3);

        const { data, error } = await scopedDb
          .from('opportunities')
          .select('amount, probability, close_date')
          .gte('close_date', today.toISOString().split('T')[0])
          .lte('close_date', next3Months.toISOString().split('T')[0]);

        if (!error && data) {
          const monthlyData = new Map<string, { forecast: number; low: number; high: number }>();
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

          data.forEach((opp: any) => {
            if (!opp.close_date || !opp.amount) return;
            
            const date = new Date(opp.close_date);
            const monthKey = months[date.getMonth()];
            
            if (!monthlyData.has(monthKey)) {
              monthlyData.set(monthKey, { forecast: 0, low: 0, highCase: 0 });
            }

            const current = monthlyData.get(monthKey)!;
            const probability = opp.probability || 0;
            const amount = opp.amount || 0;

            // Forecast = Weighted Amount
            current.forecast += (amount * probability) / 100;
            
            // High Case = Total Pipeline Amount (Optimistic)
            current.highCase += amount;
            
            // Low Case = Conservative (only high prob deals or lower weight)
            // Let's say Low Case is 50% of forecast for simplicity or strictly committed deals
            // Better heuristic: Weighted amount but penalize probability by 20%
            const lowProb = Math.max(0, probability - 20);
            current.low += (amount * lowProb) / 100;
          });

          // Sort by month index to ensure correct order
          const sortedMonths = Array.from(monthlyData.keys()).sort((a, b) => {
            return months.indexOf(a) - months.indexOf(b);
          });

          const result = sortedMonths.map(m => ({
            month: m,
            forecast: monthlyData.get(m)!.forecast,
            lowCase: monthlyData.get(m)!.low,
            highCase: monthlyData.get(m)!.highCase,
          }));

          setForecastData(result);
          setTotalForecast(result.reduce((sum, item) => sum + item.forecast, 0));
        }
      } catch (error) {
        console.error('Failed to fetch sales forecast:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchForecast();
  }, [scopedDb]);

  const maxValue = forecastData.length > 0 ? Math.max(...forecastData.map(d => d.highCase)) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="h-5 w-5 text-cyan-600" />
          <h4 className="font-semibold text-gray-900">Sales Forecast</h4>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-cyan-600" />
        <h4 className="font-semibold text-gray-900">Sales Forecast</h4>
      </div>
      <div className="space-y-3">
        {forecastData.length > 0 ? forecastData.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-gray-900">{item.month}</p>
              <p className="text-sm font-semibold text-cyan-600">${(item.forecast / 1000).toFixed(0)}k</p>
            </div>
            <div className="flex gap-0.5 h-5 items-center">
              <div
                className="bg-cyan-200 rounded-sm relative group"
                style={{ width: maxValue > 0 ? `${(item.lowCase / maxValue) * 100}%` : '0%' }}
                title={`Low: $${(item.lowCase / 1000).toFixed(0)}k`}
              />
              <div
                className="bg-cyan-500 rounded-sm relative group"
                style={{ width: maxValue > 0 ? `${((item.forecast - item.lowCase) / maxValue) * 100}%` : '0%' }}
                title={`Forecast: $${(item.forecast / 1000).toFixed(0)}k`}
              />
              <div
                className="bg-cyan-300 rounded-sm relative group"
                style={{ width: maxValue > 0 ? `${((item.highCase - item.forecast) / maxValue) * 100}%` : '0%' }}
                title={`High: $${(item.highCase / 1000).toFixed(0)}k`}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>${(item.lowCase / 1000).toFixed(0)}k</span>
              <span>${(item.highCase / 1000).toFixed(0)}k</span>
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-500 text-center py-4">No forecast data available</p>
        )}
      </div>
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2 mb-2">
          <Calendar className="h-4 w-4 text-cyan-600" />
          <p className="text-sm font-medium text-gray-900">Next Quarter Outlook</p>
        </div>
        <p className="text-sm text-gray-600">
          Projected Total: <span className="font-semibold text-cyan-600">${(totalForecast / 1000).toFixed(1)}k</span>
        </p>
        <p className="text-xs text-gray-500 mt-1">Based on current pipeline and conversion rates</p>
      </div>
    </div>
  );
}

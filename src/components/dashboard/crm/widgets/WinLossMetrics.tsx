import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { BarChart3, CheckCircle, XCircle, TrendingUp } from 'lucide-react';

interface WinLossData {
  wins: number;
  losses: number;
  winRate: number;
  avgDealSize: number;
}

export function WinLossMetrics() {
  const { scopedDb } = useCRM();
  const [metrics, setMetrics] = useState<WinLossData>({
    wins: 0,
    losses: 0,
    winRate: 0,
    avgDealSize: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        setLoading(true);
        // Fetch closed won deals
        const { count: wins, data: wonDeals } = await scopedDb
          .from('opportunities')
          .select('amount', { count: 'exact' })
          .eq('stage', 'closed_won');

        // Fetch closed lost deals
        const { count: losses } = await scopedDb
          .from('opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('stage', 'closed_lost');

        const winCount = wins || 0;
        const lossCount = losses || 0;
        const totalClosed = winCount + lossCount;
        const winRate = totalClosed > 0 ? Math.round((winCount / totalClosed) * 100) : 0;
        
        // Calculate average deal size from won deals
        const totalRevenue = wonDeals?.reduce((sum, deal) => sum + (deal.amount || 0), 0) || 0;
        const avgDealSize = winCount > 0 ? totalRevenue / winCount : 0;

        setMetrics({
          wins: winCount,
          losses: lossCount,
          winRate,
          avgDealSize,
        });
      } catch (error) {
        console.error('Failed to fetch win/loss metrics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          <h4 className="font-semibold text-gray-900">Win/Loss Metrics</h4>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {[1, 2, 3].map(i => <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-emerald-600" />
        <h4 className="font-semibold text-gray-900">Win/Loss Metrics</h4>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="p-2 bg-green-50 rounded border border-green-200">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <span className="text-xs font-medium text-green-700">Wins</span>
          </div>
          <p className="text-xl font-bold text-green-900">{metrics.wins}</p>
        </div>
        <div className="p-2 bg-red-50 rounded border border-red-200">
          <div className="flex items-center gap-1 mb-1">
            <XCircle className="h-4 w-4 text-red-600" />
            <span className="text-xs font-medium text-red-700">Losses</span>
          </div>
          <p className="text-xl font-bold text-red-900">{metrics.losses}</p>
        </div>
        <div className="p-2 bg-blue-50 rounded border border-blue-200">
          <div className="flex items-center gap-1 mb-1">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-medium text-blue-700">Rate</span>
          </div>
          <p className="text-xl font-bold text-blue-900">{metrics.winRate}%</p>
        </div>
      </div>

      <div className="pt-3 border-t">
        <p className="text-sm text-gray-600">
          Avg Deal Size: <span className="font-bold text-gray-900">${(metrics.avgDealSize).toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
        </p>
      </div>
    </div>
  );
}

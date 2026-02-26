import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Users, TrendingUp } from 'lucide-react';

interface SalesRepPerformance {
  id: string;
  name: string;
  dealsWon: number;
  revenue: number;
  winRate: number;
}

export function SalesPerformance() {
  const { scopedDb } = useCRM();
  const [performance, setPerformance] = useState<SalesRepPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPerformance = async () => {
      try {
        setLoading(true);
        // Fetch all opportunities with owner info
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('owner_id, amount, stage, profiles:owner_id(first_name, last_name)');

        if (!error && data) {
          const reps = new Map<string, { name: string; won: number; total: number; revenue: number }>();
          
          data.forEach((opp: any) => {
            const ownerId = opp.owner_id;
            const name = opp.profiles 
              ? `${opp.profiles.first_name} ${opp.profiles.last_name}` 
              : 'Unassigned';
            
            if (!reps.has(ownerId)) {
              reps.set(ownerId, { name, won: 0, total: 0, revenue: 0 });
            }
            
            const current = reps.get(ownerId)!;
            current.total++;
            
            if (opp.stage === 'closed_won') {
              current.won++;
              current.revenue += (opp.amount || 0);
            }
          });

          const result = Array.from(reps.values())
            .map(rep => ({
              id: rep.name,
              name: rep.name,
              dealsWon: rep.won,
              revenue: rep.revenue,
              winRate: rep.total > 0 ? Math.round((rep.won / rep.total) * 100) : 0,
            }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5); // Top 5

          setPerformance(result);
        }
      } catch (error) {
        console.error('Failed to fetch sales performance:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPerformance();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Users className="h-5 w-5 text-indigo-600" />
        <h4 className="font-semibold text-gray-900">Sales Performance</h4>
      </div>
      
      <div className="space-y-3">
        {performance.length > 0 ? performance.map((rep) => (
          <div key={rep.id} className="p-3 bg-white border rounded-lg shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold">
                {rep.name.charAt(0)}
              </div>
              <div>
                <p className="font-medium text-gray-900">{rep.name}</p>
                <p className="text-xs text-gray-500">{rep.dealsWon} deals won • {rep.winRate}% win rate</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-bold text-gray-900">${(rep.revenue / 1000).toFixed(1)}k</p>
              <div className="flex items-center justify-end gap-1 text-xs text-green-600">
                <TrendingUp className="h-3 w-3" />
                <span>Top Performer</span>
              </div>
            </div>
          </div>
        )) : (
          <p className="text-center py-4 text-gray-500">No performance data available</p>
        )}
      </div>
    </div>
  );
}

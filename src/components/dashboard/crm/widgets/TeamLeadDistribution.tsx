import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { Users, PieChart } from 'lucide-react';

interface DistributionItem {
  owner: string;
  count: number;
  percentage: number;
}

export function TeamLeadDistribution() {
  const { scopedDb } = useCRM();
  const [distribution, setDistribution] = useState<DistributionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDistribution = async () => {
      try {
        setLoading(true);
        // Fetch leads with owner info
        // Note: Supabase doesn't support 'groupBy' in client directly easily without rpc
        // So we'll fetch all leads (lightweight) and aggregate in JS
        // Or if volume is high, we should create a view. 
        // For dashboard widget, let's assume < 1000 active leads and aggregate client side.
        
        const { data, error } = await scopedDb
          .from('leads')
          .select('owner_id, profiles:owner_id(first_name, last_name)')
          .eq('status', 'new'); // Only active/new leads? Or all? Let's say all active.

        if (!error && data) {
          const counts = new Map<string, { name: string; count: number }>();
          let total = 0;

          data.forEach((lead: any) => {
            const ownerName = lead.profiles 
              ? `${lead.profiles.first_name} ${lead.profiles.last_name}` 
              : 'Unassigned';
            
            if (!counts.has(ownerName)) {
              counts.set(ownerName, { name: ownerName, count: 0 });
            }
            
            counts.get(ownerName)!.count++;
            total++;
          });

          const result = Array.from(counts.values())
            .map(item => ({
              owner: item.name,
              count: item.count,
              percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
            }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5); // Top 5

          setDistribution(result);
        }
      } catch (error) {
        console.error('Failed to fetch lead distribution:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDistribution();
  }, [scopedDb]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <PieChart className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900">Lead Distribution</h4>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 rounded animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <PieChart className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-gray-900">Lead Distribution</h4>
      </div>

      <div className="space-y-3">
        {distribution.length > 0 ? distribution.map((item, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Users className="h-3 w-3 text-gray-500" />
                <span className="font-medium text-gray-700">{item.owner}</span>
              </div>
              <span className="font-semibold text-gray-900">{item.count}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        )) : (
          <p className="text-sm text-gray-500 text-center py-4">No active leads found</p>
        )}
      </div>
    </div>
  );
}

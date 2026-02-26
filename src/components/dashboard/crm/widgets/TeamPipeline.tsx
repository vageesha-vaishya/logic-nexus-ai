import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { BarChart3, ArrowRight } from 'lucide-react';

interface StageData {
  stage: string;
  count: number;
  value: number;
}

export function TeamPipeline() {
  const { scopedDb } = useCRM();
  const [pipeline, setPipeline] = useState<StageData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('stage, amount');

        if (!error && data) {
          const stages = new Map<string, { count: number; value: number }>();
          
          data.forEach((opp: any) => {
            const stage = opp.stage || 'Unknown';
            if (!stages.has(stage)) {
              stages.set(stage, { count: 0, value: 0 });
            }
            const current = stages.get(stage)!;
            current.count++;
            current.value += (opp.amount || 0);
          });

          // Define standard stages order
          const stageOrder = ['new', 'qualification', 'proposal', 'negotiation', 'closed_won'];
          
          const result = stageOrder.map(stage => ({
            stage,
            count: stages.get(stage)?.count || 0,
            value: stages.get(stage)?.value || 0,
          }));

          setPipeline(result);
        }
      } catch (error) {
        console.error('Failed to fetch team pipeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, [scopedDb]);

  const maxValue = Math.max(...pipeline.map(p => p.value)) || 1;

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pipeline.map((item) => (
        <div key={item.stage} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700 capitalize">{item.stage.replace('_', ' ')}</span>
            <span className="font-semibold text-gray-900">${(item.value / 1000).toFixed(0)}k</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div 
              className="h-full bg-blue-600 rounded-full transition-all duration-500"
              style={{ width: `${(item.value / maxValue) * 100}%` }}
            />
          </div>
          <div className="text-xs text-gray-500 text-right">{item.count} deals</div>
        </div>
      ))}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { BarChart3, List, DollarSign } from 'lucide-react';

interface PipelineStage {
  name: string;
  count: number;
  value: number;
}

export function PipelineOverview() {
  const { scopedDb } = useCRM();
  const [pipeline, setPipeline] = useState<PipelineStage[]>([]);
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

          // Sort by standard pipeline order
          const stageOrder = ['new', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
          
          const result = stageOrder.map(stage => ({
            name: stage.replace('_', ' '),
            count: stages.get(stage)?.count || 0,
            value: stages.get(stage)?.value || 0,
          }));

          setPipeline(result);
        }
      } catch (error) {
        console.error('Failed to fetch pipeline overview:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, [scopedDb]);

  if (loading) {
    return <div className="h-48 bg-gray-100 rounded animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-blue-600" />
        <h4 className="font-semibold text-gray-900">Pipeline Overview</h4>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        {pipeline.map((stage) => (
          <div key={stage.name} className="p-3 bg-white border rounded-lg shadow-sm">
            <p className="text-sm font-medium text-gray-500 capitalize mb-1">{stage.name}</p>
            <div className="flex justify-between items-end">
              <div>
                <p className="text-xl font-bold text-gray-900">${(stage.value / 1000).toFixed(1)}k</p>
                <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                  <List className="h-3 w-3" />
                  {stage.count} deals
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

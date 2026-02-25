import React, { useState, useEffect } from 'react';
import { useCRM } from '@/hooks/useCRM';
import { BarChart3, Target } from 'lucide-react';

interface PipelineStage {
  name: string;
  amount: number;
  count: number;
}

export function PipelineByStage() {
  const { scopedDb } = useCRM();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [totalPipeline, setTotalPipeline] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPipeline = async () => {
      try {
        setLoading(true);
        const { data, error } = await scopedDb
          .from('opportunities')
          .select('stage, amount')
          .not('stage', 'is', null);

        if (!error && data) {
          // Group by stage and calculate totals
          const stageMap = new Map<string, { amount: number; count: number }>();

          data.forEach((opp: any) => {
            const stage = opp.stage || 'Unknown';
            const amount = opp.amount || 0;

            if (!stageMap.has(stage)) {
              stageMap.set(stage, { amount: 0, count: 0 });
            }

            const current = stageMap.get(stage)!;
            current.amount += amount;
            current.count += 1;
          });

          // Convert to array
          const stagesArray = Array.from(stageMap.entries()).map(([name, data]) => ({
            name,
            amount: data.amount,
            count: data.count,
          }));

          setStages(stagesArray);
          setTotalPipeline(stagesArray.reduce((sum, s) => sum + s.amount, 0));
        }
      } catch (error) {
        console.error('Failed to fetch pipeline:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPipeline();
  }, [scopedDb]);

  const maxAmount = stages.length > 0 ? Math.max(...stages.map(s => s.amount)) : 0;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="h-5 w-5 text-purple-600" />
          <h4 className="font-semibold text-gray-900">Pipeline by Stage</h4>
        </div>
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-gray-900">Pipeline by Stage</h4>
      </div>
      {stages.length > 0 ? (
        <>
          <div className="space-y-3">
            {stages.map((stage) => {
              const percentage = maxAmount > 0 ? (stage.amount / maxAmount) * 100 : 0;
              return (
                <div key={stage.name} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-gray-900">{stage.name}</p>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">
                        ${stage.amount.toLocaleString()}
                      </p>
                      <p className="text-xs text-gray-500">{stage.count} opportunities</p>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pt-3 border-t">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-purple-600" />
              <p className="text-sm text-gray-600">
                Total Pipeline: <span className="font-semibold text-gray-900">${totalPipeline.toLocaleString()}</span>
              </p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-center py-4 text-gray-500">No opportunities found</p>
      )}
    </div>
  );
}

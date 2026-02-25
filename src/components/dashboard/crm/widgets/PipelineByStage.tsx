import React from 'react';
import { BarChart3, Target } from 'lucide-react';

export function PipelineByStage() {
  // Mock pipeline data for demonstration
  const stages = [
    { name: 'Prospecting', amount: '$350,000', percentage: 35, count: 12 },
    { name: 'Qualification', amount: '$280,000', percentage: 28, count: 10 },
    { name: 'Proposal', amount: '$250,000', percentage: 25, count: 8 },
    { name: 'Negotiation', amount: '$120,000', percentage: 12, count: 4 },
  ];

  const maxAmount = 350000;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-purple-600" />
        <h4 className="font-semibold text-gray-900">Pipeline by Stage</h4>
      </div>
      <div className="space-y-3">
        {stages.map((stage, idx) => (
          <div key={idx} className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-900">{stage.name}</p>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900">{stage.amount}</p>
                <p className="text-xs text-gray-500">{stage.count} opportunities</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-purple-500 to-purple-600 h-2 rounded-full"
                style={{ width: `${stage.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="pt-3 border-t">
        <div className="flex items-center gap-2">
          <Target className="h-4 w-4 text-purple-600" />
          <p className="text-sm text-gray-600">
            Total Pipeline: <span className="font-semibold text-gray-900">$1,000,000</span>
          </p>
        </div>
      </div>
    </div>
  );
}
